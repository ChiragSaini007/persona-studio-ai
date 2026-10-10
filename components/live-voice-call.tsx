"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "connecting" | "live" | "ended";
type Line = { role: "fan" | "avatar"; text: string };

function clock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Live voice call with a creator's AI avatar. The server brokers the call; this component only handles the browser side.
export function LiveVoiceCall({ handle, creatorName, token }: { handle: string; creatorName: string; token: string }) {
  const first = creatorName.split(" ")[0] || creatorName;
  const [phase, setPhase] = useState<Phase>("idle");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef("");
  const linesRef = useRef<Line[]>([]);
  const timerRef = useRef<number | null>(null);
  const endedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  const hangUp = useCallback(
    async (reason: "fan" | "time" | "error" = "fan") => {
      if (endedRef.current) return;
      endedRef.current = true;
      cleanup();
      const sessionId = sessionRef.current;
      setPhase("ended");
      if (reason === "time") setError("The call reached its time limit.");
      if (sessionId) {
        await fetch("/api/voice/session/end", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessionId, transcript: linesRef.current }),
        }).catch(() => undefined);
      }
    },
    [cleanup, token],
  );

  useEffect(() => () => cleanup(), [cleanup]);

  function addLine(line: Line) {
    linesRef.current = [...linesRef.current, line];
    setLines(linesRef.current);
  }

  async function start() {
    setError("");
    setLines([]);
    linesRef.current = [];
    endedRef.current = false;
    sessionRef.current = "";
    setPhase("connecting");

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot use the microphone.");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        throw new Error("Allow microphone access in your browser to talk live.");
      }
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = (event) => {
        if (audioRef.current) audioRef.current.srcObject = event.streams[0];
      };
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const channel = pc.createDataChannel("oai-events");
      channel.onopen = () => channel.send(JSON.stringify({ type: "response.create" }));
      channel.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data);
          if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript?.trim()) {
            addLine({ role: "fan", text: event.transcript.trim() });
          }
          if (event.type === "response.output_audio_transcript.done" && event.transcript?.trim()) {
            addLine({ role: "avatar", text: event.transcript.trim() });
          }
        } catch {
          // ignore non-JSON events
        }
      };
      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) void hangUp("error");
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const response = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ handle, offer: offer.sdp }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start the call.");

      sessionRef.current = data.sessionId;
      await pc.setRemoteDescription({ type: "answer", sdp: data.answer });
      setRemaining(data.maxSeconds);
      setPhase("live");
      timerRef.current = window.setInterval(() => {
        setRemaining((value) => {
          if (value <= 1) {
            void hangUp("time");
            return 0;
          }
          return value - 1;
        });
      }, 1000);
    } catch (failure) {
      cleanup();
      endedRef.current = true;
      setError(failure instanceof Error ? failure.message : "Could not start the call.");
      setPhase("idle");
    }
  }

  function toggleMute() {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => (track.enabled = !next));
    setMuted(next);
  }

  return (
    <section className="live-call" aria-label={`Live voice call with ${creatorName}'s AI avatar`}>
      <audio ref={audioRef} autoPlay />
      <div className="live-call-head">
        <div>
          <h2>Talk live with {first}&apos;s AI avatar</h2>
          <p>A real-time voice conversation. It is an AI, not the real {first}.</p>
        </div>
        {phase === "live" && <span className="status-pill live">Live · {clock(remaining)}</span>}
      </div>

      {(phase === "idle" || phase === "ended") && (
        <>
          <label className="consent-row live-call-consent">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>
              I understand I am talking to an AI, and that the call is transcribed so {first}&apos;s team can review it.
            </span>
          </label>
          {error && <p className="field-error">{error}</p>}
          <div className="button-row">
            <button className="primary-action" disabled={!agreed || !token} onClick={() => void start()}>
              {phase === "ended" ? "Start another call" : "Start live call"}
            </button>
          </div>
          {!token && <p className="field-hint">Sign in below to talk live.</p>}
        </>
      )}

      {phase === "connecting" && <p className="field-hint">Connecting. Allow your microphone if asked…</p>}

      {phase === "live" && (
        <div className="button-row">
          <button className="secondary-action" onClick={toggleMute} aria-pressed={muted}>
            {muted ? "Unmute" : "Mute"}
          </button>
          <button className="primary-action danger-solid" onClick={() => void hangUp("fan")}>
            End call
          </button>
        </div>
      )}

      {lines.length > 0 && (
        <ol className="live-captions" aria-live="polite">
          {lines.slice(-6).map((line, index) => (
            <li key={`${index}-${line.text.slice(0, 12)}`} className={line.role}>
              <small>{line.role === "fan" ? "You" : "AI avatar"}</small>
              {line.text}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
