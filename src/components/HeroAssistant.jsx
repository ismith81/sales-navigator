import React from 'react';

// Empty-state hero die de chat-assistent als primaire entry point positioneert.
// Toont alleen als er geen filter/zoekopdracht actief is én de gebruiker 'm niet gesloten heeft.
// Drempel-verlagend: drie quick-prompts die 1-klik een gesprek starten.

const QUICK_PROMPTS = [
  'Welke cases passen bij AI ready?',
  'Bereid CFO-gesprek voor over dataplatform-migratie',
  'Wat zijn goede vervolgvragen bij realtime data?',
];

export default function HeroAssistant({ onAsk, onQuickPrompt, onDismiss }) {
  return (
    <section className="hero-assistant" aria-label="Sales assistent">
      <button
        type="button"
        className="hero-assistant-close"
        onClick={onDismiss}
        aria-label="Sluiten"
        title="Sluiten"
      >✕</button>

      <span className="hero-assistant-eyebrow">
        <span className="hero-assistant-eyebrow-dot" aria-hidden="true" />
        Nieuw
      </span>

      <h2 className="hero-assistant-title">Niet zeker waar te beginnen?</h2>
      <p className="hero-assistant-sub">
        Vraag het de assistent. Hij doorzoekt alle cases, talking points en persona-coaching voor je.
      </p>

      <button type="button" className="hero-assistant-cta" onClick={onAsk}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Stel een vraag
      </button>

      <div className="hero-assistant-prompts">
        <span className="hero-assistant-prompts-label">Of probeer:</span>
        {QUICK_PROMPTS.map(q => (
          <button
            key={q}
            type="button"
            className="hero-assistant-prompt"
            onClick={() => onQuickPrompt(q)}
          >
            <span>{q}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    </section>
  );
}
