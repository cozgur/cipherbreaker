# CipherBreaker — Design Prompt

> Paste this into Claude Code, v0, Figma AI, or any design tool. The app's UI language is **English** (all copy, labels, buttons, messages).

---

## Product Context

**CipherBreaker** is a mobile (iOS + Android, React Native) 1v1 number-guessing game. Players bet tokens, compete against opponents, and try to crack a secret 4-digit code first. Three game modes offer different feedback mechanics. The opponents appear to be real players (with names, levels, country flags, "typing" indicators) but are actually AI — this illusion must be preserved throughout the UI. The user never sees the word "bot" or "AI" anywhere.

**Target audience**: Casual mobile gamers, 17+. English-speaking global market.

**Core emotional goals**: Tension, prestige, quick dopamine hits, "one more round" addictiveness. Premium feel, not arcade-cheap. Competitive and rewarding, not stressful.

---

## Visual Direction: "Neo-Noir Casino Arcade"

Think **Balatro meets Pokerstars meets Monument Valley** — a casino's mystique, an arcade's energy, a premium mobile app's polish. Dark, moody, neon-accented. Gold for currency (evokes wealth), violet/cyan for primary UI (modern, digital), deep navy base (serious, high-stakes).

**What to avoid**: Cartoonish. Flat pastel. Generic "playful" mobile game aesthetics. Bright saturated rainbow palettes. White backgrounds. Comic-sans-adjacent fonts. Purple gradients on white (AI slop cliché).

**What to lean into**: Dark atmospheric backgrounds with subtle gradient depth. Neon glows on active/important elements. Gold as the reward color. Glass morphism on modals. Subtle grain/noise texture for premium feel. Sharp typography with character. Generous use of motion — but always purposeful.

---

## Color System

```
BASE LAYER
--bg-base          #0a0b1e    deep navy-black (app background)
--bg-elevated      #15172e    elevated surfaces (cards)
--bg-overlay       #1f2142    modals, sheets
--bg-glass         rgba(31,33,66,0.6) + 20px backdrop-blur   glass overlays

ACCENT LAYER
--accent-primary   #8b5cf6    violet (primary actions, active states)
--accent-secondary #06b6d4    cyan (info, secondary emphasis)
--accent-tertiary  #ec4899    pink (special highlights, rare)

CURRENCY LAYER
--gold             #fbbf24    token color, reward glow
--gold-deep        #d97706    gold shadow/depth
--gold-glow        rgba(251,191,36,0.4)   token halo

SEMANTIC LAYER
--success          #10b981    win, correct, +positive
--warning          #f59e0b    caution, low balance
--danger           #ef4444    loss, wrong, -negative

NEUTRAL LAYER
--text-primary     #f5f5f7    primary copy
--text-secondary   #a1a1b5    secondary copy
--text-dim         #5a5a7a    placeholder, disabled

--border-subtle    #2a2c54    dividers, card borders
--border-bright    #8b5cf6    active element borders
```

**Usage rules**:
- Gold is SACRED — only for tokens, rewards, victory. Never for generic UI.
- Violet is the default "active" color. Cyan is used sparingly for contrast.
- Pink (tertiary) appears in maybe 1-2 places total (e.g., "RARE" badges, special events).
- Semantic colors (success/warning/danger) never become decorative — they only carry meaning.

---

## Typography

**Three-font system**:

1. **Display / Headings**: **Chakra Petch** (weights 700, 900)
   - Use for: app title, screen headers, VICTORY/DEFEAT/DRAW, mode names, large numbers on win screens.
   - Character: angular, technical, slightly futuristic but still readable. Conveys "game."

2. **Body / UI**: **Inter** (weights 400, 500, 600)
   - Use for: all descriptive text, button labels, card descriptions, menu items, settings.
   - Character: clean, neutral, highly legible. The workhorse.

3. **Monospace / Numbers**: **JetBrains Mono** (weight 700)
   - Use for: the 4-digit guesses, token counts, timer, stats.
   - Character: tabular figures, perfect digit alignment — critical for guess rows where digits must line up vertically.

