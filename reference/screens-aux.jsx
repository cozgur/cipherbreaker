// Shop, Ad Watch, Profile, Insufficient Tokens Modal

function ShopScreen() {
  const packs = [
    { amount: '500', price: '$0.99', ribbon: null, bonus: null },
    { amount: '1,500', price: '$2.99', ribbon: { label: 'MOST POPULAR', color: CB.pink }, bonus: null },
    { amount: '5,000', price: '$7.99', ribbon: null, bonus: '+40% BONUS' },
    { amount: '15,000', price: '$19.99', ribbon: { label: 'BEST VALUE', color: CB.gold }, bonus: '+60% BONUS' },
  ];
  return (
    <CBScreen ambient={CB.gold} ambientIntensity={0.16}>
      <CBStatusBar/>
      {/* Top bar */}
      <div style={{ padding: '58px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: CB.bgElevated, border: `1px solid ${CB.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={CB.textSec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3L5 7l4 4"/></svg>
        </div>
        <CBTokenBadge amount="1,840" size="sm"/>
      </div>

      <div style={{ padding: '18px 20px 6px' }}>
        <div style={{ fontFamily: CB.fDisplay, fontSize: 30, fontWeight: 700, color: CB.text, letterSpacing: '-0.02em' }}>Get Tokens</div>
        <div style={{ fontFamily: CB.fBody, fontSize: 14, color: CB.textSec, marginTop: 4 }}>Top up to keep playing.</div>
      </div>

      <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {packs.map((p, i) => <PackCard key={i} {...p}/>)}
      </div>

      <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center', padding: '0 24px', fontFamily: CB.fBody, fontSize: 11, color: CB.textDim, letterSpacing: '0.02em' }}>
        All purchases are final. Tokens have no cash value.
      </div>

      <CBHomeIndicator/>
    </CBScreen>
  );
}

function PackCard({ amount, price, ribbon, bonus }) {
  const isBest = ribbon && ribbon.label === 'BEST VALUE';
  return (
    <div style={{
      position: 'relative',
      padding: '16px 16px',
      background: CB.bgElevated,
      border: `1px solid ${isBest ? cbHexA(CB.gold, 0.6) : CB.borderSubtle}`,
      borderRadius: 18,
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: isBest ? `0 0 28px ${cbHexA(CB.gold, 0.2)}` : '0 2px 8px rgba(0,0,0,0.3)',
      overflow: 'visible',
    }}>
      {ribbon && (
        <div style={{
          position: 'absolute', top: -10, left: 14,
          padding: '4px 10px', borderRadius: 8,
          background: cbHexA(ribbon.color, 0.18),
          border: `1px solid ${cbHexA(ribbon.color, 0.5)}`,
          fontFamily: CB.fBody, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: ribbon.color,
          boxShadow: `0 0 14px ${cbHexA(ribbon.color, 0.4)}`,
        }}>{ribbon.label}</div>
      )}
      {/* Stack of coins */}
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ flexShrink: 0, filter: `drop-shadow(0 0 14px ${CB.goldGlow})` }}>
        <defs>
          <radialGradient id="stk" cx="0.35" cy="0.3">
            <stop offset="0" stopColor="#fde68a"/>
            <stop offset="0.6" stopColor="#fbbf24"/>
            <stop offset="1" stopColor="#b45309"/>
          </radialGradient>
        </defs>
        <ellipse cx="28" cy="46" rx="18" ry="5" fill="url(#stk)" stroke="#78350f"/>
        <rect x="10" y="32" width="36" height="14" fill="url(#stk)" stroke="#78350f"/>
        <ellipse cx="28" cy="32" rx="18" ry="5" fill="url(#stk)" stroke="#78350f"/>
        <rect x="10" y="22" width="36" height="10" fill="url(#stk)" stroke="#78350f"/>
        <ellipse cx="28" cy="22" rx="18" ry="5" fill="url(#stk)" stroke="#78350f"/>
        <rect x="10" y="14" width="36" height="8" fill="url(#stk)" stroke="#78350f"/>
        <ellipse cx="28" cy="14" rx="18" ry="5" fill="url(#stk)" stroke="#78350f"/>
        <text x="28" y="17.5" textAnchor="middle" fontFamily='"Chakra Petch"' fontWeight="900" fontSize="7" fill="#78350f">C</text>
      </svg>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <div style={{ fontFamily: CB.fDisplay, fontSize: 26, fontWeight: 700, color: CB.text, letterSpacing: '-0.01em' }}>{amount}</div>
          <div style={{ fontFamily: CB.fBody, fontSize: 12, color: CB.textSec }}>tokens</div>
        </div>
        {bonus && (
          <div style={{ marginTop: 4, fontFamily: CB.fBody, fontSize: 10, fontWeight: 700, color: CB.gold, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{bonus}</div>
        )}
      </div>

      <div style={{
        padding: '10px 16px',
        background: `linear-gradient(180deg, ${CB.violet}, #6d28d9)`,
        borderRadius: 12,
        fontFamily: CB.fMono, fontSize: 15, fontWeight: 700, color: '#fff',
        boxShadow: `0 2px 10px ${cbHexA(CB.violet, 0.4)}`,
        flexShrink: 0,
      }}>{price}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ad Watch
// ─────────────────────────────────────────────────────────────
function AdWatchScreen() {
  return (
    <CBScreen ambientIntensity={0.05}>
      <CBStatusBar/>
      {/* Skip btn top-right */}
      <div style={{ position: 'absolute', top: 60, right: 20, zIndex: 10 }}>
        <div style={{
          padding: '8px 14px', borderRadius: 999,
          background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(10px)',
          fontFamily: CB.fBody, fontSize: 13, fontWeight: 500, color: CB.text,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontFamily: CB.fMono, color: CB.textSec }}>Skip in 3</span>
        </div>
      </div>

      {/* Ad placeholder */}
      <div style={{ position: 'absolute', top: 120, left: 20, right: 20, bottom: 180, borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(140deg, #1a1a2e, #2a1f3d)', border: `1px solid ${CB.borderSubtle}` }}>
        {/* Diagonal stripes to indicate placeholder */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0 12px, transparent 12px 24px)' }}/>
        <div style={{ position: 'absolute', top: 14, left: 14, padding: '4px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.5)', fontFamily: CB.fBody, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: CB.textSec }}>AD</div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ fontFamily: CB.fBody, fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: CB.textDim, marginBottom: 14 }}>Advertisement Area</div>
          <div style={{ width: 80, height: 80, borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.08)', marginBottom: 16 }}/>
          <div style={{ fontFamily: CB.fDisplay, fontSize: 18, fontWeight: 700, color: CB.textSec }}>Sponsored Content</div>
          <div style={{ fontFamily: CB.fBody, fontSize: 12, color: CB.textDim, marginTop: 8 }}>Watch to earn 50 tokens</div>
        </div>
      </div>

      {/* Reward preview pill */}
      <div style={{ position: 'absolute', bottom: 80, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{
          padding: '10px 16px', borderRadius: 999,
          background: cbHexA(CB.gold, 0.1),
          border: `1px solid ${cbHexA(CB.gold, 0.4)}`,
          boxShadow: `0 0 20px ${CB.goldGlow}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <CBCoin size={16}/>
          <span style={{ fontFamily: CB.fMono, fontSize: 14, fontWeight: 700, color: CB.gold }}>+50</span>
          <span style={{ fontFamily: CB.fBody, fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: CB.textSec }}>on finish</span>
        </div>
      </div>

      <CBHomeIndicator/>
    </CBScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────────────────────
function ProfileScreen() {
  const stats = [
    { l: 'Games Played', v: '247' },
    { l: 'Win Rate', v: '68%' },
    { l: 'Current Streak', v: '4' },
    { l: 'Best Streak', v: '11' },
    { l: 'Avg Turns', v: '5.3' },
    { l: 'Tokens Earned', v: '12.4K' },
  ];
  const settings = [
    { l: 'Change Username' },
    { l: 'Notifications' },
    { l: 'Sound', v: 'On' },
    { l: 'Haptics', v: 'On' },
    { l: 'Privacy Policy' },
    { l: 'Terms of Service' },
    { l: 'Support' },
  ];
  return (
    <CBScreen>
      <CBStatusBar/>
      <div style={{ padding: '58px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: CB.bgElevated, border: `1px solid ${CB.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={CB.textSec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3L5 7l4 4"/></svg>
        </div>
        <CBTokenBadge amount="1,840" size="sm"/>
      </div>

      <div style={{ height: 'calc(100% - 110px)', overflowY: 'auto', padding: '8px 20px 40px' }}>
        {/* Avatar block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, paddingBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <CBAvatar name="Nova" size={92}/>
            <div style={{
              position: 'absolute', bottom: -4, right: -8,
              padding: '4px 10px', borderRadius: 999,
              background: `linear-gradient(180deg, ${CB.gold}, ${CB.goldDeep})`,
              fontFamily: CB.fDisplay, fontSize: 12, fontWeight: 700, color: '#1a1205',
              boxShadow: `0 0 12px ${CB.goldGlow}`,
            }}>LV. 12</div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, fontFamily: CB.fDisplay, fontSize: 22, fontWeight: 700, color: CB.text }}>
            nova_code
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={CB.textSec} strokeWidth="1.8" strokeLinecap="round"><path d="M10 2l2 2-7 7H3v-2l7-7z"/></svg>
          </div>
          <div style={{ marginTop: 4, fontFamily: CB.fBody, fontSize: 12, color: CB.textSec }}>2,340 / 3,200 XP</div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ padding: '12px 14px', borderRadius: 14, background: CB.bgElevated, border: `1px solid ${CB.borderSubtle}` }}>
              <div style={{ fontFamily: CB.fMono, fontSize: 20, fontWeight: 700, color: CB.text }}>{s.v}</div>
              <div style={{ fontFamily: CB.fBody, fontSize: 10, color: CB.textSec, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Per-mode */}
        <div style={{ marginTop: 20 }}>
          <CBSectionLabel>BY MODE</CBSectionLabel>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[{n:'CLR',r:72,c:CB.cyan},{n:'HI/LO',r:64,c:CB.violet},{n:'PREC',r:58,c:CB.gold}].map((m, i) => (
              <div key={i} style={{ padding: '10px 10px', borderRadius: 12, background: CB.bgElevated, border: `1px solid ${CB.borderSubtle}`, textAlign: 'center' }}>
                <div style={{ fontFamily: CB.fDisplay, fontSize: 18, fontWeight: 700, color: m.c }}>{m.r}%</div>
                <div style={{ fontFamily: CB.fBody, fontSize: 9, color: CB.textSec, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 2 }}>{m.n}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings list */}
        <div style={{ marginTop: 20 }}>
          <CBSectionLabel>SETTINGS</CBSectionLabel>
          <div style={{ marginTop: 10, borderRadius: 16, background: CB.bgElevated, border: `1px solid ${CB.borderSubtle}`, overflow: 'hidden' }}>
            {settings.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', padding: '14px 16px',
                borderBottom: i < settings.length - 1 ? `1px solid ${CB.borderSubtle}` : 'none',
              }}>
                <div style={{ flex: 1, fontFamily: CB.fBody, fontSize: 14, color: CB.text }}>{s.l}</div>
                {s.v && <span style={{ fontFamily: CB.fBody, fontSize: 13, color: CB.textSec, marginRight: 8 }}>{s.v}</span>}
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke={CB.textDim} strokeWidth="2" strokeLinecap="round"><path d="M1 1l6 5-6 5"/></svg>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CBHomeIndicator/>
    </CBScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// Insufficient Tokens Modal (shown over a dimmed Home)
// ─────────────────────────────────────────────────────────────
function InsufficientTokensScreen() {
  return (
    <CBScreen>
      <CBStatusBar/>
      {/* Behind: a dimmed home */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35, filter: 'blur(2px)' }}>
        <div style={{ padding: '60px 20px 0', textAlign: 'center', fontFamily: CB.fDisplay, fontSize: 30, fontWeight: 700, color: CB.text }}>CipherBreaker</div>
        {/* Simple placeholder cards */}
        <div style={{ padding: '110px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0,1,2].map(i => <div key={i} style={{ height: 96, background: CB.bgElevated, border: `1px solid ${CB.borderSubtle}`, borderRadius: 16 }}/>)}
        </div>
      </div>

      {/* Backdrop dim */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,11,30,0.55)', backdropFilter: 'blur(8px)' }}/>

      {/* Modal */}
      <div style={{ position: 'absolute', top: 180, left: 24, right: 24 }}>
        <CBGlassCard p={26}>
          {/* Close */}
          <div style={{ position: 'absolute', top: 14, right: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" viewBox="0 0 10 10" stroke={CB.textSec} strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l8 8M9 1l-8 8"/></svg>
            </div>
          </div>
          {/* Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: cbHexA(CB.warning, 0.12),
              border: `1px solid ${cbHexA(CB.warning, 0.35)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 24px ${cbHexA(CB.warning, 0.35)}`,
            }}>
              <svg width="38" height="38" viewBox="0 0 38 38">
                <defs>
                  <radialGradient id="brkn" cx="0.35" cy="0.3">
                    <stop offset="0" stopColor="#fde68a"/>
                    <stop offset="0.6" stopColor="#fbbf24"/>
                    <stop offset="1" stopColor="#b45309"/>
                  </radialGradient>
                </defs>
                <path d="M19 3 A16 16 0 0 1 35 19 L22 22 L19 3Z" fill="url(#brkn)" stroke="#78350f" strokeWidth="0.8"/>
                <path d="M19 3 L22 22 L2 21 A16 16 0 0 1 19 3Z" fill="url(#brkn)" opacity="0.55" stroke="#78350f" strokeWidth="0.8"/>
                <path d="M19 22 L22 22 L14 35" stroke={CB.warning} strokeWidth="2" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: CB.fDisplay, fontSize: 22, fontWeight: 700, color: CB.text }}>Not enough tokens</div>
            <div style={{ marginTop: 8, fontFamily: CB.fBody, fontSize: 13, color: CB.textSec, lineHeight: 1.45 }}>
              You need 50 tokens to play a match.
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <CBButton variant="cyan" icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="#fff"><path d="M6 3l7 5-7 5V3z"/></svg>
            }>Watch Ad · +50</CBButton>
            <CBButton>Buy Tokens</CBButton>
          </div>
        </CBGlassCard>
      </div>

      <CBHomeIndicator/>
    </CBScreen>
  );
}

Object.assign(window, { ShopScreen, AdWatchScreen, ProfileScreen, InsufficientTokensScreen });
