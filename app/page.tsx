import Link from "next/link";

const proofPoints = [
  {
    label: "1. Connect",
    title: "Bring the content you already make",
    body: "Paste captions, transcripts, posts, and FAQs. No interview, no training sessions.",
  },
  {
    label: "2. Train",
    title: "Get a working AI version of you",
    body: "Fanline drafts your voice, topics, and welcome message in minutes. You edit it until it sounds right.",
  },
  {
    label: "3. Launch",
    title: "Put one link in front of fans",
    body: "Nothing goes live until you approve it. Fans chat with your AI from a single link in your bio.",
  },
  {
    label: "4. Decide",
    title: "See if it is worth your time",
    body: "Fans reached, messages, replies handled without you, and revenue in one dashboard. Keep it, pause it, or change it.",
  },
];

const safeguards = [
  ["Approval first", "Nothing is public until you publish it, and you can pause the link any time."],
  ["Clear AI disclosure", "Fans always see they are talking to your AI, grounded in material you approved."],
  ["Topics I rule out", "Private, financial, or risky questions get a polite step-back, never a guess."],
  ["A review queue", "Sensitive conversations are grouped so you can see what fans asked and how your AI answered."],
];

export default function Home() {
  return (
    <main className="site-shell editorial-home">
      <nav className="landing-nav editorial-nav" aria-label="Main">
        <Link href="/" className="wordmark">
          Fanline
        </Link>
        <div>
          <Link href="#workflow">How it works</Link>
          <Link href="#safeguards">Safeguards</Link>
          <Link href="/demo/fan">Demo</Link>
          <Link href="/creator" className="nav-cta">
            Get started
          </Link>
        </div>
      </nav>

      <section className="editorial-hero" aria-labelledby="landing-title">
        <div className="hero-image-layer hero-visual" aria-hidden="true">
          <div className="hv-header">
            <span className="hv-avatar">You</span>
            <div>
              <strong>Your AI</strong>
              <small>Live · approved by you</small>
            </div>
            <em>Sample</em>
          </div>
          <div className="hv-chat">
            <p className="hv-fan">How do you stay consistent when you are burnt out?</p>
            <p className="hv-ai">
              Shrink the goal, not the standard. One small post still counts. Want my 3-step reset?
              <small>From your approved content</small>
            </p>
          </div>
          <div className="hv-stats">
            <div>
              <strong>128</strong>
              <span>Fans chatting</span>
            </div>
            <div>
              <strong>94%</strong>
              <span>Handled without you</span>
            </div>
            <div>
              <strong>3</strong>
              <span>Need your review</span>
            </div>
          </div>
        </div>
        <div className="hero-identity">
          <span className="section-kicker">AI fan chat for creators</span>
          <h1 id="landing-title">Answer every fan in your voice. Only after you approve it.</h1>
          <p>
            Paste your posts, transcripts, and FAQs. Fanline drafts your AI voice and gives you a fan chat link. You
            review it before anyone sees it.
          </p>
          <div className="cta-row">
            <Link href="/creator" className="primary-action">
              Create your fan link
            </Link>
            <Link href="/demo/fan" className="secondary-action">
              Try the demo
            </Link>
          </div>
          <div className="hero-outcome-panel" aria-label="Fanline output">
            <span>What you get</span>
            <p>An approved AI voice, a public fan chat link, and a dashboard to review conversations.</p>
            <div>
              <strong>Your content in</strong>
              <strong>Your voice drafted</strong>
              <strong>Your link live</strong>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="workflow-band">
        <div className="workflow-copy">
          <span className="section-kicker">How it works</span>
          <h2>From your content to a working AI, in four steps.</h2>
        </div>
        <div className="workflow-rail">
          {proofPoints.map((item, index) => (
            <article key={item.label} className="workflow-row">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>{item.label}</small>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="safeguards" className="proof-band">
        <div>
          <span className="section-kicker">Safeguards</span>
          <h2>Fans get a faster answer. You stay in control.</h2>
        </div>
        <div className="proof-table">
          {safeguards.map(([label, value]) => (
            <div key={label}>
              <strong>{label}</strong>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="closing-cta" aria-labelledby="closing-title">
        <h2 id="closing-title">See it work, then make it yours.</h2>
        <p>Try the fan chat first, or paste your posts and have a draft voice in a few minutes.</p>
        <div className="cta-row">
          <Link href="/creator" className="primary-action">
            Create your fan link
          </Link>
          <Link href="/demo/fan" className="secondary-action">
            Try the demo
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        <Link href="/" className="wordmark">
          Fanline
        </Link>
        <span>Fan chats are AI-generated from approved public material.</span>
        <div>
          <Link href="/demo/fan">Fan preview</Link>
          <Link href="/creator">Creator portal</Link>
        </div>
      </footer>
    </main>
  );
}
