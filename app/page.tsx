import Link from "next/link";

const proofPoints = [
  {
    label: "Interview",
    title: "Capture the creator's voice",
    body: "Stories, tone, languages, example replies, and hard boundaries turn into the first persona draft.",
  },
  {
    label: "Review",
    title: "Approve before fans see it",
    body: "Creators review what the AI believes, how it greets fans, and what it will refuse.",
  },
  {
    label: "Share",
    title: "Publish one clean fan link",
    body: "A disclosed DM link goes into Instagram, Linktree, broadcasts, and fan communities.",
  },
];

const benchmarkRows = [
  ["Voice", "Creator-written examples shape every reply."],
  ["Memory", "Approved content is retrieved before answering."],
  ["Safety", "Private, risky, or off-brand asks are blocked."],
  ["Control", "Creators can edit, pause, and review conversations."],
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
            Launch an AI persona fans can actually talk to. Creators answer a guided interview, approve the voice,
            set hard limits, and publish one clean fan chat link.
          </p>
          <div className="cta-row">
            <Link href="/creator" className="primary-action">
              Start creator setup
            </Link>
            <Link href="/demo/fan" className="secondary-action">
              Preview fan chat
            </Link>
          </div>
          <div className="hero-chat-proof" aria-label="Example fan chat">
            <span>Fan asks</span>
            <p>How should I think about building a creator product?</p>
            <span>Persona replies</span>
            <p>Start with the fan behavior you want to earn again. Build trust first, then add AI where it makes the relationship better.</p>
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
          <h2>It feels like onboarding a public voice, not filling a settings form.</h2>
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
          <h2>Built for reputation risk, repeat fans, and real creator control.</h2>
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
