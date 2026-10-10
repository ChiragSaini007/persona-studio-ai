import Link from "next/link";

const channels = [
  {
    name: "Chat",
    status: "Live today",
    live: true,
    body: "Fans message your avatar from one link. Replies come from content you approved and stay inside the limits you set.",
  },
  {
    name: "Voice",
    status: "Coming soon",
    live: false,
    body: "Fans talk to your avatar out loud. Your voice is only ever used with your explicit, recorded consent.",
  },
  {
    name: "Video calls",
    status: "Coming soon",
    live: false,
    body: "Face-to-face conversations with a video avatar, under the same approvals and boundaries as chat.",
  },
];

const useCases = [
  {
    title: "Promote your products",
    body: "Add your product details, drops and FAQs. Fans ask what to buy, what fits, or when something launches, and get an answer in your voice.",
    ask: "Which one should I start with?",
  },
  {
    title: "Promote brands you work with",
    body: "Give your avatar the approved talking points for a partnership. It stays on message and inside the boundaries you and the brand agreed.",
    ask: "Why do you use this?",
  },
  {
    title: "Promote a film or TV show",
    body: "Load the press kit, behind-the-scenes notes and release dates. Fans get answers about the release while it is on their mind.",
    ask: "When can I watch it?",
  },
  {
    title: "Stay in touch, 24/7",
    body: "Your avatar is there when you are filming, travelling or asleep, so fans are never left in a comment thread waiting.",
    ask: "Any advice for starting out?",
  },
];

const steps = [
  {
    title: "Connect your content",
    body: "Paste the captions, transcripts, interviews and FAQs you already have. No recording sessions.",
  },
  {
    title: "Train your avatar",
    body: "Fanline drafts your voice, topics and welcome message. You edit until it sounds like you.",
  },
  {
    title: "Put it in front of fans",
    body: "Confirm consent, publish, and share one link. Fans chat with your avatar any time of day.",
  },
  {
    title: "Decide if it is worth it",
    body: "See who is talking, what they ask, how much your avatar handled, and revenue once paid access arrives.",
  },
];

const controls = [
  ["Consent comes first", "Nothing is drafted, saved or published until you confirm you are the creator, or have their written permission."],
  ["You approve before it goes live", "Review the voice, the topics and the welcome message. Pause the avatar at any time."],
  ["Boundaries you define", "Rule out topics like politics, finance or private life, and list phrases your avatar must never say."],
  ["Fans always know it is AI", "Every conversation is clearly labelled as your AI avatar, not you."],
  ["A review queue for risky moments", "Sensitive or unclear messages are held in one place, with the fan's question next to your avatar's reply."],
];

export default function Home() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/" className="wordmark">
          Fanline
        </Link>
        <nav aria-label="Main">
          <Link href="#channels">Channels</Link>
          <Link href="#use-cases">Use cases</Link>
          <Link href="#how">How it works</Link>
          <Link href="#control">Control</Link>
          <Link href="/demo/fan">Demo</Link>
        </nav>
        <div className="lp-nav-cta">
          <Link href="/creator" className="lp-link">
            Sign in
          </Link>
          <Link href="/creator" className="lp-btn lp-btn-primary">
            Build your avatar
          </Link>
        </div>
      </header>

      <main>
        <section className="lp-hero" aria-labelledby="lp-title">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">For creators and public figures</p>
            <h1 id="lp-title">Your AI avatar, for every fan.</h1>
            <p className="lp-lede">
              Build an AI version of yourself that talks with fans one-to-one in chat, and soon in voice and video. You
              give consent, you approve every detail, and you see what it is worth.
            </p>
            <div className="lp-cta-row">
              <Link href="/creator" className="lp-btn lp-btn-primary">
                Build your avatar
              </Link>
              <Link href="/demo/fan" className="lp-btn lp-btn-secondary">
                Try a live demo
              </Link>
            </div>
            <p className="lp-note">Consent-first. Nothing goes live without your approval.</p>
          </div>

          <figure className="lp-avatar-card" aria-label="Example of a fan conversation with a creator's AI avatar">
            <div className="lp-avatar-head">
              <span className="lp-avatar-dot" aria-hidden="true">
                You
              </span>
              <div>
                <strong>Your AI avatar</strong>
                <small>Example conversation</small>
              </div>
            </div>
            <div className="lp-tabs" role="presentation">
              <span className="on">Chat</span>
              <span>
                Voice <em>Soon</em>
              </span>
              <span>
                Video <em>Soon</em>
              </span>
            </div>
            <div className="lp-convo">
              <p className="lp-fan">How do you stay consistent when you are burnt out?</p>
              <p className="lp-ai">
                Shrink the goal, not the standard. One small post still counts. Want the three-step reset I use?
              </p>
              <p className="lp-source">Answered from content you approved</p>
            </div>
            <ul className="lp-guards">
              <li>Consent confirmed</li>
              <li>Boundaries on</li>
              <li>Review queue on</li>
            </ul>
          </figure>
        </section>

        <section id="channels" className="lp-section">
          <div className="lp-section-head">
            <h2>One avatar. Every way fans want to reach you.</h2>
            <p>
              Fans get a personal conversation instead of a comment thread. You stay in control of every channel.
            </p>
          </div>
          <div className="lp-channels">
            {channels.map((channel) => (
              <article key={channel.name} className={`lp-channel ${channel.live ? "live" : ""}`}>
                <header>
                  <h3>{channel.name}</h3>
                  <span className={channel.live ? "lp-badge live" : "lp-badge"}>{channel.status}</span>
                </header>
                <p>{channel.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="use-cases" className="lp-section">
          <div className="lp-section-head">
            <h2>How creators and celebrities use it.</h2>
            <p>
              Your avatar talks about whatever you give it. Add the material for a launch, a partnership or a release,
              and fans can ask about it any time of day.
            </p>
          </div>
          <div className="lp-usecases">
            {useCases.map((item) => (
              <article key={item.title} className="lp-usecase">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <p className="lp-ask">
                  <span>Fan asks</span>
                  {item.ask}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="lp-section">
          <div className="lp-section-head">
            <h2>From your content to a working avatar.</h2>
            <p>Four steps, and one decision at the end that is yours to make.</p>
          </div>
          <ol className="lp-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span aria-hidden="true">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="control" className="lp-section lp-control">
          <div className="lp-section-head">
            <h2>Built to protect your name.</h2>
            <p>Your reputation is the product. Every control below is on by default or required.</p>
          </div>
          <dl className="lp-controls">
            {controls.map(([term, detail]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="lp-final">
          <h2>Start with the content you already have.</h2>
          <p>Create your avatar, test it with a demo conversation, and decide what happens next.</p>
          <div className="lp-cta-row">
            <Link href="/creator" className="lp-btn lp-btn-primary">
              Build your avatar
            </Link>
            <Link href="/demo/fan" className="lp-btn lp-btn-secondary">
              Try a live demo
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <Link href="/" className="wordmark">
          Fanline
        </Link>
        <span>AI avatars for creators and public figures. Fans are always told they are talking to an AI.</span>
        <nav aria-label="Footer">
          <Link href="/demo/fan">Demo</Link>
          <Link href="/creator">Creator console</Link>
        </nav>
      </footer>
    </div>
  );
}
