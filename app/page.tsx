import Link from "next/link";

const steps = [
  "Sign up as creator",
  "Upload content",
  "Review AI persona",
  "Set guardrails",
  "Publish fan link",
];

export default function Home() {
  return (
    <main className="site-shell">
      <nav className="landing-nav">
        <Link href="/" className="wordmark">
          Persona Studio
        </Link>
        <div>
          <Link href="#how">How it works</Link>
          <Link href="#safety">Safety</Link>
          <Link href="/creator">Creator signup</Link>
        </div>
      </nav>

      <section className="landing-hero-pro">
        <div className="hero-copy-pro">
          <span className="section-kicker">AI fan engagement for creators and celebs</span>
          <h1>Create an AI persona fans can chat with from your Instagram bio.</h1>
          <p>
            Persona Studio gives creators a controlled way to turn approved content into a fan-facing AI chat
            experience, with Supabase login, clear disclosure, strict guardrails, and a shareable public link.
          </p>
          <div className="cta-row">
            <Link href="/creator" className="primary-action">
              Start creator signup
            </Link>
            <Link href="/p/chirag" className="secondary-action">
              Preview fan chat
            </Link>
          </div>
        </div>

        <div className="hero-product-shot">
          <div className="mock-browser">
            <div className="browser-bar">
              <span />
              <span />
              <span />
              <strong>persona.studio/p/chirag</strong>
            </div>
            <div className="mock-chat">
              <div className="creator-bio">
                <div className="avatar-ring">CS</div>
                <div>
                  <strong>Chirag&apos;s AI Persona</strong>
                  <p>Creator economy, AI products, product strategy</p>
                </div>
              </div>
              <div className="bubble fan">How should I build a creator product?</div>
              <div className="bubble ai">
                Real talk, start with trust, repeat engagement, and a clear reason fans come back.
              </div>
              <div className="guardrail-strip">AI disclosed · Guardrails active · Creator approved</div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="landing-section">
        <div className="section-head">
          <span className="section-kicker">Workflow</span>
          <h2>From signup to share link in five guided steps.</h2>
        </div>
        <div className="step-cards">
          {steps.map((step, index) => (
            <div key={step} className="landing-card">
              <span>{index + 1}</span>
              <h3>{step}</h3>
              <p>
                {index === 0 && "Creators enter basic profile details and accept content ownership terms."}
                {index === 1 && "They paste captions, transcripts, notes, or writing samples for V0."}
                {index === 2 && "The system produces topics, tone, and recurring phrases for approval."}
                {index === 3 && "Risky categories and custom off-limits topics are locked in before launch."}
                {index === 4 && "Once live, the creator gets a fan chat URL to place in their IG bio."}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="safety" className="landing-section split-section">
        <div>
          <span className="section-kicker">Creator control</span>
          <h2>Built for real identities, not anonymous bots.</h2>
          <p>
            The persona only uses creator-provided content, opens every chat with an AI disclosure, refuses risky
            categories, and logs flagged interactions for review.
          </p>
        </div>
        <div className="safety-list">
          <div>Fixed AI disclosure</div>
          <div>Creator-approved fallback</div>
          <div>Pause / unpublish control</div>
              <div>Logged-in fan conversations</div>
              <div>Flagged interaction dashboard</div>
        </div>
      </section>
    </main>
  );
}
