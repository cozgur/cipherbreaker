// Shared CipherBreaker design tokens + primitives (Neo-Noir Casino Arcade)

const CB = {
  // base
  bgBase: '#0a0b1e',
  bgElevated: '#15172e',
  bgOverlay: '#1f2142',
  // accent
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  // currency
  gold: '#fbbf24',
  goldDeep: '#d97706',
  goldGlow: 'rgba(251,191,36,0.4)',
  // semantic
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  // text
  text: '#f5f5f7',
  textSec: '#a1a1b5',
  textDim: '#5a5a7a',
  // border
  borderSubtle: '#2a2c54',
  borderBright: '#8b5cf6',

  // fonts
  fDisplay: '"Chakra Petch", system-ui, sans-serif',
  fBody: '"Inter", system-ui, sans-serif',
  fMono: '"JetBrains Mono", ui-monospace, monospace',
};

// Subtle grain overlay (2%) via SVG noise — sits above bg gradient, under content
function CBGrain({ opacity = 0.02 }) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
  const url = `url("data:image/svg+xml;utf8,${svg.replace(/#/g, '%23')}")`;
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage: url, opacity, mixBlendMode: 'overlay', zIndex: 3,
    }} />
  );
}

// Ambient radial gradient from top (violet tint fading to bg-base)
function CBAmbient({ tint = CB.violet, intensity = 0.18 }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
      background: `radial-gradient(120% 60% at 50% 0%, ${hexA(tint, intensity)} 0%, transparent 60%), linear-gradient(180deg, ${CB.bgBase} 0%, #070816 100%)`,
    }} />
  );
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// The standard phone-wrapping background (for all screens)
function CBScreen({ children, ambient = CB.violet, ambientIntensity = 0.18, style = {} }) {
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: CB.bgBase, color: CB.text,
      fontFamily: CB.fBody,
      overflow: 'hidden',
      ...style,
    }}>
      <CBAmbient tint={ambient} intensity={ambientIntensity} />
      <CBGrain />
      <div style={{ position: 'relative', zIndex: 5, width: '100%', height: '100%' }}>
        {children}
      </div>
    </div>
  );
}

// Uppercase tiny tag pill
function CBTag({ children, color = CB.violet, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: CB.fBody, fontSize: 10, fontWeight: 600,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      color, background: bg || hexA(color, 0.12),
      padding: '3px 8px', borderRadius: 999,
      border: `1px solid ${hexA(color, 0.35)}`,
      lineHeight: 1,
    }}>{children}</span>
  );
}

// Token badge (gold pill)
function CBTokenBadge({ amount, size = 'md' }) {
  const sz = size === 'sm' ? { px: 8, py: 4, fs: 12, dot: 14 }
           : size === 'lg' ? { px: 14, py: 8, fs: 18, dot: 20 }
           : { px: 10, py: 5, fs: 14, dot: 16 };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: `${sz.py}px ${sz.px + 2}px ${sz.py}px ${sz.px - 2}px`,
      borderRadius: 999,
      background: 'linear-gradient(180deg, rgba(251,191,36,0.15), rgba(217,119,6,0.08))',
      border: `1px solid ${hexA(CB.gold, 0.45)}`,
      boxShadow: `0 0 18px ${CB.goldGlow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
    }}>
      <CBCoin size={sz.dot} />
      <span style={{
        fontFamily: CB.fMono, fontSize: sz.fs, fontWeight: 700,
        color: CB.gold, letterSpacing: '0.02em',
      }}>{amount}</span>
    </div>
  );
}

function CBCoin({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <defs>
        <radialGradient id={`cg${size}`} cx="35%" cy="30%">
          <stop offset="0%" stopColor="#fde68a"/>
          <stop offset="60%" stopColor="#fbbf24"/>
          <stop offset="100%" stopColor="#b45309"/>
        </radialGradient>
      </defs>
      <circle cx="10" cy="10" r="9" fill={`url(#cg${size})`} stroke="#78350f" strokeWidth="0.6"/>
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="#78350f" strokeWidth="0.6" opacity="0.5"/>
      <text x="10" y="13.5" textAnchor="middle" fontFamily='"Chakra Petch", sans-serif' fontSize="8.5" fontWeight="900" fill="#78350f">C</text>
    </svg>
  );
}

// Primary button (violet)
function CBButton({ children, variant = 'primary', full = true, size = 'md', icon, style = {}, onClick }) {
  const sz = size === 'lg' ? { h: 56, fs: 15, px: 24 } : { h: 50, fs: 14, px: 22 };
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: sz.h, padding: `0 ${sz.px}px`, width: full ? '100%' : 'auto',
    borderRadius: 16, border: 'none', cursor: 'pointer',
    fontFamily: CB.fBody, fontSize: sz.fs, fontWeight: 600,
    letterSpacing: '0.08em', textTransform: 'uppercase',
  };
  let look = {};
  if (variant === 'primary') {
    look = {
      background: `linear-gradient(180deg, ${CB.violet}, #6d28d9)`,
      color: '#fff',
      boxShadow: `0 4px 20px ${hexA(CB.violet, 0.45)}, inset 0 1px 0 rgba(255,255,255,0.2)`,
      border: `1px solid ${hexA(CB.violet, 0.8)}`,
    };
  } else if (variant === 'cyan') {
    look = {
      background: `linear-gradient(180deg, ${CB.cyan}, #0891b2)`,
      color: '#fff',
      boxShadow: `0 4px 20px ${hexA(CB.cyan, 0.4)}, inset 0 1px 0 rgba(255,255,255,0.2)`,
    };
  } else if (variant === 'gold') {
    look = {
      background: `linear-gradient(180deg, ${CB.gold}, ${CB.goldDeep})`,
      color: '#1a1205',
      boxShadow: `0 4px 20px ${CB.goldGlow}`,
    };
  } else if (variant === 'outline') {
    look = {
      background: 'transparent', color: CB.text,
      border: `1px solid ${CB.borderSubtle}`,
    };
  } else if (variant === 'ghost') {
    look = { background: hexA(CB.violet, 0.12), color: CB.violet, border: `1px solid ${hexA(CB.violet, 0.3)}` };
  } else if (variant === 'danger') {
    look = {
      background: `linear-gradient(180deg, ${CB.danger}, #b91c1c)`,
      color: '#fff',
    };
  }
  return (
    <button onClick={onClick} style={{ ...base, ...look, ...style }}>
      {icon}{children}
    </button>
  );
}

