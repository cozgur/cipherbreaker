// Match screen (with mode switcher) + Results

function MatchScreen({ mode = 1 }) {
  const modeMeta = MODES.find(m => m.id === mode);
  // Sample guesses per mode
  const modeName = modeMeta.name;

  // Guess timeline for each mode
  const timeline = buildTimeline(mode);

  return (
    <CBScreen ambientIntensity={0.15}>
      <CBStatusBar/>

      {/* Header strip */}
      <div style={{
        position: 'relative', padding: '54px 16px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${CB.borderSubtle}`,
      }}>
        <CBSectionLabel>ROUND 3 · {modeName}</CBSectionLabel>
        {mode === 6 && <div style={{ fontFamily: CB.fMono, fontSize: 12, color: CB.danger }}>3/5 · 4/5</div>}
        {mode === 4 && <div style={{ fontFamily: CB.fMono, fontSize: 12, color: CB.warning }}>0:28 · 0:45</div>}
        <div style={{ width: 26, height: 26, borderRadius: 13, background: CB.bgElevated, border: `1px solid ${CB.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="2" y="1" width="2" height="8" fill={CB.textSec}/><rect x="6" y="1" width="2" height="8" fill={CB.textSec}/></svg>
        </div>
      </div>

      {/* Top: player cards */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <PlayerCard name="nova_code" level={12} active={true} mode={mode} side="left"/>
        <div style={{ fontFamily: CB.fDisplay, fontSize: 22, fontWeight: 700, color: CB.pink, transform: 'rotate(-6deg)', flexShrink: 0 }}>VS</div>
        <PlayerCard name="shadowHunter47" level={23} active={false} mode={mode} side="right" flag="🇩🇪"/>
      </div>

      {/* Middle: timeline */}
      <div style={{
        flex: 1, padding: '8px 16px 12px', overflowY: 'auto',
        height: mode === 5 ? 280 : 290,
      }}>
        {timeline.map((row, i) => <GuessRow key={i} {...row}/>)}
      </div>

      {/* Bottom: input */}
      <div style={{
        position: 'absolute', bottom: 34, left: 0, right: 0,
        padding: '14px 16px 0',
        background: `linear-gradient(180deg, transparent, ${CB.bgBase} 40%)`,
        borderTop: `1px solid ${CB.borderSubtle}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <CBSectionLabel color={CB.violet}>YOUR TURN</CBSectionLabel>
          <span style={{ fontFamily: CB.fBody, fontSize: 11, color: CB.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Guess #4</span>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
          {[3, 7, null, null].map((d, i) => (
            <CBDigitTile key={i} digit={d} state={d != null ? 'violet' : 'neutral'} size={44}/>
          ))}
        </div>
        <CBButton size="lg" style={{ opacity: 0.55 }}>Guess</CBButton>
      </div>

      <CBHomeIndicator/>
    </CBScreen>
  );
}

function PlayerCard({ name, level, active, mode, side, flag }) {
  return (
    <div style={{
      flex: 1, padding: '10px 12px',
      background: CB.bgElevated,
      border: `1.5px solid ${active ? CB.violet : CB.borderSubtle}`,
      borderRadius: 14,
      boxShadow: active ? `0 0 18px ${cbHexA(CB.violet, 0.35)}` : 'none',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CBAvatar name={name} size={34}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: CB.fBody, fontSize: 12, fontWeight: 600, color: CB.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontFamily: CB.fBody, fontSize: 10, color: CB.textSec, letterSpacing: '0.06em' }}>Lv. {level} {flag && `· ${flag}`}</div>
        </div>
      </div>
      {/* Mode extras */}
      {mode === 4 && (
        <div style={{ marginTop: 6, fontFamily: CB.fMono, fontSize: 18, fontWeight: 700, color: active ? CB.warning : CB.text, textAlign: 'center', letterSpacing: '0.02em' }}>
          {active ? '0:28.4' : '0:45.1'}
        </div>
      )}
      {mode === 6 && (
        <div style={{ marginTop: 6, display: 'flex', gap: 4, justifyContent: 'center' }}>
          {[1,2,3,4,5].map(i => {
            const used = active ? i <= 3 : i <= 2;
            return (
              <div key={i} style={{
                width: 7, height: 7, borderRadius: 4,
                background: used ? cbHexA(CB.textDim, 0.4) : CB.danger,
                boxShadow: !used ? `0 0 5px ${CB.danger}` : 'none',
                border: `1px solid ${used ? CB.textDim : CB.danger}`,
              }}/>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GuessRow({ side = 'left', avatar, digits, mode, feedback, extra }) {
  const align = side === 'left' ? 'flex-start' : 'flex-end';
  const flexDir = side === 'left' ? 'row' : 'row-reverse';
  return (
    <div style={{ display: 'flex', justifyContent: align, marginBottom: 12 }}>
      <div style={{ display: 'flex', flexDirection: flexDir, alignItems: 'center', gap: 8, maxWidth: '92%' }}>
        <CBAvatar name={avatar} size={22}/>
        <div>
          {extra && <div style={{ fontFamily: CB.fBody, fontSize: 10, color: CB.textDim, marginBottom: 4, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: side === 'left' ? 'left' : 'right' }}>{extra}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {digits.map((d, i) => (
              <CBDigitTile key={i} digit={d.val} state={d.state} size={36}/>
            ))}
            {mode === 3 && feedback && (
              <div style={{ fontFamily: CB.fMono, fontWeight: 700, fontSize: 15, marginLeft: 8, display: 'flex', gap: 6 }}>
                <span style={{ color: CB.success }}>+{feedback.plus}</span>
                <span style={{ color: CB.danger }}>−{feedback.minus}</span>
              </div>
            )}
          </div>
          {mode === 2 && feedback && (
            <div style={{ marginTop: 6, textAlign: side === 'left' ? 'left' : 'right' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: CB.fBody, fontSize: 11, fontWeight: 600,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: feedback.dir === 'lower' ? CB.cyan : CB.pink,
                padding: '3px 10px', borderRadius: 999,
                background: cbHexA(feedback.dir === 'lower' ? CB.cyan : CB.pink, 0.1),
                border: `1px solid ${cbHexA(feedback.dir === 'lower' ? CB.cyan : CB.pink, 0.4)}`,
              }}>
                {feedback.dir === 'lower' ? '▼ Lower' : '▲ Higher'}
              </span>
            </div>
          )}
          {mode === 5 && feedback && (
            <div style={{ marginTop: 6, textAlign: side === 'left' ? 'left' : 'right' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: CB.fBody, fontSize: 11, fontWeight: 600,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: feedback.locked === 0 ? CB.textDim : CB.success,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: feedback.locked === 0 ? CB.textDim : CB.success,
                  boxShadow: feedback.locked > 0 ? `0 0 8px ${CB.success}` : 'none',
                }}/>
                {feedback.locked === 0 ? 'NONE' : `${feedback.locked} LOCKED`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildTimeline(mode) {
  // 4 guesses alternating, showcasing the mode's feedback
  if (mode === 1) {
    return [
      { side: 'left', avatar: 'Nova', digits: [{val:3,state:'green'},{val:7,state:'gray'},{val:2,state:'yellow'},{val:9,state:'gray'}], mode: 1 },
      { side: 'right', avatar: 'Shadow', digits: [{val:1,state:'yellow'},{val:2,state:'gray'},{val:5,state:'gray'},{val:8,state:'green'}], mode: 1 },
      { side: 'left', avatar: 'Nova', digits: [{val:3,state:'green'},{val:4,state:'gray'},{val:2,state:'green'},{val:6,state:'yellow'}], mode: 1 },
      { side: 'right', avatar: 'Shadow', digits: [{val:6,state:'yellow'},{val:2,state:'yellow'},{val:4,state:'gray'},{val:8,state:'green'}], mode: 1 },
    ];
  }
  if (mode === 2) {
    return [
      { side: 'left', avatar: 'Nova', digits: [{val:5,state:'neutral'},{val:0,state:'neutral'},{val:0,state:'neutral'},{val:0,state:'neutral'}], mode: 2, feedback: { dir: 'lower' } },
      { side: 'right', avatar: 'Shadow', digits: [{val:2,state:'neutral'},{val:5,state:'neutral'},{val:0,state:'neutral'},{val:0,state:'neutral'}], mode: 2, feedback: { dir: 'higher' } },
      { side: 'left', avatar: 'Nova', digits: [{val:3,state:'neutral'},{val:7,state:'neutral'},{val:5,state:'neutral'},{val:0,state:'neutral'}], mode: 2, feedback: { dir: 'higher' } },
      { side: 'right', avatar: 'Shadow', digits: [{val:4,state:'neutral'},{val:2,state:'neutral'},{val:0,state:'neutral'},{val:0,state:'neutral'}], mode: 2, feedback: { dir: 'lower' } },
    ];
  }
  if (mode === 3) {
    return [
      { side: 'left', avatar: 'Nova', digits: [{val:3,state:'neutral'},{val:7,state:'neutral'},{val:2,state:'neutral'},{val:9,state:'neutral'}], mode: 3, feedback: { plus: 1, minus: 2 } },
      { side: 'right', avatar: 'Shadow', digits: [{val:1,state:'neutral'},{val:2,state:'neutral'},{val:5,state:'neutral'},{val:8,state:'neutral'}], mode: 3, feedback: { plus: 2, minus: 1 } },
      { side: 'left', avatar: 'Nova', digits: [{val:3,state:'neutral'},{val:2,state:'neutral'},{val:7,state:'neutral'},{val:6,state:'neutral'}], mode: 3, feedback: { plus: 2, minus: 2 } },
    ];
  }
  if (mode === 4) {
    return [
      { side: 'left', avatar: 'Nova', digits: [{val:3,state:'green'},{val:7,state:'gray'},{val:2,state:'yellow'},{val:9,state:'gray'}], mode: 4, extra: '0:08s' },
      { side: 'right', avatar: 'Shadow', digits: [{val:1,state:'yellow'},{val:2,state:'gray'},{val:5,state:'gray'},{val:8,state:'green'}], mode: 4, extra: '0:04s' },
      { side: 'left', avatar: 'Nova', digits: [{val:3,state:'green'},{val:4,state:'gray'},{val:2,state:'green'},{val:6,state:'yellow'}], mode: 4, extra: '0:11s' },
    ];
  }
  if (mode === 5) {
    return [
      { side: 'left', avatar: 'Nova', digits: [{val:3,state:'blackout'},{val:7,state:'blackout'},{val:2,state:'blackout'},{val:9,state:'blackout'}], mode: 5, feedback: { locked: 1 } },
      { side: 'right', avatar: 'Shadow', digits: [{val:1,state:'blackout'},{val:2,state:'blackout'},{val:5,state:'blackout'},{val:8,state:'blackout'}], mode: 5, feedback: { locked: 0 } },
      { side: 'left', avatar: 'Nova', digits: [{val:3,state:'blackout'},{val:4,state:'blackout'},{val:2,state:'blackout'},{val:6,state:'blackout'}], mode: 5, feedback: { locked: 2 } },
    ];
  }
  if (mode === 6) {
    return [
      { side: 'left', avatar: 'Nova', digits: [{val:3,state:'green'},{val:7,state:'gray'},{val:2,state:'yellow'},{val:9,state:'gray'}], mode: 6, extra: '1/5' },
      { side: 'right', avatar: 'Shadow', digits: [{val:1,state:'yellow'},{val:2,state:'gray'},{val:5,state:'gray'},{val:8,state:'green'}], mode: 6, extra: '1/5' },
      { side: 'left', avatar: 'Nova', digits: [{val:3,state:'green'},{val:4,state:'gray'},{val:2,state:'green'},{val:6,state:'yellow'}], mode: 6, extra: '2/5' },
    ];
  }
  // mode 7
  return [
    { side: 'left', avatar: 'Nova', digits: [{val:3,state:'green'},{val:7,state:'gray'},{val:2,state:'yellow'},{val:9,state:'gray'}], mode: 7 },
    { side: 'left', avatar: 'Nova', digits: [{val:3,state:'green'},{val:4,state:'gray'},{val:2,state:'green'},{val:6,state:'yellow'}], mode: 7 },
    { side: 'left', avatar: 'Nova', digits: [{val:3,state:'green'},{val:2,state:'yellow'},{val:6,state:'yellow'},{val:4,state:'gray'}], mode: 7 },
  ];
}

// ─────────────────────────────────────────────────────────────
// Match Results
// ─────────────────────────────────────────────────────────────
function ResultScreen({ outcome = 'victory' }) {
  const conf = {
    victory: {
      title: 'VICTORY', color: CB.gold,
      tint: cbHexA(CB.gold, 0.12),
      sub: 'You cracked the code in 6 guesses',
      reward: '+100', xp: '+30',
      secret: [3, 8, 4, 7], revealed: true,
    },
    defeat: {
      title: 'DEFEAT', color: '#fca5a5',
      tint: cbHexA(CB.danger, 0.1),
      sub: 'shadowHunter47 cracked it in 4.',
      reward: '+0', xp: '+5',
      secret: [3, 8, 4, 7], revealed: true,
      note: 'So close. Try another mode?',
    },
    draw: {
      title: 'DRAW', color: CB.violet,
      tint: cbHexA(CB.violet, 0.12),
      sub: 'Both of you found the code in 5 guesses.',
      reward: '+50', xp: '+15',
      secret: [3, 8, 4, 7], revealed: true,
    },
    stalemate: {
      title: 'STALEMATE', color: '#c4b5fd',
      tint: cbHexA('#6d28d9', 0.12),
      sub: 'Neither of you could crack the code.',
      reward: '+50', xp: '+0', refund: true,
      secret: [5, 8, 4, 7], revealed: true,
      codeLabel: 'The code was',
    },
  }[outcome];

  return (
    <CBScreen ambient={outcome === 'victory' ? CB.gold : outcome === 'defeat' ? CB.danger : CB.violet}
              ambientIntensity={outcome === 'defeat' ? 0.12 : 0.26}>
      <CBStatusBar/>

      {/* Particle backdrop for victory */}
      {outcome === 'victory' && <VictoryParticles/>}

      <div style={{ position: 'absolute', inset: 0, padding: '110px 24px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <CBTag color={conf.color}>{outcome === 'victory' ? 'MATCH RESULT' : outcome === 'defeat' ? 'MATCH RESULT' : outcome.toUpperCase()}</CBTag>
          <div style={{
            marginTop: 16,
            fontFamily: CB.fDisplay, fontSize: 56, fontWeight: 900,
            color: conf.color, letterSpacing: '-0.02em', lineHeight: 1,
            textShadow: `0 0 40px ${cbHexA(conf.color, 0.7)}`,
          }}>{conf.title}</div>
          <div style={{ marginTop: 14, fontFamily: CB.fBody, fontSize: 14, color: CB.textSec, lineHeight: 1.4, padding: '0 20px' }}>
            {conf.sub}
          </div>
        </div>

        {/* Secret reveal */}
        {conf.revealed && (
          <div style={{ marginTop: 28, textAlign: 'center' }}>
            <div style={{ fontFamily: CB.fBody, fontSize: 10, fontWeight: 600, color: CB.textDim, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
              {conf.codeLabel || (outcome === 'victory' ? 'The secret was' : 'Opponent\u2019s code')}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {conf.secret.map((d, i) => (
                <CBDigitTile key={i} digit={d} state={outcome === 'victory' ? 'green' : 'gray'} size={52}/>
              ))}
            </div>
          </div>
        )}

        {/* Reward */}
        <div style={{ marginTop: 30, display: 'flex', justifyContent: 'center', gap: 14 }}>
          <RewardChip icon={<CBCoin size={18}/>} value={conf.reward} color={CB.gold} label={conf.refund ? 'refunded' : 'tokens'}/>
          <RewardChip value={conf.xp} color={CB.violet} label="XP"/>
        </div>

        {conf.note && (
          <div style={{ marginTop: 20, textAlign: 'center', fontFamily: CB.fBody, fontSize: 13, fontStyle: 'italic', color: CB.textSec }}>
            {conf.note}
          </div>
        )}

        {/* Stats grid for victory */}
        {outcome === 'victory' && (
          <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <StatCard label="Rounds" value="6"/>
            <StatCard label="Best Streak" value="4"/>
            <StatCard label="Win Rate" value="68%"/>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <CBButton style={{ flex: 1.4 }}>{outcome === 'victory' ? 'Play Again' : 'Rematch'}</CBButton>
          <CBButton variant="outline" style={{ flex: 1 }}>Home</CBButton>
        </div>
      </div>

      <CBHomeIndicator/>
    </CBScreen>
  );
}

function RewardChip({ icon, value, color, label }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '10px 14px', borderRadius: 14,
      background: CB.bgElevated, border: `1px solid ${cbHexA(color, 0.4)}`,
      boxShadow: `0 0 16px ${cbHexA(color, 0.2)}`,
    }}>
      {icon}
      <div>
        <div style={{ fontFamily: CB.fDisplay, fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.01em', lineHeight: 1 }}>{value}</div>
        <div style={{ fontFamily: CB.fBody, fontSize: 10, color: CB.textDim, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ padding: '10px 10px', borderRadius: 12, background: CB.bgElevated, border: `1px solid ${CB.borderSubtle}`, textAlign: 'center' }}>
      <div style={{ fontFamily: CB.fMono, fontSize: 16, fontWeight: 700, color: CB.text }}>{value}</div>
      <div style={{ fontFamily: CB.fBody, fontSize: 9.5, color: CB.textSec, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function VictoryParticles() {
  // Static gold particle positions
  const parts = [
    [30,80,3], [60,50,2], [110,120,4], [160,70,3], [220,100,2],
    [260,160,3], [310,90,4], [350,140,2], [40,200,2], [80,260,3],
    [140,220,3], [200,300,4], [240,380,2], [290,320,3], [340,400,3],
    [60,440,2], [160,500,3], [260,480,2], [360,540,3], [100,600,4],
    [220,640,2], [320,700,3], [40,700,3], [180,760,2], [280,800,2],
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
      {parts.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p[0], top: p[1],
          width: p[2]*2, height: p[2]*2, borderRadius: '50%',
          background: CB.gold, boxShadow: `0 0 ${p[2]*3}px ${CB.gold}`, opacity: 0.85,
        }}/>
      ))}
    </div>
  );
}

Object.assign(window, { MatchScreen, ResultScreen });
