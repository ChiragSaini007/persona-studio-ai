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

const benchmarkRows = [
  ["I add", "Public material, languages, and final approval."],
  ["Fanline drafts", "My AI voice, topics, welcome message, examples, and fan preview."],
  ["Fans open", "A clean DM-style chat link with an AI disclosure."],
  ["I control", "Edit, pause, publish, and review sensitive messages."],
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
          <Link href="#proof">Proof</Link>
          <Link href="/demo/fan">Fan preview</Link>
          <Link href="/creator" className="nav-cta">
            Create
          </Link>
        </div>
      </nav>

      <section className="editorial-hero" aria-labelledby="landing-title">
        <div className="hero-image-layer" aria-hidden="true" />
        <div className="hero-identity">
          <span className="section-kicker">My AI fan line, approved by me</span>
          <h1 id="landing-title">Fanline</h1>
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
          <div className="hero-proof-strip" aria-label="Fanline safeguards">
            {benchmarkRows.slice(0, 3).map(([label, value]) => (
              <span key={label}>
                <strong>{label}</strong>
                {value}
              </span>
            ))}
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

      <section id="proof" className="proof-band">
        <div>
          <span className="section-kicker">Production spine</span>
          <h2>Built so I stay in control while fans get a faster answer.</h2>
        </div>
        <div className="proof-table">
          {benchmarkRows.map(([label, value]) => (
            <div key={label}>
              <strong>{label}</strong>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
