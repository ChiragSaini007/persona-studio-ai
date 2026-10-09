import Link from "next/link";

const proofPoints = [
  {
    label: "I add material",
    title: "I paste what already exists",
    body: "My captions, transcripts, posts, notes, and FAQs are enough to start.",
  },
  {
    label: "Fanline drafts",
    title: "My AI voice is drafted for me",
    body: "Fanline turns my material into topics, reply style, examples, languages, and a fan preview.",
  },
  {
    label: "I approve",
    title: "I review, edit, and publish",
    body: "Nothing goes live until I approve the voice and the topics my AI should avoid.",
  },
];

const safeguards = [
  ["Approval first", "Nothing is public until I publish it, and I can pause the link any time."],
  ["Clear AI disclosure", "Fans always see that they are talking to my AI, grounded in material I approved."],
  ["Topics I rule out", "Private, financial, or risky questions get a polite step-back, not a guess."],
  ["A review queue", "Sensitive conversations are grouped so I can see what fans asked and how my AI answered."],
];

export default function Home() {
  return (
    <main className="site-shell editorial-home">
      <nav className="landing-nav editorial-nav">
        <Link href="/" className="wordmark">
          Fanline
        </Link>
        <div>
          <Link href="#workflow">Workflow</Link>
          <Link href="#safeguards">Safeguards</Link>
          <Link href="/demo/fan">Fan preview</Link>
          <Link href="/creator" className="nav-cta">
            Create
          </Link>
        </div>
      </nav>

      <section className="editorial-hero" aria-labelledby="landing-title">
        <div className="hero-image-layer" aria-hidden="true" />
        <div className="hero-identity">
          <span className="section-kicker">Fanline · my AI fan line, approved by me</span>
          <h1 id="landing-title">Answer every fan DM in my voice. Only after I approve it.</h1>
          <p>
            I add my public posts, transcripts, and FAQs. Fanline drafts my AI voice and gives me a fan chat link I can
            approve before anyone sees it.
          </p>
          <div className="cta-row">
            <Link href="/creator" className="primary-action">
              Create my fanline
            </Link>
            <Link href="/demo/fan" className="secondary-action">
              See fan chat
            </Link>
          </div>
          <div className="hero-outcome-panel" aria-label="Fanline output">
            <span>What I get</span>
            <p>My approved AI voice, a public fan chat link, and a dashboard to review conversations.</p>
            <div>
              <strong>My source in</strong>
              <strong>My AI drafted</strong>
              <strong>My fan link live</strong>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="workflow-band">
        <div className="workflow-copy">
          <span className="section-kicker">How it works</span>
          <h2>I give the raw material. Fanline does the setup.</h2>
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
          <h2>Fans get a faster answer. I stay in control.</h2>
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
        <h2 id="closing-title">See it work, then make it mine.</h2>
        <p>Try the fan chat first, or paste my posts and have a draft voice in a few minutes.</p>
        <div className="cta-row">
          <Link href="/creator" className="primary-action">
            Create my fanline
          </Link>
          <Link href="/demo/fan" className="secondary-action">
            Try the fan chat
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
