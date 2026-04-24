// Mode icons (circular badge fills) + mode metadata

const MODES = [
  { id: 1, name: 'COLOR MATCH', desc: 'Green, yellow, gray — Wordle-style feedback.', cost: 50, tier: 'CLASSIC', gradient: ['#06b6d4', '#8b5cf6'] },
  { id: 2, name: 'HIGH & LOW', desc: 'One hint: is the secret higher or lower?', cost: 50, tier: 'CLASSIC', gradient: ['#8b5cf6', '#ec4899'] },
  { id: 3, name: 'PRECISION', desc: '+1 for right spot, −1 for wrong spot.', cost: 50, tier: 'CLASSIC', gradient: ['#fbbf24', '#ea580c'] },
  { id: 4, name: 'BLITZ', desc: 'Chess clock. 60 seconds each. Don\u2019t flag.', cost: 50, tier: 'ADVANCED', badge: { label: '⏱ TIMED', color: '#f97316' }, gradient: ['#ef4444', '#f97316'] },
  { id: 5, name: 'BLACKOUT', desc: 'Only locked-in digits revealed. High stakes.', cost: 100, tier: 'ADVANCED', badge: { label: 'PRESTIGE', color: '#ec4899' }, gradient: ['#5b21b6', '#0a0b1e'] },
  { id: 6, name: 'SUDDEN DEATH', desc: 'Five guesses. No second chances.', cost: 50, tier: 'ADVANCED', badge: { label: 'HIGH RISK', color: '#dc2626' }, gradient: ['#7f1d1d', '#dc2626'] },
  { id: 7, name: 'MIRROR', desc: 'Same code, different minds. First to crack wins.', cost: 75, tier: 'ADVANCED', badge: { label: 'SOLO RACE', color: '#14b8a6' }, gradient: ['#14b8a6', '#94a3b8'] },
];

function ModeIcon({ id, size = 44 }) {
  const s = size;
  if (id === 1) {
    // overlapping green/yellow/gray dots
    return (
      <svg width={s} height={s} viewBox="0 0 44 44">
        <circle cx="14" cy="22" r="9" fill="#10b981"/>
        <circle cx="22" cy="22" r="9" fill="#f59e0b"/>
        <circle cx="30" cy="22" r="9" fill="#5a5a7a" opacity="0.85"/>
      </svg>
    );
  }
  if (id === 2) {
    return (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 8l-7 7h14l-7-7z" fill="#fff"/>
        <path d="M22 36l7-7H15l7 7z" fill="#fff"/>
      </svg>
    );
  }
  if (id === 3) {
    return (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
        <path d="M10 15h10M15 10v10"/>
        <path d="M24 29h10"/>
      </svg>
    );
  }
  if (id === 4) {
    return (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="22" cy="24" r="12"/>
        <path d="M22 17v7l4 3"/>
        <path d="M18 8h8M22 8v4"/>
      </svg>
    );
  }
  if (id === 5) {
    return (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 14c-6 0-11 8-11 8s5 8 11 8 11-8 11-8-5-8-11-8z"/>
        <circle cx="22" cy="22" r="3.2" fill="#fff"/>
        <path d="M10 10l24 24" stroke="#fff" strokeWidth="2.5"/>
      </svg>
    );
  }
  if (id === 6) {
    return (
      <svg width={s} height={s} viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="13" fill="none" stroke="#fff" strokeWidth="2.2"/>
        <text x="22" y="28" textAnchor="middle" fontFamily='"Chakra Petch", sans-serif' fontSize="17" fontWeight="900" fill="#fff">5</text>
      </svg>
    );
  }
  if (id === 7) {
    return (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 14h20l-4-4M8 14l4 4"/>
        <path d="M36 30H16l4-4M36 30l-4 4"/>
      </svg>
    );
  }
  return null;
}

Object.assign(window, { MODES, ModeIcon });
