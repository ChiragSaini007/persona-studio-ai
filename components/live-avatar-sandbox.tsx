"use client";

import { Room, RoomEvent, Track, type RemoteAudioTrack } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetch } from "../app/admin/admin-client";

type Phase = "idle" | "connecting" | "live" | "ended";

// Admin-only free test of the real-time video path. It always runs in LiveAvatar's sandbox mode (no credits, about a minute,
// one public test avatar), so it proves the connection, video and audio without spending anything.
export function LiveAvatarSandbox({ brainAvatarId }: { brainAvatarId?: string } = {}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const roomRef = useRef<Room | null>(null);
  const sessionRef = useRef("");
  const cleanupRef = useRef<{ secretId?: string; configId?: string } | null>(null);
  const [question, setQuestion] = useState("I am a total beginner. Where should I start?");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const meterRef = useRef<number | null>(null);
  const peakRef = useRef(0);

  const note = useCallback((line: string) => setLog((current) => [...current.slice(-14), `${new Date().toLocaleTimeString()}  ${line}`]), []);

  const stop = useCallback(async () => {
    if (meterRef.current) window.clearInterval(meterRef.current);
    meterRef.current = null;
    if (peakRef.current) note(`loudest moment: ${peakRef.current}`);
    peakRef.current = 0;
    const room = roomRef.current;
    roomRef.current = null;
    room?.disconnect();
    const sessionId = sessionRef.current;
    sessionRef.current = "";
    if (sessionId) await adminFetch("/api/admin/liveavatar/stop", { method: "POST", body: JSON.stringify({ sessionId, cleanup: cleanupRef.current }) }).catch(() => undefined);
    cleanupRef.current = null;
    setPhase("ended");
  }, []);

  useEffect(
    () => () => {
      roomRef.current?.disconnect();
    },
    [],
  );

  function speak(room: Room, text: string) {
    // Same shape as LiveAvatar's own SDK: event id, event type and text.
    const event = { event_id: crypto.randomUUID(), event_type: "avatar.speak_text", text };
    void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(event)), { reliable: true, topic: "agent-control" });
    note(`asked the avatar to say: "${text}"`);
  }

  function ask(room: Room, text: string) {
    // avatar.speak_response: the avatar generates a reply with its brain and speaks it.
    const event = { event_id: crypto.randomUUID(), event_type: "avatar.speak_response", text };
    void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(event)), { reliable: true, topic: "agent-control" });
    note(`asked the avatar: "${text}"`);
  }

  async function start() {
    setError("");
    setLog([]);
    setPhase("connecting");
    try {
      const response = await adminFetch(brainAvatarId ? "/api/admin/liveavatar/brain-test" : "/api/admin/liveavatar/sandbox", { method: "POST", body: brainAvatarId ? JSON.stringify({ avatarId: brainAvatarId }) : undefined });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start the sandbox session");
      sessionRef.current = data.sessionId;
      cleanupRef.current = data.cleanup || null;
      note(`session created${data.voice ? ` (voice: ${data.voice.name}, ${data.voice.language})` : ""}`);

      const room = new Room({ adaptiveStream: { pauseVideoInBackground: false }, dynacast: true });
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        note(`${track.kind} track arrived`);
        if (track.kind === Track.Kind.Video && videoRef.current) track.attach(videoRef.current);
        if (track.kind === Track.Kind.Audio && audioRef.current) {
          track.attach(audioRef.current);
          // Diagnostic: read the connection's own audio statistics, so we can tell when sound is really arriving.
          let lastEnergy = 0;
          let lastBytes = 0;
          if (meterRef.current) window.clearInterval(meterRef.current);
          meterRef.current = window.setInterval(async () => {
            try {
              const report = await (track as RemoteAudioTrack).getRTCStatsReport();
              report?.forEach((stat) => {
                if (stat.type === "inbound-rtp" && stat.kind === "audio") {
                  const energy = Number(stat.totalAudioEnergy || 0);
                  const bytes = Number(stat.bytesReceived || 0);
                  if (energy - lastEnergy > 0.0005) {
                    peakRef.current = Math.max(peakRef.current, Math.round((energy - lastEnergy) * 1000));
                    note(`sound arriving (energy +${(energy - lastEnergy).toFixed(4)}, ${bytes - lastBytes} bytes)`);
                  }
                  lastEnergy = energy;
                  lastBytes = bytes;
                }
              });
            } catch {
              // statistics are only a diagnostic
            }
          }, 1000);
        }
      });
      room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
        const raw = new TextDecoder().decode(payload);
        try {
          const event = JSON.parse(raw);
          note(`data [${topic || "no topic"}]: ${event.event_type || "?"}${event.text ? ` — ${event.text}` : ""}${event.end_reason ? ` (${event.end_reason})` : ""}`);
        } catch {
          note(`data [${topic || "no topic"}]: ${raw.slice(0, 100)}`);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        note("disconnected");
        setPhase("ended");
      });
      room.on(RoomEvent.ParticipantConnected, (participant) => note(`participant joined: ${participant.identity}`));
      await room.connect(data.livekitUrl, data.livekitToken);
      note(`joined the room; already here: ${Array.from(room.remoteParticipants.values()).map((p) => p.identity).join(", ") || "nobody yet"}`);
      setPhase("live");
      // Wait until both the LiveAvatar agent and the avatar are in the room, as LiveAvatar's SDK does.
      const waitStart = Date.now();
      const ready = window.setInterval(() => {
        if (roomRef.current !== room) return window.clearInterval(ready);
        if (room.remoteParticipants.size >= 2 || Date.now() - waitStart > 10000) {
          window.clearInterval(ready);
          window.setTimeout(() => {
            if (roomRef.current !== room) return;
            if (brainAvatarId) ask(room, question);
            else speak(room, "Hello. This is a free sandbox test of the video avatar.");
          }, 1500);
        }
      }, 300);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong");
      await stop();
      setPhase("idle");
    }
  }

  return (
    <div className="live-sandbox">
      <audio ref={audioRef} autoPlay />
      <div className="live-sandbox-stage">
        <video ref={videoRef} autoPlay playsInline muted={false} />
        {phase !== "live" && <p className="field-hint">{phase === "connecting" ? "Connecting…" : phase === "ended" ? "Session ended." : "The avatar appears here."}</p>}
      </div>
      <div className="button-row">
        {phase === "idle" || phase === "ended" ? (
          <button className="primary-action" onClick={() => void start()}>
            {brainAvatarId ? (phase === "ended" ? "Run the brain test again" : "Run the brain test") : phase === "ended" ? "Run the sandbox test again" : "Run the free sandbox test"}
          </button>
        ) : (
          <>
            {brainAvatarId ? (
              <>
                <input value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Question for the avatar" />
                <button className="secondary-action" disabled={phase !== "live" || !question.trim()} onClick={() => roomRef.current && ask(roomRef.current, question)}>
                  Ask
                </button>
              </>
            ) : (
              <button className="secondary-action" disabled={phase !== "live"} onClick={() => roomRef.current && speak(roomRef.current, "Namaste. Can you hear me clearly?")}>
                Make it speak
              </button>
            )}
            <button className="secondary-action danger" onClick={() => void stop()}>
              End now
            </button>
          </>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
      {log.length > 0 && (
        <pre className="live-sandbox-log" aria-live="polite">
          {log.join("\n")}
        </pre>
      )}
    </div>
  );
}
