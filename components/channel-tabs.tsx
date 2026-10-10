export function ChannelTabs({ voiceReplies = false, liveVoice = false }: { voiceReplies?: boolean; liveVoice?: boolean }) {
  const voiceOn = voiceReplies || liveVoice;
  return (
    <div className="channel-tabs" role="presentation">
      <span className="on">Chat</span>
      <span className={voiceOn ? "live" : ""}>
        {liveVoice ? "Voice (live)" : voiceReplies ? "Voice replies" : "Voice"} {!voiceOn && <em>Soon</em>}
      </span>
      <span>
        Video <em>Soon</em>
      </span>
    </div>
  );
}
