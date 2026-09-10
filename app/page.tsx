import Link from "next/link";

const proofPoints = [
  {
    label: "Add material",
    title: "Paste what already exists",
    body: "Captions, transcripts, posts, notes, and FAQs are enough to start.",
  },
  {
    label: "AI drafts",
    title: "We build the first voice",
    body: "Persona Studio drafts topics, reply style, examples, languages, and the first fan preview.",
  },
  {
    label: "Creator approves",
    title: "You review, edit, and publish",
    body: "Nothing goes live until the creator approves the voice and topics to avoid.",
  },
];

const benchmarkRows = [
  ["Creator gives", "Public material, languages, and final approval."],
  ["Studio drafts", "Voice, topics, welcome message, examples, and fan preview."],
  ["Fans get", "A clean DM-style chat link with an AI disclosure."],
  ["Creator controls", "Edit, pause, publish, and review sensitive messages."],
];

export default function Home() {
  return (
    <main className="site-shell editorial-home">
      <nav className="landing-nav editorial-nav">
        <Link href="/" className="wordmark">
          Persona Studio
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
          <span className="section-kicker">Creator AI, approved by the creator</span>
          <h1 id="landing-title">Persona Studio</h1>
          <p>
            Turn public creator material into an AI fan chat. The creator gives the source, Persona Studio drafts the
            voice, and nothing goes live until it is approved.
          </p>
          <div className="cta-row">
            <Link href="/creator" className="primary-action">
              Create my persona
            </Link>
            <Link href="/demo/fan" className="secondary-action">
              See fan chat
            </Link>
          </div>
          <div className="hero-outcome-panel" aria-label="Persona Studio output">
            <span>What you get</span>
            <p>A creator-approved AI voice, a public fan chat link, and a dashboard to review conversations.</p>
            <div>
              <strong>Source in</strong>
              <strong>Persona drafted</strong>
              <strong>Fan link live</strong>
            </div>
          </div>
          <div className="hero-proof-strip" aria-label="Persona Studio safeguards">
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
          <h2>Ask less from creators. Draft more for them.</h2>
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
          <h2>Built for creator control, repeat fan chats, and safer public AI.</h2>
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