**Type scale** (mobile, in pts):
```
Display XL    48pt / Chakra Petch 900   (VICTORY, huge moments)
Display L     32pt / Chakra Petch 700   (screen titles, "CipherBreaker")
Display M     24pt / Chakra Petch 700   (section headers)
Body L        17pt / Inter 500          (primary UI)
Body M        15pt / Inter 400          (descriptions)
Body S        13pt / Inter 500          (labels, captions)
Tiny         11pt / Inter 600 UPPERCASE (badges, tags, "MOST POPULAR")
Digit L      40pt / JetBrains Mono 700  (guess display)
Digit M      28pt / JetBrains Mono 700  (input fields)
Digit S      17pt / JetBrains Mono 700  (inline stats)
```

Letter-spacing: tight on display (-0.02em), normal on body, wide (+0.12em) on Tiny/UPPERCASE tags.

---

## Spacing, Radius, Elevation

**Spacing scale** (4px base): 4, 8, 12, 16, 24, 32, 48, 64.
Screens use 16–24px horizontal padding. Cards have 16–20px internal padding. Buttons: 14px vertical, 24px horizontal.

**Border radius**:
- Tight: 8px (inputs, small tags)
- Default: 16px (cards, buttons)
- Loose: 24px (modals, large panels)
- Pill: full / 999px (tokens badge, status pills)

**Elevation** (shadows for dark mode — these are GLOWS, not dark shadows):
- Low: `0 2px 8px rgba(139,92,246,0.15)` (subtle card lift)
- Medium: `0 4px 20px rgba(139,92,246,0.25)` (active buttons)
- High: `0 8px 40px rgba(139,92,246,0.4)` (victory, important CTAs)
- Gold glow (for tokens): `0 0 24px rgba(251,191,36,0.5)`

---

## Motion Principles

Motion conveys **feedback, hierarchy, and delight**. Never animate for animation's sake.

**Speed**: Most transitions 200–300ms. Page transitions 350–400ms. Celebrations (victory, token gain) 800–1200ms with staggered elements.

