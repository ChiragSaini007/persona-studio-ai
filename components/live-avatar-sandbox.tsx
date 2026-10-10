"use client";

import { Room, RoomEvent, Track } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetch } from "../app/admin/admin-client";

type Phase = "idle" | "connecting" | "live" | "ended";

// Admin-only free test of the real-time video path. It always runs in LiveAvatar's sandbox mode (no credits, about a minute,
// one public test avatar), so it proves the connection, video and audio without spending anything.
export function LiveAvatarSandbox() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const roomRef = useRef<Room | null>(null);
  const sessionRef = useRef("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const note = useCallback((line: string) => setLog((current) => [...current.slice(-14), `${new Date().toLocaleTimeString()}  ${line}`]), []);

  const stop = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    room?.disconnect();
    const sessionId = sessionRef.current;
    sessionRef.current = "";
    if (sessionId) await adminFetch("/api/admin/liveavatar/stop", { method: "POST", body: JSON.stringify({ sessionId }) }).catch(() => undefined);
    setPhase("ended");
  }, []);

  useEffect(
    () => () => {
      roomRef.current?.disconnect();
    },
    [],
  );

  function speak(room: Room, text: string) {
    const event = { event_id: `evt-${Date.now()}`, event_type: "avatar.speak_text", session_id: sessionRef.current, source_event_id: null, text };
    void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(event)), { reliable: true, topic: "agent-control" });
    note(`asked the avatar to say: "${text}"`);
  }

  async function start() {
    setError("");
    setLog([]);
    setPhase("connecting");
    try {
      const response = await adminFetch("/api/admin/liveavatar/sandbox", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start the sandbox session");
      sessionRef.current = data.sessionId;
      note(`session created${data.voice ? ` (voice: ${data.voice.name}, ${data.voice.language})` : ""}`);

      const room = new Room({ adaptiveStream: true });
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        note(`${track.kind} track arrived`);
        if (track.kind === Track.Kind.Video && videoRef.current) track.attach(videoRef.current);
        if (track.kind === Track.Kind.Audio && audioRef.current) track.attach(audioRef.current);
      });
      room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
        try {
          const event = JSON.parse(new TextDecoder().decode(payload));
          if (topic === "agent-response" || event.event_type) note(`event: ${event.event_type}${event.text ? ` — ${event.text}` : ""}${event.end_reason ? ` (${event.end_reason})` : ""}`);
        } catch {
          // ignore non-JSON data
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        note("disconnected");
        setPhase("ended");
      });
      await room.connect(data.livekitUrl, data.livekitToken);
      note("joined the room");
      setPhase("live");
      window.setTimeout(() => {
        if (roomRef.current === room) speak(room, "Hello. This is a free sandbox test of the video avatar.");
      }, 4000);
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
            {phase === "ended" ? "Run the sandbox test again" : "Run the free sandbox test"}
          </button>
        ) : (
          <>
            <button className="secondary-action" disabled={phase !== "live"} onClick={() => roomRef.current && speak(roomRef.current, "Namaste. Can you hear me clearly?")}>
              Make it speak
            </button>
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
