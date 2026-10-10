"use client";

import { Room, RoomEvent, Track } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "connecting" | "live" | "ended";
type Line = { role: "fan" | "avatar"; text: string };

function clock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Live video call with a creator's AI avatar. The server checks every rule and brokers the session; this component is the browser side.
export function LiveVideoCall({ handle, creatorName, token }: { handle: string; creatorName: string; token: string }) {
  const first = creatorName.split(" ")[0] || creatorName;
  const [phase, setPhase] = useState<Phase>("idle");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [preview, setPreview] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef("");
  const linesRef = useRef<Line[]>([]);
  const timerRef = useRef<number | null>(null);
  const endedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    roomRef.current?.disconnect();
    roomRef.current = null;
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
      const response = await fetch("/api/video/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ handle }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start the video call.");
      sessionRef.current = data.sessionId;
      setPreview(Boolean(data.preview));

      const room = new Room({ adaptiveStream: { pauseVideoInBackground: false }, dynacast: true });
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && videoRef.current) track.attach(videoRef.current);
        if (track.kind === Track.Kind.Audio && audioRef.current) track.attach(audioRef.current);
      });
      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const event = JSON.parse(new TextDecoder().decode(payload));
          const text = typeof event.text === "string" ? event.text.trim() : "";
          if (!text) return;
          if (event.event_type === "avatar.transcription") addLine({ role: "avatar", text });
          else if (event.event_type === "user.transcription") addLine({ role: "fan", text });
          else if (event.event_type === "session.stopped") void hangUp("time");
        } catch {
          // ignore non-JSON events
        }
      });
      room.on(RoomEvent.Disconnected, () => void hangUp("error"));
      await room.connect(data.livekitUrl, data.livekitToken);
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch {
        throw new Error("Allow microphone access in your browser to talk on video.");
      }
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

      // The first thing a fan hears always says it is an AI.
      const waitStart = Date.now();
      const ready = window.setInterval(() => {
        if (roomRef.current !== room) return window.clearInterval(ready);
        if (room.remoteParticipants.size >= 2 || Date.now() - waitStart > 10000) {
          window.clearInterval(ready);
          window.setTimeout(() => {
            if (roomRef.current !== room) return;
            const event = {
              event_id: crypto.randomUUID(),
              event_type: "avatar.speak_text",
              text: `Hi, I am ${first}'s AI avatar, not the real ${first}. What would you like to talk about?`,
            };
            void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(event)), { reliable: true, topic: "agent-control" });
          }, 1500);
        }
      }, 300);
    } catch (failure) {
      const wasStarted = Boolean(sessionRef.current);
      setError(failure instanceof Error ? failure.message : "Could not start the video call.");
      if (wasStarted) {
        endedRef.current = false;
        await hangUp("error");
        setPhase("idle");
      } else {
        cleanup();
        endedRef.current = true;
        setPhase("idle");
      }
    }
  }

  function toggleMute() {
    const next = !muted;
    void roomRef.current?.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }

  return (
    <section className="live-call" aria-label={`Video call with ${creatorName}'s AI avatar`}>
      <audio ref={audioRef} autoPlay />
      <div className="live-call-head">
        <div>
          <h2>Video call with {first}&apos;s AI avatar</h2>
          <p>A live face-to-face conversation. It is an AI, not the real {first}.</p>
        </div>
        {phase === "live" && <span className="status-pill live">Live · {clock(remaining)}</span>}
      </div>

      <div className="live-sandbox-stage">
        <video ref={videoRef} autoPlay playsInline />
        {phase === "live" && <span className="ai-badge">AI avatar{preview ? " · preview face" : ""}</span>}
        {phase !== "live" && <p className="field-hint">{phase === "connecting" ? "Connecting. Allow your microphone if asked…" : phase === "ended" ? "Call ended." : "The video avatar appears here."}</p>}
      </div>

      {(phase === "idle" || phase === "ended") && (
        <>
          <label className="consent-row live-call-consent">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>I understand I am talking to an AI video avatar, and that the call is transcribed so {first}&apos;s team can review it.</span>
          </label>
          {error && <p className="field-error">{error}</p>}
          <div className="button-row">
            <button className="primary-action" disabled={!agreed || !token} onClick={() => void start()}>
              {phase === "ended" ? "Start another video call" : "Start video call"}
            </button>
          </div>
          {!token && <p className="field-hint">Sign in below to start a video call.</p>}
        </>
      )}

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
