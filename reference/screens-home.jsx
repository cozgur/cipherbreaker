// Home, Onboarding, Matchmaking, Secret Setup screens

function HomeScreen() {
  return (
    <CBScreen>
      <CBStatusBar />
      {/* Top bar */}
      <div style={{ position: 'relative', padding: '60px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CBAvatar name="Nova" size={36}/>
          <div style={{ fontFamily: CB.fBody, fontSize: 13, fontWeight: 500, color: CB.text }}>nova_code</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CBTokenBadge amount="1,840" size="sm"/>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: CB.bgElevated, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${CB.borderSubtle}` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CB.textSec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9 1.65 1.65 0 0 0 4.27 7.18l-.06-.06A2 2 0 1 1 7.04 4.29l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </div>
        </div>
      </div>

      {/* Title */}
      <div style={{ padding: '28px 20px 20px', textAlign: 'center' }}>
        <div style={{
          fontFamily: CB.fDisplay, fontWeight: 700, fontSize: 30,
          color: CB.text, letterSpacing: '-0.02em',
          textShadow: `0 0 24px ${cbHexA(CB.violet, 0.6)}`,
        }}>CipherBreaker</div>
      </div>

      {/* Mode list */}
      <div style={{ padding: '0 16px 120px', overflowY: 'auto', height: 'calc(100% - 200px)' }}>
        <div style={{ marginBottom: 10 }}><CBSectionLabel>CLASSIC</CBSectionLabel></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MODES.filter(m => m.tier === 'CLASSIC').map(m => <ModeCard key={m.id} mode={m}/>)}
        </div>
        <div style={{ marginTop: 22, marginBottom: 10 }}>
          <CBSectionLabel color={CB.pink}>ADVANCED</CBSectionLabel>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MODES.filter(m => m.tier === 'ADVANCED').map(m => <ModeCard key={m.id} mode={m}/>)}
        </div>

        {/* Level bar */}
        <div style={{ marginTop: 28, padding: '14px 16px', background: CB.bgElevated, border: `1px solid ${CB.borderSubtle}`, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <CBSectionLabel>LEVEL 12</CBSectionLabel>
            <span style={{ fontFamily: CB.fBody, fontSize: 12, color: CB.textSec }}>2,340 / 3,200 XP</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: cbHexA(CB.gold, 0.15), overflow: 'hidden' }}>
            <div style={{ width: '73%', height: '100%', background: `linear-gradient(90deg, ${CB.goldDeep}, ${CB.gold})`, boxShadow: `0 0 12px ${CB.goldGlow}` }}/>
          </div>
        </div>
      </div>

      <CBHomeIndicator/>
    </CBScreen>
  );
}

function ModeCard({ mode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      height: 96, padding: '14px 14px',
      background: CB.bgElevated, border: `1px solid ${CB.borderSubtle}`,
      borderRadius: 16,
      position: 'relative', overflow: 'hidden',
      boxShadow: `0 2px 8px rgba(0,0,0,0.3)`,
    }}>
      {/* Icon badge */}
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: `linear-gradient(140deg, ${mode.gradient[0]}, ${mode.gradient[1]})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 24px ${cbHexA(mode.gradient[0], 0.45)}, inset 0 1px 0 rgba(255,255,255,0.2)`,
        flexShrink: 0,
      }}>
        <ModeIcon id={mode.id} size={40}/>
      </div>
      {/* Middle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontFamily: CB.fDisplay, fontSize: 18, fontWeight: 700, color: CB.text, letterSpacing: '-0.01em' }}>{mode.name}</div>
          {mode.badge && <CBTag color={mode.badge.color}>{mode.badge.label}</CBTag>}
        </div>
        <div style={{ fontFamily: CB.fBody, fontSize: 12, fontWeight: 400, color: CB.textSec, lineHeight: 1.35 }}>{mode.desc}</div>
      </div>
      {/* Right */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CBCoin size={14}/>
          <span style={{ fontFamily: CB.fMono, fontSize: 14, fontWeight: 700, color: CB.gold }}>{mode.cost}</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={CB.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l4 4-4 4"/></svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Onboarding
// ─────────────────────────────────────────────────────────────
function OnboardingScreen({ step = 1 }) {
  const items = [
    { title: 'Crack the code.\nBeat your rival.', sub: 'A 4-digit secret. One mind against yours. Three ways to play.' },
    { title: 'Win tokens.\nClimb the ranks.', sub: 'Every match raises the stakes. Every win raises your level.' },
    { title: 'You start with\n500 tokens.', sub: 'Let\u2019s play.' },
  ];
  const item = items[step - 1];
  return (
    <CBScreen ambientIntensity={0.25}>
      <CBStatusBar/>
      {/* Illustration */}
      <div style={{ paddingTop: 90, display: 'flex', justifyContent: 'center', height: 340 }}>
        <OnboardIllustration step={step}/>
      </div>

      {/* Text */}
      <div style={{ padding: '20px 28px 0', textAlign: 'center' }}>
        <div style={{
          fontFamily: CB.fDisplay, fontWeight: 700, fontSize: 30,
          color: CB.text, letterSpacing: '-0.02em', lineHeight: 1.1,
          whiteSpace: 'pre-line',
          textShadow: `0 0 20px ${cbHexA(CB.violet, 0.4)}`,
        }}>{item.title}</div>
        <div style={{ marginTop: 16, fontFamily: CB.fBody, fontSize: 14, color: CB.textSec, lineHeight: 1.5 }}>{item.sub}</div>
      </div>

      {/* Bottom */}
      <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, padding: '0 24px', zIndex: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              width: i === step ? 22 : 6, height: 6, borderRadius: 3,
              background: i === step ? CB.violet : cbHexA(CB.violet, 0.25),
              boxShadow: i === step ? `0 0 10px ${cbHexA(CB.violet, 0.6)}` : 'none',
              transition: 'all .25s',
            }}/>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{
            flex: 1, height: 50, background: 'transparent', border: `1px solid ${CB.borderSubtle}`,
            borderRadius: 16, color: CB.textSec, fontFamily: CB.fBody, fontSize: 14, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>Skip</button>
          <CBButton style={{ flex: 1.6 }}>{step === 3 ? 'Start Playing' : 'Next'}</CBButton>
        </div>
      </div>

      <CBHomeIndicator/>
    </CBScreen>
  );
}

function OnboardIllustration({ step }) {
  if (step === 1) {
    // Stylized locked safe with glowing digits
    return (
      <svg width="240" height="300" viewBox="0 0 240 300">
        <defs>
          <linearGradient id="safe" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2a2c54"/>
            <stop offset="1" stopColor="#15172e"/>
          </linearGradient>
          <radialGradient id="glow1" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.6"/>
            <stop offset="1" stopColor="#8b5cf6" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="120" cy="160" r="140" fill="url(#glow1)"/>
        <rect x="40" y="60" width="160" height="200" rx="20" fill="url(#safe)" stroke="#3a3c6e" strokeWidth="1.5"/>
        <rect x="60" y="80" width="120" height="80" rx="10" fill="#0a0b1e" stroke="#2a2c54"/>
        {['7','3','1','9'].map((d, i) => (
          <g key={i}>
            <rect x={68 + i*28} y="94" width="22" height="52" rx="4" fill="#15172e" stroke="#4c1d95"/>
            <text x={79 + i*28} y="130" textAnchor="middle" fontFamily='"JetBrains Mono"' fontSize="22" fontWeight="700" fill="#8b5cf6" style={{ filter: 'drop-shadow(0 0 4px #8b5cf6)' }}>{d}</text>
          </g>
        ))}
        <circle cx="120" cy="215" r="30" fill="#0a0b1e" stroke="#8b5cf6" strokeWidth="2"/>
        <circle cx="120" cy="215" r="20" fill="none" stroke="#a78bfa" strokeWidth="1.5"/>
        <circle cx="120" cy="215" r="4" fill="#fbbf24"/>
        <path d="M120 195 L125 200 L115 200 Z" fill="#fbbf24"/>
      </svg>
    );
  }
  if (step === 2) {
    // Radar sweeping
    return (
      <svg width="260" height="300" viewBox="0 0 260 300">
        <defs>
          <radialGradient id="rglow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#06b6d4" stopOpacity="0.3"/>
            <stop offset="1" stopColor="#06b6d4" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="scan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8b5cf6" stopOpacity="0"/>
            <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.8"/>
          </linearGradient>
        </defs>
        <circle cx="130" cy="150" r="150" fill="url(#rglow)"/>
        {[120,90,60,30].map(r => (
          <circle key={r} cx="130" cy="150" r={r} fill="none" stroke="#8b5cf6" strokeWidth="1" opacity={0.2 + (120-r)*0.004}/>
        ))}
        <path d="M130 150 L250 90 A130 130 0 0 0 130 20 Z" fill="url(#scan)" opacity="0.5"/>
        <circle cx="130" cy="150" r="6" fill="#8b5cf6"/>
        <circle cx="180" cy="110" r="5" fill="#ec4899"/>
        <circle cx="85" cy="190" r="4" fill="#06b6d4"/>
        <circle cx="195" cy="180" r="3" fill="#fbbf24"/>
      </svg>
    );
  }
  // step 3 — token cascade
  return (
    <svg width="260" height="300" viewBox="0 0 260 300">
      <defs>
        <radialGradient id="gc" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fbbf24" stopOpacity="0.45"/>
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="130" cy="160" r="150" fill="url(#gc)"/>
      {[[60,50,20],[130,30,28],[200,60,22],[90,110,26],[170,120,24],[60,180,22],[130,160,34],[200,190,20],[90,240,24],[170,250,22]].map((c, i) => (
        <g key={i} transform={`translate(${c[0]}, ${c[1]})`}>
          <circle r={c[2]} fill="url(#cbcoin-big)"/>
          <circle r={c[2] - 4} fill="none" stroke="#78350f" strokeWidth="0.8" opacity="0.6"/>
          <text y={c[2]*0.35} textAnchor="middle" fontFamily='"Chakra Petch"' fontSize={c[2]*0.9} fontWeight="900" fill="#78350f">C</text>
        </g>
      ))}
      <defs>
        <radialGradient id="cbcoin-big" cx="0.35" cy="0.3">
          <stop offset="0" stopColor="#fde68a"/>
          <stop offset="0.6" stopColor="#fbbf24"/>
          <stop offset="1" stopColor="#b45309"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Matchmaking
// ─────────────────────────────────────────────────────────────
function MatchmakingScreen({ resolved = false }) {
  return (
    <CBScreen ambientIntensity={0.22}>
      <CBStatusBar/>
      <div style={{ position: 'absolute', top: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <CBTag color={CB.violet}>MATCHMAKING</CBTag>
      </div>

      {/* Radar */}
      <div style={{ position: 'absolute', top: 130, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <svg width="260" height="260" viewBox="0 0 260 260">
          <defs>
            <radialGradient id="mmglow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.25"/>
              <stop offset="1" stopColor="#8b5cf6" stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="mmscan" x1="0" y1="0.5" x2="1" y2="0.5">
              <stop offset="0" stopColor="#8b5cf6" stopOpacity="0"/>
              <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.65"/>
            </linearGradient>
          </defs>
          <circle cx="130" cy="130" r="125" fill="url(#mmglow)"/>
          {[30,60,90,120].map((r, i) => (
            <circle key={r} cx="130" cy="130" r={r} fill="none" stroke="#8b5cf6" strokeWidth="1" opacity={0.4 - i*0.07}>
              <animate attributeName="r" values={`${r};${r+30};${r+60}`} dur="3s" begin={`${i*0.4}s`} repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.5;0.15;0" dur="3s" begin={`${i*0.4}s`} repeatCount="indefinite"/>
            </circle>
          ))}
          <g transform="translate(130,130)">
            <g>
              <path d="M0 0 L120 0 A120 120 0 0 0 60 -104 Z" fill="url(#mmscan)"/>
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2.8s" repeatCount="indefinite"/>
            </g>
          </g>
          <circle cx="130" cy="130" r="4" fill="#fff"/>
          <circle cx="130" cy="130" r="10" fill="none" stroke="#8b5cf6" strokeWidth="1.5"/>
          <circle cx="178" cy="92" r="3" fill="#ec4899" opacity="0.7"/>
          <circle cx="88" cy="170" r="2.5" fill="#06b6d4" opacity="0.6"/>
          <circle cx="192" cy="165" r="2" fill="#fbbf24" opacity="0.5"/>
        </svg>
      </div>

      <div style={{ position: 'absolute', top: 420, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ fontFamily: CB.fDisplay, fontSize: 22, fontWeight: 700, color: CB.text, letterSpacing: '-0.01em' }}>
          Searching for opponent<span style={{ color: CB.violet }}>...</span>
        </div>
        <div style={{ marginTop: 10, fontFamily: CB.fBody, fontSize: 13, color: CB.textSec }}>Matching by skill level</div>
      </div>

      {/* Opponent card (resolved state) */}
      {resolved && (
        <div style={{ position: 'absolute', bottom: 120, left: 24, right: 24 }}>
          <CBGlassCard p={18}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <CBAvatar name="Shadow" size={56}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: CB.fDisplay, fontSize: 20, fontWeight: 700, color: CB.text }}>shadowHunter47</div>
                <div style={{ fontFamily: CB.fBody, fontSize: 12, color: CB.textSec, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Lv. 23 · 🇩🇪 · <span style={{ color: CB.success, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: CB.success, boxShadow: `0 0 6px ${CB.success}` }}/>Online</span>
                </div>
              </div>
              <div style={{ fontFamily: CB.fDisplay, fontSize: 22, fontWeight: 700, color: CB.pink, transform: 'rotate(-6deg)' }}>VS</div>
            </div>
          </CBGlassCard>
        </div>
      )}

      <CBHomeIndicator/>
    </CBScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// Secret Setup
// ─────────────────────────────────────────────────────────────
function SecretSetupScreen({ filled = [4, 7, 1, null] }) {
  return (
    <CBScreen>
      <CBStatusBar/>
      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '60px 20px 12px' }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: CB.bgElevated, border: `1px solid ${CB.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={CB.textSec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3L5 7l4 4"/></svg>
        </div>
        <CBTag color={CB.violet}>MODE 1 · COLOR MATCH</CBTag>
      </div>

      <div style={{ padding: '20px 24px 0', textAlign: 'center' }}>
        <div style={{ fontFamily: CB.fDisplay, fontSize: 24, fontWeight: 700, color: CB.text }}>Choose Your Secret Code</div>
        <div style={{ fontFamily: CB.fBody, fontSize: 14, color: CB.textSec, marginTop: 8 }}>Your opponent will try to crack this.</div>
      </div>

      {/* Digits */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 40 }}>
        {filled.map((d, i) => (
          <CBDigitTile key={i} digit={d} state={d != null ? 'violet' : 'neutral'} size={62}/>
        ))}
      </div>

      {/* Keypad */}
      <div style={{ position: 'absolute', bottom: 110, left: 0, right: 0, padding: '0 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          {[1,2,3,4,5,6,7,8,9].map(n => <KeypadKey key={n} val={n}/>)}
          <div/>
          <KeypadKey val={0}/>
          <KeypadKey icon={<svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke={CB.textSec} strokeWidth="1.8"><path d="M7 1h13a2 2 0 012 2v10a2 2 0 01-2 2H7l-6-7 6-7z"/><path d="M11 5l6 6M17 5l-6 6"/></svg>}/>
        </div>
        <CBButton size="lg" style={{ opacity: filled.every(v => v != null) ? 1 : 0.45 }}>Lock In Code</CBButton>
      </div>

      <CBHomeIndicator/>
    </CBScreen>
  );
}

function KeypadKey({ val, icon }) {
  return (
    <div style={{
      height: 52, borderRadius: 14,
      background: CB.bgElevated,
      border: `1px solid ${CB.borderSubtle}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: CB.fMono, fontSize: 22, fontWeight: 700, color: CB.text,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {icon || val}
    </div>
  );
}

Object.assign(window, { HomeScreen, ModeCard, OnboardingScreen, MatchmakingScreen, SecretSetupScreen });
