export function ChannelTabs({ voiceReplies = false }: { voiceReplies?: boolean }) {
  return (
    <div className="channel-tabs" role="presentation">
      <span className="on">Chat</span>
      <span className={voiceReplies ? "live" : ""}>
        {voiceReplies ? "Voice replies" : "Voice"} {!voiceReplies && <em>Soon</em>}
      </span>
      <span>
        Video <em>Soon</em>
      </span>
    </div>
  );
}
