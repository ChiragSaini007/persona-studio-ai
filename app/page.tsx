import Link from "next/link";

const steps = [
  "Create the account",
  "Add approved content",
  "Shape the persona",
  "Lock the boundaries",
  "Share the fan link",
];

export default function Home() {
  return (
    <main className="site-shell">
      <nav className="landing-nav">
        <Link href="/" className="wordmark">
          Persona Studio
        </Link>
        <div>
          <Link href="#how">Workflow</Link>
          <Link href="#safety">Trust</Link>
          <Link href="/creator">Start</Link>
        </div>
      </nav>

      <section className="landing-hero-pro">
        <div className="hero-copy-pro">
          <span className="section-kicker">AI fan chat for creators and public figures</span>
          <h1>Turn your voice into a fan chat link.</h1>
          <p>
            Persona Studio helps creators launch an AI persona trained on approved content, reviewed in their own
            words, and shared as a simple link for Instagram bios, stories, and fan communities.
          </p>
          <div className="cta-row">
            <Link href="/creator" className="primary-action">
              Create your persona
            </Link>
            <Link href="/p/chirag" className="secondary-action">
              See a fan link
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
                  <strong>Chirag&apos;s AI</strong>
                  <p>Approved topics, tone, and boundaries</p>
                </div>
              </div>
              <div className="bubble fan">What should I focus on this week?</div>
              <div className="bubble ai">
                Keep it simple: one promise, one audience, one reason people come back.
              </div>
              <div className="guardrail-strip">AI disclosed · Creator approved · Guardrails active</div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="landing-section">
        <div className="section-head">
          <span className="section-kicker">Creator workflow</span>
          <h2>Launch only after the persona feels right.</h2>
        </div>
        <div className="step-cards">
          {steps.map((step, index) => (
            <div key={step} className="landing-card">
              <span>{index + 1}</span>
              <h3>{step}</h3>
              <p>
                {index === 0 && "Sign up with the public name and handle fans will recognize."}
                {index === 1 && "Paste captions, transcripts, interviews, notes, or writing samples you approve."}
                {index === 2 && "Review the tone, topics, and recurring phrases before anything goes public."}
                {index === 3 && "Set safety rules, off-limits topics, and the fallback response."}
                {index === 4 && "Publish a clean chat URL for Instagram, Linktree, stories, or communities."}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="safety" className="landing-section split-section">
        <div>
          <span className="section-kicker">Trust layer</span>
          <h2>Designed for reputations, not throwaway bots.</h2>
          <p>
            Every persona starts with clear AI disclosure, stays inside creator-approved material, refuses risky or
            off-brand prompts, and gives creators a way to pause the experience if something needs attention.
          </p>
        </div>
        <div className="safety-list">
          <div>Clear AI disclosure</div>
          <div>Approved source content only</div>
          <div>Creator-owned fallback response</div>
          <div>Logged-in fan conversations</div>
          <div>Flagged interaction review</div>
        </div>
      </section>
    </main>
  );
}