**Curves**: Default `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out-ish). Springy elements use Reanimated `withSpring({damping: 15, stiffness: 150})`.

**Key moments**:
- Button press: scale 0.95, 100ms.
- New guess row appears: slide-in from bottom + fade, 300ms, with 50ms stagger per digit.
- Correct digit (Mode 1 green): pulse glow, infinite subtle breathe (2s cycle).
- Token count change: number counter animation (tick up/down), 600ms.
- Victory: screen flash, gold particle burst, staggered text reveal, spring scale bounce.
- Defeat: subtle screen dim, slower reveal, no celebration.
- "Opponent is typing...": three dots sequential bounce, 1.4s loop.
- Matchmaking radar: rotating scan line + pulsing circles, seamless loop.

**Haptics** (pair with visual motion):
- Light: every guess submitted, button press.
- Medium: correct digit revealed, token earned.
- Heavy (success): victory, big milestone.
- Error: invalid input shake.

---

## Atmosphere & Texture

Three layers that give the app its signature feel:

1. **Ambient gradient**: The app background isn't flat. Subtle radial gradient from the top with a soft violet tint that fades to pure bg-base. This makes screens feel lit, not dead.

2. **Grain overlay**: A 5% opacity grain/noise texture over the entire app (SVG filter or tileable PNG, 128x128). Gives a film-like, premium texture. Critical for avoiding the "flat digital" feel.

3. **Glow accents**: Key elements (active buttons, token badges, correct guesses) have radial glows behind them. Not heavy — just enough to suggest the element is "emitting light" in the dark environment.

On modals: glass morphism with 20px backdrop blur + 0.6 opacity overlay. The blurred UI behind communicates layer depth.

---

## Screen-by-Screen Design Brief

All UI copy is in **English**.

### 1. Onboarding (first launch only, skippable)

3 screens, swipeable. Each:
- Large illustration (abstract — e.g., a stylized locked safe with glowing digits, a radar sweeping for players, a token cascade).
- Big Chakra Petch headline, one line.
- Single Inter sentence below.
- Bottom: pagination dots + "Skip" + "Next" / "Start Playing".

**Copy**:
- Screen 1: "Crack the code. Beat your rival." → "A 4-digit secret. One mind against yours. Three ways to play."
- Screen 2: "Win tokens. Climb the ranks." → "Every match raises the stakes. Every win raises your level."
- Screen 3: "You start with 500 tokens." → "Let's play." → [Start Playing]

### 2. Home (main hub)

- **Top bar** (fixed): Left — user avatar (circular, colored initial) + username in Body S. Right — token balance pill (gold coin icon + number in JetBrains Mono, tappable, navigates to Shop) + settings gear icon.
- **Title section**: "CipherBreaker" in Display L with soft violet glow, centered, top ~15% of screen.
- **Mode selection**: Scrollable vertical list with two section headers:
  - **Section 1: "CLASSIC"** (Tiny uppercase, secondary color, 16px bottom margin)
    - Mode 1, 2, 3 cards
  - **Section 2: "ADVANCED"** (Tiny uppercase, pink/tertiary accent for "prestige" feel)
    - Mode 4, 5, 6, 7 cards
  - Total 7 cards. Each card ~110px tall, 16px gap between cards, 24px between sections.
  - Card structure:
    - Left 25%: mode icon in a circular badge (gradient fill, glowing). Icons per mode:
      - Mode 1: overlapping green/yellow/gray dots (color match)
      - Mode 2: up/down arrows stacked (binary)
      - Mode 3: "+/−" symbol
      - Mode 4: stopwatch icon (timer)
      - Mode 5: eye-with-slash or lightning bolt (blackout/prestige)
      - Mode 6: skull or "5" in a ring (sudden death countdown)
      - Mode 7: mirrored silhouettes or parallel arrows (mirror)
    - Middle 55%: mode name (Display M) + one-sentence description (Body M, secondary color). Advanced modes have a small badge next to the name:
      - Mode 4: "⏱ TIMED" pill (red/orange accent)
      - Mode 5: "PRESTIGE" pill (pink/tertiary accent)
      - Mode 6: "HIGH RISK" pill (crimson/danger accent)
      - Mode 7: "SOLO RACE" pill (teal accent)
    - Right 20%: entry cost "X 🪙" in gold + chevron arrow.
  - Each card gradient:
    - Mode 1 (Color Match): cyan → violet
    - Mode 2 (High & Low): violet → pink
    - Mode 3 (Precision): gold → orange
    - Mode 4 (Blitz): red → orange (urgency)
    - Mode 5 (Blackout): deep purple → near-black (mystery, prestige)
    - Mode 6 (Sudden Death): dark red → crimson (danger)
    - Mode 7 (Mirror): teal → silver (parallel, race)
  - Press: scale 0.97, glow intensifies.
  - **Insufficient balance state**: If user's tokens < mode entry cost, the card's right side shows "Need X 🪙" in warning color instead of entry cost, and tap navigates to Shop instead of Matchmaking.
- **Bottom section**: Level bar. "LEVEL 12" in Tiny uppercase + progress bar (filled gold, dim track) + "2,340 / 3,200 XP" in Body S.

**Copy**:
- Mode 1 card: "COLOR MATCH" / "Green, yellow, gray — Wordle-style feedback." · 50 🪙
- Mode 2 card: "HIGH & LOW" / "One hint: is the secret higher or lower?" · 50 🪙
- Mode 3 card: "PRECISION" / "+1 for right spot, −1 for wrong spot." · 50 🪙
- Mode 4 card: "BLITZ" / "Chess clock. 60 seconds each. Don't flag." · 50 🪙
- Mode 5 card: "BLACKOUT" / "Only locked-in digits revealed. High stakes." · 100 🪙
- Mode 6 card: "SUDDEN DEATH" / "Five guesses. No second chances." · 50 🪙
- Mode 7 card: "MIRROR" / "Same code, different minds. First to crack wins." · 75 🪙

### 3. Matchmaking

Full-screen dark atmosphere. Centered:
- Radar animation: concentric violet circles expanding outward continuously + rotating scan line. ~60% screen width.
- Below, in Display M: "Searching for opponent..." (animated ellipsis).
- Subtle subtext in Body S, secondary: "Matching by skill level"

After 2–4 seconds: radar animation resolves (lines snap inward to center), revealing the opponent card:
- Card slides up from the bottom with scale-in:
  - Circular avatar (colored solid + initial letter).
  - Opponent username in Display M (e.g., "shadowHunter47").
  - Below: "Lv. 23 · 🇩🇪 · Online" in Body S.
- 1 second later, auto-navigate to Match screen with "VS" overlay transition.

### 4. Secret Setup

- Top bar: back arrow + "MODE 1: COLOR MATCH" (Tiny uppercase, violet).
- Middle: Display M "Choose Your Secret Code" + Body M subtitle "Your opponent will try to crack this."
- Below: 4 large digit slots, 64px each, 12px gap, horizontal row. JetBrains Mono 40pt. Empty state shows "—". Filled digit: violet glow + fade-in.
- Numeric keypad (custom, styled) below: 3x4 grid of digit buttons, plus backspace. Each key: 56x56, bg-elevated, rounded-default.
- For Mode 3: small warning chip above slots — "All digits must be unique" in warning color.
- Input validation: shake + red glow on invalid, gentle green pulse on valid.
- Bottom: "LOCK IN CODE" button, full-width, disabled until 4 valid digits. Active state: violet gradient bg, subtle glow, haptic medium on press.

### 5. Match (most complex screen)

**IMPORTANT — Mode 2 rendering clarification**:
Mode 2 is a binary search game. Feedback is **per-guess** (whole number comparison), NOT per-digit. Example render for Mode 2 guess `7234` when secret is `3817`:

```
┌─────────────────────────────────┐
│  7   2   3   4                  │
│  ▼ LOWER                        │
└─────────────────────────────────┘
```

The single ▼ LOWER indicator applies to the entire number — no per-digit arrows. This is critical for gameplay clarity: do not show individual arrows below each digit, as that would imply per-digit feedback (which is Mode 1 / Mode 3 territory).

**IMPORTANT — Mode 5 (Blackout) rendering**:
Only the COUNT of locked-in digits is shown. The digits themselves remain visible (that's the player's own guess), but there's NO indication of which specific digits are correct. Example for guess `3249` when secret is `3847`:

```
┌─────────────────────────────────┐
│  3   2   4   9                  │
│  ● 1 LOCKED                     │
└─────────────────────────────────┘
```

A single glowing dot + count (1 LOCKED, 2 LOCKED, etc.) centered below the digits. Color: success green for 1+, intense glow for 3+ LOCKED. If 0, show "● NONE" in dim gray. Never reveal which digit is locked — player must deduce.

**Mode-specific top-bar additions**:

- **Mode 4 (Blitz)**: Each player card includes a chess-clock display below the username. Format: `0:45.2` in JetBrains Mono, large (24pt). Active clock ticks down with subtle pulse per second. When < 10s, clock turns red and adds an outer red glow + shake micro-animation. When clock hits 0:00, the entire player card dims and "TIME OUT" tag appears in danger red.

- **Mode 6 (Sudden Death)**: Each player card shows a "guesses left" indicator: five dot icons (5 total), dots get filled → empty as guesses are used. Format like Mario lives. When 1 LEFT: the single remaining dot pulses red with heavy glow, and the text "LAST GUESS" appears below in danger red Tiny uppercase.

- **Mode 7 (Mirror)**: No split left/right layout. Instead, single centered banner at top: "SOLO RACE · Both solving the same code" + opponent mini-card on the right corner showing only "{name} · {X} guesses" (no guess content). A live indicator "{name} is guessing..." appears sporadically when the opponent makes a guess (without revealing what).

**Standard layout (Modes 1, 2, 3, 4, 6)**: Portrait, three vertical sections:

**Top section (~20% height)**: Two player cards, side-by-side. User's position (left/right) randomized per match. Each card: avatar + username + "Lv. X" + mini stat + (mode-specific extras above). Active player's card has pulsating violet border. Between them: "VS" label in Display M, rotated slightly, pink accent.

**Middle section (~55% height, scrollable)**: Guess timeline.
- Guess rows alternate alignment based on who made them (left-side user's guesses align left, etc.).
- Each guess row: small avatar + timestamp outside, then the mode-specific render (see below).
- New rows slide-in + glow pulse. Digits stagger by 50ms each.

**Mode-specific guess row rendering**:
- **Mode 1**: 4 square tiles per digit, colored green / yellow / gray-outline per Wordle rules. Green tiles have soft glow.
- **Mode 2**: 4 digit tiles (neutral, violet border) + single large ▲ HIGHER / ▼ LOWER indicator below (see clarification above).
- **Mode 3**: 4 digit tiles (neutral) followed by "+2 −1" score in JetBrains Mono. "+" in success green, "−" in danger red. Score animates with counter roll.
- **Mode 4 (Blitz)**: Same as Mode 1 (color tiles). Additionally, small "0:08s" timestamp on the outside showing how long the guesser took.
- **Mode 5 (Blackout)**: 4 digit tiles (neutral, deep purple border — consistent with mode theme) + "● N LOCKED" indicator below, as described above. No individual digit coloring.
- **Mode 6 (Sudden Death)**: Same as Mode 1 (color tiles). Additionally, a small "3/5" badge on the outside showing which guess number this is.
- **Mode 7 (Mirror)**: Same as Mode 1 (color tiles). Single column centered; no left/right alternation since only user's guesses are shown.

**Bottom section (~25% height)**:
- When it's user's turn: 4 digit input slots + numeric keypad + "GUESS" button.
- When opponent's turn: input disabled/hidden. Show "shadowHunter47 is typing..." with three-dot bounce.
- **Mode 4 (Blitz)**: no turn-based waiting — player's own clock ticks whenever it's their turn. "GUESS" button has timer-red accent in last 10 seconds.
- **Mode 7 (Mirror)**: no turn-based waiting — player can guess anytime. Opponent's guesses happen async in background.

**Incidental**:
- Header strip above top section: "ROUND 3 · COLOR MATCH" (mode name changes per mode) in Tiny uppercase + pause/forfeit button. For Mode 4 also show combined clock state, for Mode 6 also show combined guess count.

### 6. Match Result

Full-screen, tone depends on outcome:

**Victory**:
- Background: subtle gold gradient overlay on bg-base, gold particle rain animation.
- Top: "VICTORY" in Display XL, gold with glow, scale-in + spring bounce.
- Middle: "You cracked the code in 6 guesses" in Body L. Opponent's secret revealed: 4 tiles in gray showing the digits.
- Token reward: "+100 🪙" in Display M, gold, with counter animation from 0 to the mode's reward amount.
- XP gain below: "+30 XP" in violet.
- Mini stats grid: "Rounds", "Best Streak", "Win Rate" — each a small card.
- Buttons: "PLAY AGAIN" (primary violet) + "HOME" (secondary outline).

**Draw**:
- Background: neutral violet tint.
- "DRAW" in Display XL, violet.
- Subtitle: "Both of you found the code in 5 guesses."
- Token: mode's draw amount.
- Buttons: same two.

**Defeat**:
- Background: subtle red tint, darker overall.
- "DEFEAT" in Display XL, muted red, no bounce (slower reveal).
- Subtitle: context-dependent — e.g., "shadowHunter47 cracked it in 4." Or for Blitz: "Your clock hit zero." For Sudden Death: "You ran out of guesses."
- Show opponent's winning guess (if any). Show your secret revealed (where applicable).
- Encouraging line: "So close. Try another mode?"
- "+0 🪙 · +5 XP"
- Buttons: "REMATCH" + "HOME".

**Stalemate (Mode 6 only, when both fail in 5 guesses)**:
- Background: neutral gray-violet.
- "STALEMATE" in Display XL, dim violet.
- Subtitle: "Neither of you could crack the code."
- Show the secret: "The code was: 5847" with tiles.
- "+50 🪙 refunded" (entry cost returned).
- Buttons: "REMATCH" + "HOME".

### 7. Shop

- Header: "Get Tokens" in Display L + "Top up to keep playing" in Body M, secondary.
- 4 package cards, vertical stack. Each:
  - Horizontal layout: large token icon (stack of coins, gold, glowing) on the left → amount in Display M (e.g., "1,500") + bonus tag if applicable ("+20% BONUS" in gold Tiny uppercase) → price on the right ("$2.99" in Body L, JetBrains Mono numbers).
  - The "1,500" package has a "MOST POPULAR" ribbon (pink/tertiary accent) at top.
  - The "15,000" package has a "BEST VALUE" ribbon (gold).
  - Press: scale 0.97, glow.
- Small footer: "All purchases are final. Tokens have no cash value."

**Copy**:
- "500 tokens" — "$0.99"
- "1,500 tokens" — "$2.99" — "MOST POPULAR"
- "5,000 tokens" — "$7.99" — "+40% BONUS"
- "15,000 tokens" — "$19.99" — "BEST VALUE"

### 8. Ad Watch (fake ad screen for MVP)

- Full-screen dark overlay with placeholder "advertisement area" (can be a neutral gradient with "Ad" watermark).
- Top-right: countdown in Body L — "Skip in 5... 4... 3..." → "Skip" button active at 2s remaining.
- After 5s or skip: brief "+50 🪙 earned!" toast with gold glow, then auto-dismiss.

### 9. Profile

- Top: user avatar + editable username + level badge.
- Stats grid (2x3):
  - Games Played
  - Win Rate (%)
  - Current Streak
  - Best Streak
  - Avg Turns to Win
  - Total Tokens Earned
- Per-mode breakdown: 3 mini cards showing win rate per mode.
- Settings section (list): Change Username, Notifications, Sound, Haptics, Privacy Policy, Terms of Service, Support.

### 10. Insufficient Tokens Modal (when balance < 50)

Glass-morph modal, center screen:
- Icon: broken/empty coin, warning color glow.
- Title: "Not enough tokens" Display M.
- Subtitle: "You need 50 tokens to play a match." Body M.
- Two stacked buttons, full-width:
  - "WATCH AD (+50 🪙)" — secondary cyan style
  - "BUY TOKENS" — primary violet style
- Dismiss X top-right.

---

## Universal UI Copy (English)

**Actions**: Play, Play Again, Rematch, Home, Back, Next, Skip, Start Playing, Lock In Code, Guess, Buy Tokens, Watch Ad, Restore Purchases.

**States**: Your Turn, Opponent's Turn, Typing..., Searching for opponent, Opponent found, Finding a rival to race, Online, Active recently, Just joined, Time Out, Last Guess, Stalemate.

**Feedback**: Victory, Defeat, Draw, Stalemate, Correct spot, Wrong spot, Not in code, Higher, Lower, Locked, None, Invalid code, All digits must be unique.

**Labels**: Level, XP, Tokens, Win Rate, Games Played, Best Streak, Current Streak, Most Popular, Best Value, Bonus, Prestige, High Risk, Timed, Solo Race, Classic, Advanced.

---

## Design Don'ts

- Don't use emoji as primary icons in the UI (except flags and the token 🪙). Use `lucide-react-native` for interface icons.
- Don't mix 3+ accent colors on a single screen. Violet is default; add one other only when meaningful.
- Don't use pure black (#000). Always #0a0b1e base or deeper.
- Don't use white text on violet buttons without shadow/contrast verification — check AA contrast.
- Don't animate every element. Each screen should have 1–2 focal animations, rest is static or micro-subtle.
- Don't use stock "mobile game" chunky buttons. Keep edges sharp-ish (16px radius max for buttons), typography confident.
- Don't show the word "bot", "AI", "computer", "CPU", or anything that breaks the opponent-is-human illusion. Ever.

---

## References for Inspiration

- **Balatro** — dark, textured, confident typography, casino crossover
- **Pokerstars mobile** — premium dark theme, gold currency
- **Monument Valley 2** — refined color relationships, atmospheric depth
- **Apple Arcade game UIs** (generic) — polished motion, glass surfaces
- **Linear app** — typographic discipline, dark-mode excellence
- **Duolingo's character moments** — how to make an app feel "alive" without being cartoonish (apply selectively)

---

Build this in React Native + Expo, using NativeWind (Tailwind) or StyleSheet, with `react-native-reanimated` + `moti` for motion. Fonts loaded via `expo-font`. All copy in English.
