export function ChannelTabs({ voiceReplies = false, liveVoice = false, video = false }: { voiceReplies?: boolean; liveVoice?: boolean; video?: boolean }) {
  const voiceOn = voiceReplies || liveVoice;
  return (
    <div className="channel-tabs" role="presentation">
      <span className="on">Chat</span>
      <span className={voiceOn ? "live" : ""}>
        {liveVoice ? "Voice (live)" : voiceReplies ? "Voice replies" : "Voice"} {!voiceOn && <em>Soon</em>}
      </span>
      <span className={video ? "live" : ""}>
        {video ? "Video (live)" : "Video"} {!video && <em>Preview</em>}
      </span>
    </div>
  );
}
