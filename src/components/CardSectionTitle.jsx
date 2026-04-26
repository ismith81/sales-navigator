import React, { useState } from 'react';

// Herbruikbare section-titel voor de Gids-cards (Onderwerp / Team / Cases /
// straks ook andere). Twee modes:
//   - Statisch:  <CardSectionTitle icon={...}>Cases</CardSectionTitle>
//   - Collapsible: { collapsibleKey, defaultCollapsed } → renderprop voor body
//
// Wanneer collapsibleKey gegeven is, persistent de open/dicht-state in
// localStorage zodat 't toggle-gedrag refreshes overleeft. Returnt
// optioneel een tweede element (de body) zodat de aanroeper wéét of-ie de
// content moet renderen.
//
// Voorbeeld:
//   const { titleEl, isOpen } = useCardSection('team', false);
//   return <>{titleEl(<><Icon/>Team</>)}{isOpen && <Body/>}</>;
//
// Voor de drie cards (Team, Cases, Topic) is 't pattern: render titel met
// chevron + alleen-content-renderen-als-open. Hieronder een hook die dat
// state-deel afhandelt.

export function useCollapsibleSection(storageKey, defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(() => {
    if (!storageKey) return defaultCollapsed;
    try {
      const v = localStorage.getItem(`sn.collapse.${storageKey}`);
      if (v === 'true') return true;
      if (v === 'false') return false;
    } catch {}
    return defaultCollapsed;
  });
  const setAndPersist = (next) => {
    setCollapsed(next);
    if (storageKey) {
      try { localStorage.setItem(`sn.collapse.${storageKey}`, String(next)); } catch {}
    }
  };
  const toggle = () => setAndPersist(!collapsed);
  return { collapsed, setCollapsed: setAndPersist, toggle };
}

// Een SVG chevron die roteert via CSS-class. Sluit aan bij persona-kompas
// chevron qua look.
function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Component-vorm: rendert een titel-rij met icoon, label, optionele
// count-pill en (als collapsible) een chevron + click-handler.
export default function CardSectionTitle({
  icon,
  label,
  count,
  collapsible = false,
  collapsed = false,
  onToggle,
}) {
  const Tag = collapsible ? 'button' : 'h2';
  const props = collapsible
    ? {
        type: 'button',
        onClick: onToggle,
        'aria-expanded': !collapsed,
      }
    : {};
  return (
    <Tag
      className={`card-section-title ${collapsed ? 'is-collapsed' : ''}`}
      {...props}
    >
      {icon && <span className="card-section-title-icon" aria-hidden="true">{icon}</span>}
      <span className="card-section-title-label">{label}</span>
      {count !== undefined && count !== null && (
        <span className="card-section-title-count">{count}</span>
      )}
      {collapsible && (
        <span className="card-section-title-chevron" aria-hidden="true">
          <Chevron />
        </span>
      )}
    </Tag>
  );
}