// Avatar (colored circle with initial)
function CBAvatar({ name = 'You', size = 40, colors }) {
  const palette = [
    ['#a78bfa', '#6d28d9'], ['#22d3ee', '#0e7490'], ['#f472b6', '#be185d'],
    ['#fbbf24', '#b45309'], ['#34d399', '#047857'], ['#fb7185', '#be123c'],
    ['#60a5fa', '#1e40af'], ['#c084fc', '#7e22ce'],
  ];
  const seed = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [c1, c2] = colors || palette[seed % palette.length];
  const initial = (name || '?')[0].toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(140deg, ${c1}, ${c2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: CB.fDisplay, fontWeight: 700, fontSize: size * 0.42, color: '#fff',
      boxShadow: `0 2px 10px ${hexA(c2, 0.5)}, inset 0 1px 0 rgba(255,255,255,0.2)`,
      flexShrink: 0,
    }}>{initial}</div>
  );
}

// Status bar — dark mode, white glyphs
function CBStatusBar({ time = '9:41' }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 54,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 28px 0', zIndex: 40, pointerEvents: 'none',
    }}>
      <span style={{ fontFamily: '-apple-system, SF Pro, system-ui', fontWeight: 600, fontSize: 15, color: '#fff' }}>{time}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.5" fill="#fff"/><rect x="4.5" y="5" width="3" height="6" rx="0.5" fill="#fff"/><rect x="9" y="2.5" width="3" height="8.5" rx="0.5" fill="#fff"/><rect x="13.5" y="0" width="3" height="11" rx="0.5" fill="#fff"/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" fill="none" stroke="#fff" strokeOpacity="0.5"/><rect x="2" y="2" width="18" height="7" rx="1.5" fill="#fff"/><rect x="22" y="3.5" width="1.5" height="4" rx="0.5" fill="#fff" opacity="0.5"/></svg>
      </div>
    </div>
  );
}

// Home indicator
function CBHomeIndicator({ light = true }) {
  return (
    <div style={{
      position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
      width: 134, height: 5, borderRadius: 3,
      background: light ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.3)',
      zIndex: 40,
    }} />
  );
}

// Dynamic island
function CBIsland() {
  return (
    <div style={{
      position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
      width: 120, height: 34, borderRadius: 20, background: '#000', zIndex: 50,
    }} />
  );
}

// Digit tile (for guess rows)
function CBDigitTile({ digit, state = 'neutral', size = 48, border }) {
  const palette = {
    neutral: { bg: CB.bgElevated, border: CB.borderSubtle, fg: CB.text, glow: 'none' },
    green:   { bg: 'rgba(16,185,129,0.18)', border: CB.success, fg: '#d1fae5', glow: `0 0 14px ${hexA(CB.success, 0.55)}` },
    yellow:  { bg: 'rgba(245,158,11,0.2)', border: CB.warning, fg: '#fde68a', glow: `0 0 10px ${hexA(CB.warning, 0.4)}` },
    gray:    { bg: 'rgba(90,90,122,0.2)', border: CB.textDim, fg: CB.textDim, glow: 'none' },
    violet:  { bg: 'rgba(139,92,246,0.15)', border: CB.violet, fg: '#ede9fe', glow: `0 0 12px ${hexA(CB.violet, 0.4)}` },
    blackout:{ bg: 'rgba(31,33,66,0.6)', border: '#4c1d95', fg: CB.text, glow: 'none' },
  };
  const p = palette[state] || palette.neutral;
  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      border: `1.5px solid ${border || p.border}`,
      background: p.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: CB.fMono, fontWeight: 700, fontSize: size * 0.48, color: p.fg,
      boxShadow: p.glow,
    }}>{digit ?? '—'}</div>
  );
}

// Glass card (modals/sheets)
function CBGlassCard({ children, style = {}, p = 24 }) {
  return (
    <div style={{
      background: 'rgba(31,33,66,0.6)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      border: `1px solid ${hexA('#ffffff', 0.08)}`,
      borderRadius: 24,
      padding: p,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
      ...style,
    }}>{children}</div>
  );
}

// Section label (Tiny uppercase)
function CBSectionLabel({ children, color = CB.textSec }) {
  return (
    <div style={{
      fontFamily: CB.fBody, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.14em', textTransform: 'uppercase',
      color,
    }}>{children}</div>
  );
}

// Inject Google Fonts once
if (typeof document !== 'undefined' && !document.getElementById('cb-fonts')) {
  const link = document.createElement('link');
  link.id = 'cb-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@700;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@700&display=swap';
  document.head.appendChild(link);
}

Object.assign(window, {
  CB, CBGrain, CBAmbient, CBScreen, CBTag, CBTokenBadge, CBCoin, CBButton,
  CBAvatar, CBStatusBar, CBHomeIndicator, CBIsland, CBDigitTile, CBGlassCard,
  CBSectionLabel, cbHexA: hexA,
});
