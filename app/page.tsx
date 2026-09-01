import Link from "next/link";

export default function Home() {
  return (
    <main className="app-shell">
      <div className="burst burst-top" />
      <section className="stage landing-stage">
        <nav className="top-nav">
          <div className="brand-script">Persona</div>
          <div className="nav-tabs">
            <Link className="active" href="/creator">
              Creator portal
            </Link>
            <Link href="/p/chirag">Fan chat</Link>
          </div>
          <span className="status-chip live">MVP</span>
        </nav>

        <header className="hero-row landing-hero">
          <div className="hero-copy">
            <p className="eyebrow">Creator-controlled AI fan chat</p>
            <h1>
              Launch a <span>persona</span> with its own fan URL
            </h1>
            <p>
              A real product shell for creators: signup, content training, approval, guardrails, optional paywall,
              analytics, and a separate public page where fans chat once the persona is live.
            </p>
            <div className="hero-actions">
              <Link className="primary-btn" href="/creator">
                Open creator portal
              </Link>
              <Link className="secondary-btn" href="/p/chirag">
                Preview fan URL
              </Link>
            </div>
          </div>
          <div className="creator-poster">
            <div className="poster-card">
              <div className="avatar-cutout">AI</div>
              <div className="poster-label">/p/creator</div>
            </div>
            <div className="scribble-arrow">↝</div>
          </div>
        </header>
      </section>
    </main>
  );
}
