# CipherBreaker — Uygulama Yol Haritası v4 (FINAL)

> **v4 değişiklikleri** (production safety):
> - **Persist storm** çözümü: Durable / Transient state ayrımı (matchStore vs liveMatchStore)
> - **RNG resume** problemi: RNG state'i serializable, callCount tracking
> - **JS thread blocking**: Heavy filtering chunk'lara bölünür (yieldToUI helper)
> - **Bitiş şartları**: feedback.isWin yetmez — checkEndConditions(state) helper, tüm outcome senaryoları
> - **Blitz grace period**: Background'a düşünce 5sn tolerans, geçen süre saatten düşülür (UX)
>
> **v3 değişiklikleri** (mimari):
> - ID duplication düzeltildi (sadece root'ta)
> - SolverStates opsiyonel hale getirildi
> - checkWinCondition kaldırıldı (feedback.isWin tek kaynak win check için)
> - Hata stratejisi netleşti (kullanıcı hatası → return, mimari hatası → throw)
> - Phase modeli okunaklı (setup/active_turn_*/active_parallel/completed)
> - Faz 7 ikiye bölündü (7A: economy + UX, 7B: resilience + dev tools)

---

## 🧭 Mimari Sözleşme (Final)

### Plug-in Mod Sistemi — 3 Katman

```
src/game/modes/mode1ColorMatch.ts        ← saf domain (NO React import)
src/components/game/rows/Mode1Row.tsx    ← UI feedback rendering
src/game/renderers.ts                    ← modeId → row component eşlemesi
```

### Tipler — Sıkı, Tek Yer

```typescript
// === META (id YOK, root'ta tek) ===
type ModeMeta = {
  section: 'classic' | 'advanced'
  name: string
  description: string
  stake: number
  rewardWin: number
  rewardDraw: number
  badge?: { label: string; color: string }
  gradient: [string, string]    // tuple - exact 2 colors
  iconKey: string                // icon registry'de eşleşir
}

// === RULES ===
type ModeRules = {
  secretLength: 4
  digitsUnique: boolean
  maxGuessesPerPlayer?: number
  perPlayerTimeLimitMs?: number
  flags: {
    parallelMode?: boolean        // Mirror için
    skipSecretSetup?: boolean     // sistem secret üretir
  }
}

// === FEEDBACK (sıkı discriminated union) ===
type NormalizedFeedback =
  | { kind: 'colorMatch'; cells: CellState[]; isWin: boolean }
  | { kind: 'direction'; direction: 'higher' | 'lower'; isWin: boolean }
  | { kind: 'precision'; correct: number; misplaced: number; isWin: boolean }
  | { kind: 'blackout'; lockedCount: number; isWin: boolean }

type CellState = 'correct' | 'misplaced' | 'absent'

// === VALIDATION (KULLANICI HATASI - RETURN) ===
type ValidationResult =
  | { ok: true }
  | { ok: false; error: ValidationError }

type ValidationError = {
  code: 'WRONG_LENGTH' | 'NOT_DIGITS' | 'NOT_UNIQUE' | 'OUT_OF_RANGE'
  message: string  // i18n key veya direkt UI mesajı
}

// === SOLVER STATE (opsiyonel her iki taraf için) ===
type SolverState =
  | { kind: 'candidatePool'; pool: string[] }
  | { kind: 'blackoutConstraints'; pool: string[]; constraints: BlackoutConstraint[] }
  | { kind: 'mirror'; pool: string[]; targetTurn: number }

type SolverStates = {
  player?: SolverState     // ileride hint mode, autoplay, AI-vs-AI için
  opponent?: SolverState
}

// === BOT CONTEXT ===
type BotContext = {
  previousGuesses: GuessEntry[]   // bu bot'un kendi geçmişi
  mySecret: string
  difficulty: 'easy' | 'normal' | 'hard'
  turnNumber: number
  solverState: SolverState
}

// === MODE DEFINITION (NO checkWinCondition - feedback.isWin tek kaynak) ===
interface ModeDefinition {
  id: number                  // SINGLE source of truth
  meta: ModeMeta              // id YOK içinde
  rules: ModeRules
  
  generateSecret(rng: RNG): string
  validateGuess(guess: string): ValidationResult
  evaluate(guess: string, secret: string): NormalizedFeedback  // isWin field'ı dolu döner
  
  bot: {
    initSolverState(secret: string, rules: ModeRules): SolverState
    makeGuess(context: BotContext): { guess: string; newSolverState: SolverState }
    thinkingTime(context: BotContext): number
  }
}

// === MATCH STATE (phase okunaklı) ===
type MatchPhase =
  | 'setup'                      // gizli sayı belirleniyor
  | 'active_turn_player'         // oyuncu sırası
  | 'active_turn_opponent'       // bot sırası
  | 'active_parallel'            // Mirror modu
  | 'completed'                  // bittiyse result dolu

type MatchState = {
  modeId: number
  playerSecret: string
  opponentSecret: string         // Mirror'da aynı
  playerGuesses: GuessEntry[]
  opponentGuesses: GuessEntry[]
  
  phase: MatchPhase
  result: MatchResult | null     // sadece phase === 'completed' iken dolu
  
  // Mod-spesifik DURABLE state
  guessLimits?: GuessLimits      // Mode 6 - tahmin sonrası güncellenir
  solverStates?: SolverStates    // bot için - tahmin sonrası güncellenir
  
  // RNG STATE (resume için kritik!)
  rngState: { seed: number; callCount: number }
  
  // Clock state YALNIZCA persist anında snapshot
  // Live clock değeri liveMatchStore'da (transient) tutulur
  clockSnapshot?: ClockSnapshot
  
  startedAt: number
  lastUpdatedAt: number
}

// DURABLE clock snapshot — sadece persist için
type ClockSnapshot = {
  playerMs: number               // son tahmin anındaki kalan süre
  opponentMs: number
  activeOwner: 'player' | 'opponent' | null
  snapshotTimestamp: number      // bu snapshot ne zaman alındı
}

// TRANSIENT live clock — liveMatchStore'da, persist EDİLMEZ
type LiveClockState = {
  playerMs: number               // her tick güncellenir
  opponentMs: number
  activeOwner: 'player' | 'opponent' | null
  lastTickAt: number             // hesaplama için
}

type MatchResult =
  | { outcome: 'player_won'; reason: 'cracked' | 'opponent_time_out' | 'opponent_guess_limit'; turns: number }
  | { outcome: 'opponent_won'; reason: 'cracked' | 'player_time_out' | 'player_guess_limit'; turns: number }
  | { outcome: 'draw'; reason: 'simultaneous_crack'; turns: number }
  | { outcome: 'stalemate'; reason: 'both_exhausted'; turns: number }
```

### State Ayrımı: Durable vs Transient (KRİTİK)

**Sorun**: Eğer her 100ms'de Zustand state değişirse ve store persist ediliyorsa, AsyncStorage'a saniyede 10 yazma → UI thread boğulması, frame drop, pil tüketimi.

**Çözüm**: İki ayrı store.

```typescript
// src/state/matchStore.ts — DURABLE (persist edilir)
interface MatchStore {
  matchState: MatchState | null   // sadece tahmin yapıldığında, faz değişiminde güncellenir
  // Setter'lar persist'e yol açar - frequent değil!
  startMatch, submitPlayerGuess, submitOpponentGuess, endMatch
}

// src/state/liveMatchStore.ts — TRANSIENT (persist EDİLMEZ)
interface LiveMatchStore {
  liveClocks: LiveClockState | null  // her tick burada güncellenir
  // Setter'lar persist'e yol açmaz - hızlı!
  tickClock, syncClockFromMatchState, clearLiveClocks
}
```

**Akış**:
1. Maç başlarken: `matchStore.startMatch()` → `liveMatchStore.syncClockFromMatchState()`
2. Her tick (100ms): `liveMatchStore.tickClock()` — sadece transient güncellenir, persist yok
3. Tahmin yapıldığında: 
   - `matchStore.submitGuess()` çağrılır
   - matchStore içinde `clockSnapshot` güncellenir (current liveClock değerleri yazılır)
   - liveMatchStore yeni snapshot'tan resync olur
4. Timeout durumunda (live clock 0'a düşünce):
   - `liveMatchStore` MatchScreen'i bilgilendirir
   - MatchScreen `matchStore.endMatch('player_time_out')` çağırır
   - Persist olur

**Resume akışı**:
1. App açılınca matchStore hydrate olur, `clockSnapshot` ile beraber
2. `liveMatchStore.syncClockFromSnapshot(snapshot)` çağrılır
3. **Önemli**: `Date.now() - snapshotTimestamp` farkı active player'ın saatinden düşülür (eğer policy "background'da süre akar" ise)
4. Veya policy "background pause" ise farkı düşmez (bizim durumda Blitz background → kayıp policy, bu konu Faz 7B'de)

### RNG State — Serializable, Resume-Safe

**Sorun**: createRNG(42) tek seferlik state oluşturur. Closure içinde `currentValue` değişkeni tutar. Persist edilince closure kaybolur, hydrate'de aynı seed'le başlasa bile **kaç kez next() çağrıldığını bilmez** → bot tahminleri resume sonrası farklı.

**Çözüm**: RNG state'i her zaman `{ seed, callCount }` olarak serializable tut.

```typescript
// src/lib/random.ts
export type RNGState = {
  seed: number
  callCount: number
}

export interface RNG {
  next(): number              // 0..1
  int(min: number, max: number): number
  pick<T>(arr: T[]): T
  shuffle<T>(arr: T[]): T[]
  weightedPick<T extends string>(weights: Record<T, number>): T
  
  getState(): RNGState        // serialize için
  // toplam çağrı sayısı state'e yansır
}

export function createRNG(stateOrSeed: RNGState | number): RNG {
  const state = typeof stateOrSeed === 'number' 
    ? { seed: stateOrSeed, callCount: 0 }
    : { ...stateOrSeed }
  
  // Pure deterministic algorithm (örn: mulberry32 veya splitmix32)
  // Her next() çağrısında callCount++
  // Aynı seed + aynı callCount → her zaman aynı sıradaki sayı
  // Hydrate'de createRNG(savedState) → tam kaldığı yerden devam
}
```

**Engine kullanımı**:
- `createMatch` çağrıldığında RNG yaratılır, `state.rngState = rng.getState()` yazılır
- Her bot tahmininden sonra: `state.rngState = rng.getState()` güncellenir
- Persist edilen state'te `rngState` her zaman güncel
- Resume'da: `const rng = createRNG(state.rngState)` → tam kaldığı yerden

**Test edilebilirlik bonus**: Aynı maçı tekrar oynatmak (replay) için seed + initial state yeterli. Snapshot test'leri çok kolay.

### Heavy Filtering — UI Thread Blocking Çözümü

**Sorun**: Mode 3 (5040 permütasyon) veya Mode 5 (constraint solver) bot tahminlerinde havuzu filtreleme JS tek thread'i bloke eder. Mirror'da kullanıcı tahmin yaparken bot arka planda çalışıyorsa donma riski var.

**Çözüm**: Chunked filtering — pure function'ı `await yieldToUI()` ile parçala.

```typescript
// src/game/shared/asyncHelpers.ts
export async function yieldToUI(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

// src/game/shared/candidatePool.ts
export async function filterByFeedbackChunked<T>(
  pool: string[],
  evaluator: (candidate: string) => boolean,
  chunkSize = 500
): Promise<string[]> {
  const result: string[] = []
  for (let i = 0; i < pool.length; i += chunkSize) {
    const chunk = pool.slice(i, i + chunkSize)
    for (const candidate of chunk) {
      if (evaluator(candidate)) result.push(candidate)
    }
    if (i + chunkSize < pool.length) {
      await yieldToUI()  // UI thread'e nefes
    }
  }
  return result
}
```

**Kullanım kuralları**:
- Pool boyutu < 1000 → sync filtering OK (Mode 1, 2 için bu yeterli)
- Pool boyutu ≥ 1000 → chunked async (Mode 3, 5 için zorunlu)
- Bot.makeGuess artık async olabilir — interface güncelle:
  ```typescript
  bot: {
    makeGuess(context: BotContext): Promise<{ guess: string; newSolverState: SolverState }>
  }
  ```
- Engine de async olur — submitGuess'in çağrı tarafı await'ler

**Performans hedefi**: Bot düşünme süresi zaten 2-12 sn arası — chunked filtering 100-300ms ekler, kullanıcı fark etmez. Ama tek seferde 5040 öğeyi 800ms'de işlemek = 50 frame drop, görünür kasma.

### Bitiş Şartları — checkEndConditions Helper

**Sorun**: `feedback.isWin` sadece "bu tahmin doğruyu mu buldu" diyor. Maç bitiş senaryoları çok daha geniş:
- Mode 4: süre doldu (timeout)
- Mode 6: tahmin hakkı bitti (guess limit)
- Mode 6: ikisi de hakkını tüketti, kimse bulamadı (stalemate)
- Tüm modlar: tahmin doğru (cracked)
- Berabere: ikisi de aynı turda buldu (simultaneous_crack)

**Çözüm**: `checkEndConditions(state)` helper. Engine'de `submitGuess` ve `tick` her zaman bu helper'ı çağırır.

```typescript
// src/game/engines/checkEndConditions.ts
export function checkEndConditions(
  state: MatchState, 
  mode: ModeDefinition
): MatchResult | null {
  // 1. Crack kontrolü (her iki taraf için)
  const playerLastFeedback = lastFeedback(state.playerGuesses)
  const opponentLastFeedback = lastFeedback(state.opponentGuesses)
  const playerCracked = playerLastFeedback?.isWin ?? false
  const opponentCracked = opponentLastFeedback?.isWin ?? false
  
  if (playerCracked && opponentCracked) {
    return { outcome: 'draw', reason: 'simultaneous_crack', turns: ... }
  }
  if (playerCracked) {
    return { outcome: 'player_won', reason: 'cracked', turns: ... }
  }
  if (opponentCracked) {
    return { outcome: 'opponent_won', reason: 'cracked', turns: ... }
  }
  
  // 2. Time out kontrolü (Mode 4)
  if (mode.rules.perPlayerTimeLimitMs && state.clockSnapshot) {
    if (state.clockSnapshot.playerMs <= 0) {
      return { outcome: 'opponent_won', reason: 'player_time_out', turns: ... }
    }
    if (state.clockSnapshot.opponentMs <= 0) {
      return { outcome: 'player_won', reason: 'opponent_time_out', turns: ... }
    }
  }
  
  // 3. Guess limit kontrolü (Mode 6)
  if (mode.rules.maxGuessesPerPlayer && state.guessLimits) {
    const playerExhausted = state.guessLimits.playerRemaining === 0
    const opponentExhausted = state.guessLimits.opponentRemaining === 0
    
    if (playerExhausted && opponentExhausted) {
      return { outcome: 'stalemate', reason: 'both_exhausted', turns: ... }
    }
    if (playerExhausted) {
      return { outcome: 'opponent_won', reason: 'player_guess_limit', turns: ... }
    }
    if (opponentExhausted) {
      return { outcome: 'player_won', reason: 'opponent_guess_limit', turns: ... }
    }
  }
  
  // Maç devam ediyor
  return null
}
```

**Engine'de kullanımı**:
```typescript
// turnBasedEngine.submitGuess
function submitGuess(state, guess, author) {
  // ... validation, evaluate, append guess ...
  const newState = { ...state, /* updated guesses, limits */ }
  
  const result = checkEndConditions(newState, mode)
  if (result) {
    return { 
      state: { ...newState, phase: 'completed', result },
      feedback,
      error: null
    }
  }
  
  return { 
    state: advanceTurn(newState),  // sıra değiştir
    feedback, 
    error: null 
  }
}

// MatchScreen useEffect — clock tick
useEffect(() => {
  const interval = setInterval(() => {
    // Sadece live clock güncelle (transient store)
    liveMatchStore.tickClock()
    
    // Eğer 0'a düştüyse: matchStore'a snapshot'ı yansıt
    const live = liveMatchStore.liveClocks
    if (live && (live.playerMs <= 0 || live.opponentMs <= 0)) {
      matchStore.applyTimeout()  // bu durable update
      // matchStore içinde checkEndConditions çağrılır
    }
  }, 100)
  return () => clearInterval(interval)
}, [])
```

### Hata Stratejisi (Net Çizgi)

| Durum | Davranış | Örnek |
|-------|----------|-------|
| **Kullanıcı hatası** | Structured return (`ValidationResult`) | Geçersiz tahmin ("1122" Mode 3'te) |
| **Engine return** | Result objesinde error field | submitGuess invalid girişe `{ state, feedback: null, error }` döner |
| **Mimari/program hatası** | `throw` (Error class) | Mode registry'de id yok → `ModeNotFoundError` |
| **State corruption** | `throw` | Match state inconsistent → `EngineStateError` |

**Kural**: User-facing hata asla throw etmez. Throw = developer'ın görmesi gereken, code path'te oluşmaması gereken durum.

### Engine Ayrımı

```
src/game/engines/
  ├── turnBasedEngine.ts     ← Mod 1, 2, 3, 4, 5, 6
  ├── parallelEngine.ts      ← Mod 7 (Mirror)
  └── index.ts               ← router (selectEngine(mode))

src/game/shared/             ← her iki engine'in kullandığı pure helpers
  ├── candidatePool.ts
  ├── secretGeneration.ts
  ├── feedback.ts
  ├── botHelpers.ts
  └── validation.ts
```

`mode.rules.flags.parallelMode === true` ise router parallelEngine'i seçer.

---

## 📅 Faz 0 — Setup + Dev Stack (3-4 saat)

**Amaç**: Boş ama ciddi Expo projesi, lint/format/typecheck/test komutları hazır.

### Terminal:

```bash
mkdir ~/cipherbreaker && cd ~/cipherbreaker
mkdir reference && cd reference
unzip ~/Downloads/Guess.zip
cd ..
cp ~/Downloads/CipherBreaker-SPEC.md .
cp ~/Downloads/CipherBreaker-DESIGN-PROMPT.md .
cp ~/Downloads/CipherBreaker-ROADMAP-v3.md .

# Fontları indir (Google Fonts'tan):
# Chakra Petch (700, 900), Inter (400, 500, 600), JetBrains Mono (700)
mkdir fonts-download
# .ttf dosyalarını manuel ekle

claude
```

### Claude Code prompt:

```
4 kaynak: SPEC, DESIGN-PROMPT, ROADMAP-v3, reference/

FAZ 0 — KURULUM:

1. Üç doküman + reference'ı oku, tek paragrafta özetle.

2. Expo TypeScript projesi:
   npx create-expo-app@latest . --template expo-template-blank-typescript

3. Klasör yapısı:
   src/
     game/
       modes/              ← mod tanımları (NO React)
       engines/            ← turnBasedEngine, parallelEngine
       shared/             ← helpers
       __tests__/
     components/
       game/rows/          ← mod-spesifik UI
     screens/
     navigation/
     state/
     data/
     theme/
     lib/
       dev/                ← debug paneli

4. Dev stack:
   - TypeScript strict (tsconfig "strict": true, "noUncheckedIndexedAccess": true)
   - ESLint (@react-native, typescript-eslint)
   - Prettier
   - Jest + jest-expo + @testing-library/react-native
   - Path aliases: @/, @game/, @components/, @screens/, @theme/
   - .editorconfig
   - Husky pre-commit (typecheck + lint)

5. package.json scripts:
   - "typecheck": "tsc --noEmit"
   - "lint": "eslint src --ext .ts,.tsx"
   - "format": "prettier --write src"
   - "test": "jest"
   - "test:watch": "jest --watch"
   - "ci": "npm run typecheck && npm run lint && npm run test"

6. Font yükleme (expo-font + assets/fonts/).

7. reference/tokens.js → src/theme/tokens.ts (typed).
   + src/theme/typography.ts (font scale)
   + src/theme/spacing.ts

8. RootNavigator iskeleti, PlaceholderScreen.

9. iOS Simulator + npm run ci geçmeli.

10. README.md kuruluma başla.
```

### Başarı kriteri:
- [ ] `npm run ci` geçer
- [ ] iOS Simulator'da bg-base + başlık (Chakra Petch font)
- [ ] Path alias çalışıyor
- [ ] Hot reload çalışıyor
- [ ] Pre-commit hook test edildi
- [ ] git init + ilk commit

---

## 📅 Faz 1 — Tüm Ekranlar, Mock Data (1 gün)

**Amaç**: 9 ekran görsel olarak çalışır, navigasyon var, logic yok.

**Önemli**: Mock data **gerçek registry shape**'inde olsun (id duplication yok!).

### Claude Code prompt:

```
FAZ 1 — EKRANLAR:

1. src/game/types.ts oluştur — ROADMAP'teki tipler:
   - ModeMeta (id YOK içinde)
   - NormalizedFeedback discriminated union
   - GuessEntry, PlayerProfile
   - ValidationResult { ok: true } | { ok: false; error }
   - MatchPhase (okunaklı versiyon)
   
2. src/data/modeCatalog.ts:
   - Array<{ id: number; meta: ModeMeta; rules: ModeRules }>
   - 7 mod META + RULES bilgisi (logic YOK, sadece data)
   - reference/modes.js'ten port et ama tip uyumlu yap
   - id sadece root'ta

3. src/data/mockUser.ts, mockOpponents.ts

4. src/components/ shared primitives 
   (reference/components.jsx → RN port):
   - TokenBadge, TokenCoin, ModeCard, OpponentCard
   - DigitTile, DigitKeypad, TinyTag, LevelBar
   - AmbientBackground, Avatar, RadarAnimation
   - TypingIndicator, ConfettiOverlay
   
   reference @keyframes → moti animasyonları.
   Her primitive için snapshot test.

5. src/components/game/rows/ — placeholder satırlar:
   - Mode1Row, Mode2Row, Mode3Row, Mode4Row, Mode5Row, 
     Mode6Row, Mode7Row
   Her biri kendi NormalizedFeedback tipini props'ta alır.
   Statik feedback ile render (logic YOK).

6. src/game/renderers.ts:
   guessRowRenderers: Record<number, ComponentType<RowProps>>
   { 1: Mode1Row, 2: Mode2Row, ... }

7. src/screens/ - 9 ekran (reference'a 1:1):
   OnboardingScreen, HomeScreen, MatchmakingScreen,
   SecretSetupScreen, MatchScreen, MatchResultScreen,
   ShopScreen, AdWatchScreen, ProfileScreen

8. RootNavigator (react-navigation native-stack).

9. HomeScreen modeCatalog'dan 7 kart render.
   Tıklayınca Matchmaking → SecretSetup → Match → Result.

10. MatchScreen renderers.ts'ten doğru row'u alır
    (modeId'ye göre).

11. MatchResultScreen 4 variant test butonu
    (victory/defeat/draw/stalemate).

BU FAZDA YOK: oyun motoru, bot, persist.
```

### Başarı kriteri:
- [ ] 9 ekran erişilebilir, prototiple ~%95 uyumlu
- [ ] modeCatalog'da id sadece root'ta (no duplication)
- [ ] HomeScreen 7 kartı doğru gösteriyor
- [ ] MatchScreen mod'a göre doğru row component
- [ ] Result 4 variant
- [ ] `npm run ci` temiz

---

## 📅 Faz 2 — Mimari + Test Infra (1 gün)

**Amaç**: Engine, store, registry, helpers, test infra. **Hiçbir mod yok**.

### Claude Code prompt:

```
FAZ 2 — OYUN MOTORU İSKELETİ:

1. src/game/types.ts'i tamamla (ROADMAP'teki tüm tipler):
   - ModeDefinition (NO checkWinCondition)
   - ModeRules (flags dahil)
   - SolverState union, SolverStates opsiyonel
   - BotContext
   - MatchState (rngState, clockSnapshot dahil — durable)
   - LiveClockState (transient — persist edilmez)
   - MatchPhase, MatchResult discriminated union
   - GuessLimits, ClockSnapshot

2. src/game/errors.ts:
   - ModeNotFoundError extends Error
   - InvalidEngineStateError extends Error
   - SolverStateMismatchError extends Error
   Her error: code, kullanıcı mesajı, original cause.
   
   NOT: ValidationError TYPE'tır, throw edilmez.

3. src/game/constants.ts:
   - SECRET_LENGTH = 4
   - BOT_THINK_MIN_MS = 2000
   - BOT_THINK_MAX_MS = 12000
   - BLITZ_TIME_LIMIT_MS = 60000
   - BLITZ_GRACE_PERIOD_MS = 5000    // UX tolerance
   - SUDDEN_DEATH_MAX_GUESSES = 5
   - DAILY_AD_LIMIT = 10
   - DAILY_AD_REWARD = 50
   - FILTER_CHUNK_SIZE = 500         // chunked filtering
   - AD_COOLDOWN_MS = 300000         // ileride opsiyonel
   Hepsi tek yerden — magic number'lar kodda dağılmasın.

4. src/game/shared/ helpers (pure):
   - candidatePool.ts:
     buildAllCandidates(unique): string[]  (lazy + cached)
     filterByFeedback(pool, history, evaluator): string[]  (sync, küçük havuzlar için)
     filterByFeedbackChunked(pool, evaluator, chunkSize=500): Promise<string[]>
       — UI thread'i bloke etmez, await yieldToUI() ile parçalı
   - asyncHelpers.ts:
     yieldToUI(): Promise<void>  // setTimeout(0) wrapper
   - secretGeneration.ts:
     generateRandomDigits(length, unique, rng): string
   - feedback.ts:
     isWinningFeedback(f: NormalizedFeedback): boolean
     lastFeedback(guesses): NormalizedFeedback | null
   - botHelpers.ts:
     selectByDifficulty(pool, difficulty, rng)
     randomThinkingTime(difficulty, turnNumber, rng)
   - validation.ts:
     validateLength, validateDigitsOnly, validateUnique
     composeValidators(...) → first failure or ok

5. src/game/modeRegistry.ts:
   - class ModuleRegistry, register, get (throws), getOrNull, 
     getAll, getBySection
   - Singleton instance: export const modeRegistry

6. src/game/engines/checkEndConditions.ts (MİMARİ SÖZLEŞMEDE TAM SPEC):
   - export function checkEndConditions(state, mode): MatchResult | null
   - Kontrol sırası:
     1. Crack (her iki taraf): playerCracked && opponentCracked → draw
     2. Tek crack → ilgili taraf kazanır
     3. Time out (Mode 4)
     4. Guess limit (Mode 6) → stalemate veya tek taraf kayıp
     5. null = devam ediyor
   - Bu helper hem engine'de hem store'da kullanılır

7. src/game/engines/turnBasedEngine.ts (mod-agnostik, async):
   - createMatch(modeId, playerSecret, rngState): MatchState
     phase: 'setup' başlangıçta
     state.rngState = rngState (her zaman serializable)
   - startMatch(state, rng): MatchState
     phase 'setup' → rastgele active_turn_player veya active_turn_opponent
     bot için solverState init
   - submitGuess(state, guess, author, rng): Promise<{
       state: MatchState
       feedback: NormalizedFeedback | null
       error: ValidationError | null
     }>
     - validateGuess başarısızsa: { state, null, error }
     - başarılıysa: 
       * evaluate sonucu ile state güncelle
       * checkEndConditions çağır
       * eğer result varsa: phase='completed', result yazılır
       * yoksa: advanceTurn
       * state.rngState = rng.getState()  ← her zaman güncel
   - advanceTurn(state): MatchState
   - applyTimeout(state, mode): MatchState  
     // MatchScreen'den çağrılır, clockSnapshot 0 olduğunda
     // checkEndConditions çağırır, result set eder
   - applyClockSnapshot(state, snapshot): MatchState
     // Tahmin öncesi clockSnapshot güncellenir
   
   ÖNEMLİ: tick fonksiyonu YOK (artık liveMatchStore'da)
   Engine sadece event-driven, time-driven değil.

8. src/game/engines/parallelEngine.ts (Mirror için iskelet):
   - Aynı interface, async
   - Faz 6'da dolar, şimdilik stub

9. src/game/engines/index.ts:
   selectEngine(mode) → flags.parallelMode ? parallel : turnBased

10. src/lib/random.ts:
    - export type RNGState = { seed: number; callCount: number }
    - export interface RNG { next, int, pick, shuffle, weightedPick, getState }
    - createRNG(stateOrSeed: RNGState | number): RNG
    - Pure deterministic (mulberry32 önerilir):
      * Her next() callCount++
      * getState() return { seed, callCount }
      * Aynı state ile yeniden create → tam kaldığı yerden
    - TEST: createRNG(42).next().next() === createRNG({seed:42, callCount:0}).next().next()

11. src/state/ Zustand stores:
    
    A) src/state/userStore.ts (DURABLE, persist):
       - tokens, xp, level, stats, username, avatar
       - AsyncStorage persist
       - Migration version field (storageVersion: 1)
       - Actions: addTokens, subtractTokens, addXp, recordMatchResult
    
    B) src/state/matchStore.ts (DURABLE, persist):
       - matchState: MatchState | null
       - Frequent değil! Sadece tahmin/timeout/setup'ta güncellenir
       - Actions: 
         * createMatch(modeId, playerSecret) — store yeni rng yaratır
         * startMatch() — phase setup'tan çıkar
         * submitGuess(guess, author) — engine.submitGuess çağırır + checkEndConditions
         * applyTimeout(side) — MatchScreen'den çağrılır
         * endMatch(result) — kapanış
         * clearMatch() — yeni maç için sıfırla
       - AsyncStorage persist + migration
    
    C) src/state/liveMatchStore.ts (TRANSIENT, persist YOK):
       - liveClocks: LiveClockState | null
       - sound state, ephemeral UI flags
       - Actions:
         * syncFromMatchState(matchState) — clockSnapshot'tan sync
         * tickClock(deltaMs) — sadece in-memory update
         * clear() — maç bitince
       - persist OLMAZ (Zustand persist middleware kullanma)
       - Bu store sıkça update edilebilir, AsyncStorage'a dokunmaz
    
    D) src/state/settingsStore.ts (DURABLE, persist):
       - devMode, sound, haptics, hasCompletedOnboarding
       - AsyncStorage persist

12. src/game/difficulty.ts (DDA - SPEC 5.5)

13. TEST INFRA:
    - jest.config.js + ts-jest
    - src/game/__tests__/random.test.ts:
      * Seed determinism
      * State serialize + deserialize tutarlılık
      * createRNG({seed:42, callCount:5}) === createRNG(42).next x 5 sonrası
    - candidatePool.test.ts (build + filter sync + chunked)
    - asyncHelpers.test.ts (yieldToUI)
    - turnBasedEngine.test.ts (smoke - empty registry)
    - checkEndConditions.test.ts (TÜM bitiş senaryoları):
      * cracked, simultaneous_crack, time_out, guess_limit, stalemate
    - registry.test.ts (ModeNotFoundError)
    - validation.test.ts (compose)
    - matchStore.test.ts (durable updates only)
    - liveMatchStore.test.ts (no persist verification)

14. ARCHITECTURE.md (proje kökü):
    - Plug-in mod sistemi neden?
    - Domain vs Presentation ayrımı
    - Hata stratejisi (return vs throw çizgisi)
    - Yeni mod ekleme adımları (5 madde)
    - Engine + orchestration ayrımı
    - SolverState pattern
    - **Durable vs Transient state ayrımı** (matchStore vs liveMatchStore)
    - **RNG state serialization** (resume için kritik)
    - **Heavy filtering chunking** (yieldToUI pattern)
    - **checkEndConditions kullanımı** (her tahmin/timeout sonrası)
    - Phase modeli

BU FAZDA YOK: hiçbir spesifik mod.
```

### Başarı kriteri:
- [ ] modeRegistry.get(1) → ModeNotFoundError
- [ ] Zustand persist çalışıyor
- [ ] createRNG(42) deterministik
- [ ] candidatePool test'leri geçer
- [ ] Validation chain helper test geçer
- [ ] `npm run ci` temiz
- [ ] ARCHITECTURE.md "yeni mod nasıl eklenir" 5 madde + "hata stratejisi" çizgisi
- [ ] MatchScreen "no mode found" placeholder

---

## 📅 Faz 3 — Mod 1 (Color Match) — REFERANS MOD (1 gün)

**Amaç**: İlk modu uçtan uca. Şablon olacak.

**Faz 3 özel kuralları** (KATI):
- mode1ColorMatch.ts 200 satırı geçerse böl
- candidate filtering pure function (test edilebilir)
- Bot stratejisi ayrı dosya (helpers/mode1Strategy.ts)
- UI row component AYRI (`components/game/rows/Mode1Row.tsx`)
- Mode dosyası React import ETMEZ

### Claude Code prompt:

```
FAZ 3 — MOD 1 REFERANS:

1. src/game/modes/mode1ColorMatch.ts:
   - ModeDefinition (NO checkWinCondition!)
   - id: 1 (root only)
   - meta: SPEC değerleri (id YOK içinde)
   - rules: { secretLength: 4, digitsUnique: false, flags: {} }
   - generateSecret(rng): rng.int(0, 9999).toString().padStart(4, '0')
   - validateGuess(guess): 
     composeValidators(
       validateLength(4), 
       validateDigitsOnly()
     )(guess)
     // Returns ValidationResult, NEVER throws
   - evaluate(guess, secret): 
     SPEC 3.2 Wordle algoritması
     Returns: { 
       kind: 'colorMatch', 
       cells: ['correct'|'misplaced'|'absent', ...],
       isWin: cells.every(c => c === 'correct')
     }
   - bot.initSolverState(secret, rules):
     { kind: 'candidatePool', pool: buildAllCandidates(false) }
   - bot.makeGuess(context): mode1Strategy.ts'e delege
   - bot.thinkingTime: shared/botHelpers'dan generic

2. src/game/modes/helpers/mode1Strategy.ts:
   - selectGuess(solverState, difficulty, turnNumber, rng): 
     { guess, newSolverState }
   - SPEC 4.3 stratejileri:
     * easy: %40 tutarlı pool, %60 tüm pool
     * normal: %85 tutarlı, %15 sub-optimal
     * hard: her zaman tutarlı
   - openingGuess(difficulty, rng): ilk tahmin

3. src/components/game/rows/Mode1Row.tsx:
   - Props: { feedback: ColorMatchFeedback; digits: string }
   - reference/screens-match.jsx GuessRowMode1 → RN
   - Tile reveal animasyonu (moti, stagger 60ms)
   - Green correct → glow

4. src/game/renderers.ts'i Mode1Row ile bağla.

5. src/game/modeRegistry.ts'e Mode 1 register et:
   modeRegistry.register(mode1ColorMatch)

6. matchEngine entegrasyonu:
   - createMatch(1, '1234', rng) → MatchState
   - startMatch(state) → phase atanır
   - submitGuess('1199', 'player') → 
     { state (yeni), feedback: { kind: 'colorMatch', cells: [...], isWin: false }, error: null }
   - feedback.isWin true ise phase 'completed', result dolu

7. MatchScreen Mode 1 ile çalışıyor:
   - Home → Mode 1 → Matchmaking → SecretSetup → Match → Result
   - Token akışı (-50, +100/+50/0)
   - Yanlış tahmin → ValidationError UI'da gösterilir 
     (toast veya inline)

8. TESTLER:
   - mode1.test.ts:
     * evaluate edge case'ler (özellikle gizli=1122 tahmin=1919)
     * isWin doğru hesaplanıyor
     * validateGuess yanlış girişte ok:false döner (THROW ETMEZ)
   - mode1Strategy.test.ts:
     * easy/normal/hard her zorlukta makul davranış
     * solver state tutarlılığı (filter'dan sonra pool küçülmeli)
   - mode1Row.test.tsx: snapshot
   - turnBasedEngine integration:
     * createMatch + submitGuess + win condition
     * invalid guess → error döner, state değişmez

9. CHECKPOINT:
   - ARCHITECTURE.md güncelle: "İlk mod yazıldıktan sonra şu paternler oturdu..."
   - mode1ColorMatch.ts satır sayısını kontrol et (<200)
   - Mode dosyası React import etmiyor mu? (grep -r "from 'react'" src/game/modes/)

DUR. Devam etmeden önce sor:
- Mode 1 dosya yapısı temiz mi?
- Helper'lara bölündü mü?
- Beğenmediğin bir şey var mı? Şimdi düzelt!
```

### Başarı kriteri:
- [ ] Mode 1 baştan sona oynanabilir
- [ ] Bot inandırıcı (2-12 sn değişken)
- [ ] Token akışı doğru
- [ ] Wordle tekrar test'leri (1122 vs 1919) geçer
- [ ] Mode 1 dosyası 200 satır altı
- [ ] Mode dosyasında `import 'react'` YOK
- [ ] Validation hatası throw etmiyor, structured return
- [ ] **ARCHITECTURE.md güncellendi**

---

## 📅 Faz 3.5 — Refactor Checkpoint (2-3 saat)

**Amaç**: Faz 4-5'te 5 mod eklenmeden önce ortak helper'lar.

### Claude Code prompt:

```
FAZ 3.5 — HELPER ÇIKARMA:

Mode 1'i incele. Tekrarlanma yüksek olanları shared/'a taşı:

1. src/game/shared/botHelpers.ts'i genişlet:
   - filterByPreviousFeedback<T>(pool, history, evaluator) — generic
   - selectByDifficulty(pool, difficulty, fallback, rng) — easy/normal/hard
   - randomThinkingTime(difficulty, turnNumber, rng)

2. src/game/shared/validation.ts'i tamamla:
   - validateLength, validateDigitsOnly, validateUnique
   - composeValidators(...) - failure short-circuit

3. src/game/shared/feedback.ts:
   - countCorrectPositions(guess, secret) - Wordle/Precision share
   - countMisplaced(guess, secret) - Wordle/Precision share
   - allCorrect(cells: CellState[]): boolean

4. Mode 1'i refactor et — bu helper'ları kullan.
   Hedef: 200 → 130-150 satır.

5. Tüm test'ler geçmeli.

6. ARCHITECTURE.md helper kataloğunu ekle.
```

---

## 📅 Faz 4 — Mod 2 + Mod 3 (Yarım gün)

### Claude Code prompt:

```
FAZ 4 — MOD 2 + MOD 3:

Mode 1 şablonu + Faz 3.5 helper'ları. Hızlı olmalı.

MOD 2 (High & Low):
- mode2HighLow.ts:
  rules: { secretLength: 4, digitsUnique: false, flags: {} }
  evaluate: SPEC 3.3
    Returns: { kind: 'direction', direction: 'higher'|'lower', isWin: equal }
- helpers/mode2Strategy.ts:
  binary search (havuz median'ına en yakın)
- Mode2Row.tsx: 4 tile + HIGHER/LOWER banner
- Tests: evaluate, strategy, integration

MOD 3 (Precision):
- mode3Precision.ts:
  rules: { secretLength: 4, digitsUnique: TRUE, flags: {} }
  validateGuess: composeValidators(length, digits, unique)
  evaluate: SPEC 3.4
    Returns: { kind: 'precision', correct, misplaced, isWin: correct === 4 }
- helpers/mode3Strategy.ts:
  candidate pool: 5040 permütasyon (lazy + cached)
  bot.makeGuess ASYNC (Promise return)
  Filtering: pool.length > 1000 → filterByFeedbackChunked() kullan
  yieldToUI() ile UI thread'i serbest bırak
- Mode3Row.tsx: 4 tile + +N −M score
- Tests: 
  * edge case (1122 input → ok:false)
  * evaluate doğruluk
  * chunked filtering test (büyük havuz, donma yok)

Her iki mod:
- modeRegistry register
- renderers.ts ekle
- Manual test full flow
```

### Başarı kriteri:
- [ ] 3 Classic mod tam çalışır
- [ ] Mode 3'te `1122` → ValidationError (no throw)
- [ ] Bot binary search mantıklı
- [ ] Tüm test'ler geçer

---

## 📅 Faz 5 — Mod 4 + 5 + 6 (Advanced — 1 gün)

### Claude Code prompt:

```
FAZ 5 — ADVANCED MODLAR:

MOD 4 (Blitz):
- mode4Blitz.ts:
  rules: { perPlayerTimeLimitMs: 60000 }
  evaluate: Mode 1 ile aynı (Wordle)

- TURN-BASED ENGINE değişikliği MİNİMAL:
  - Yeni helper: applyTimeout(state, side: 'player'|'opponent'): MatchState
    * Result set eder via checkEndConditions
  - Yeni helper: applyClockSnapshot(state, snapshot): MatchState
    * Tahmin öncesi clockSnapshot güncellenir
  - submitGuess: artık parametre olarak clockSnapshot da alır
    (current live clock değerlerini durable state'e yazar)
  
  ENGINE'DE TICK FONKSİYONU YOK — artık liveMatchStore'da

- liveMatchStore (TRANSIENT):
  - liveClocks state
  - tickClock(deltaMs) — her 100ms, sadece in-memory
  - syncFromMatchState(matchState) — durable'dan yükle
  
- MatchScreen useEffect:
  ```
  useEffect(() => {
    if (mode.id !== 4) return
    const interval = setInterval(() => {
      liveMatchStore.tickClock(100)
      const live = liveMatchStore.getState().liveClocks
      
      // Timeout kontrolü
      if (live && live.activeOwner === 'player' && live.playerMs <= 0) {
        matchStore.applyTimeout('player')  // durable update
      } else if (live && live.activeOwner === 'opponent' && live.opponentMs <= 0) {
        matchStore.applyTimeout('opponent')
      }
    }, 100)
    return () => clearInterval(interval)
  }, [mode.id])
  ```

- Mode4Row = Mode1Row + small "0:08s" badge
- bot.thinkingTime clock-aware (live clock'a bakar)
- Test:
  * applyTimeout doğru result üretiyor
  * checkEndConditions time_out kontrolü
  * liveMatchStore tick mantığı (sahte zaman ile)

MOD 5 (Blackout):
- mode5Blackout.ts:
  rules: { digitsUnique: TRUE }
  evaluate: { kind: 'blackout', lockedCount: N, isWin: N === 4 }
- helpers/mode5Strategy.ts:
  Constraint satisfaction:
  - solverState: { kind: 'blackoutConstraints', pool, constraints }
  - Her tur lockedCount constraint ekle
  - Pool filtreleme: hangi candidate'ler bu lockedCount'ları yapar?
  - **bot.makeGuess ASYNC** (Promise return)
  - filterByFeedbackChunked() kullan (5040 üzerinde constraint check ağır)
  - yieldToUI() ile UI thread'e nefes
- Mode5Row.tsx: tiles + "● N LOCKED" indicator (AYRI dosya)
- stake 100, reward 250 (modeCatalog'da)

MOD 6 (Sudden Death):
- mode6SuddenDeath.ts:
  rules: { maxGuessesPerPlayer: 5 }
  evaluate: Mode 1 ile aynı
- turnBasedEngine submitGuess'te:
  - guessLimits: { playerRemaining, opponentRemaining }
  - submitGuess decrement
  - checkEndConditions zaten guess limit'i kontrol ediyor (Faz 2'de eklendi)
  - both 0 → stalemate result
- MatchScreen 5-dot lives indicator
- Last guess "LAST GUESS" pulse
- MatchResultScreen stalemate variant + token refund

Her biri için:
- Tests
- modeRegistry + renderers
- Manual full flow

KRİTİK MİMARİ KURALLAR:
- Engine PURE — side effect yok
- Time-based event'ler MatchScreen'de (useEffect + interval)
- Clock state ikiye böl: durable snapshot (matchStore) + live (liveMatchStore)
- AsyncStorage'a saniyede 1 yazma'dan FAZLA YAZMA YOK
```

### Başarı kriteri:
- [ ] Mode 4 clock 0 → kayıp; bot zaman yönetir
- [ ] Mode 5 sadece sayı görünüyor; hangi digit gizli
- [ ] Mode 6 stalemate'de iade çalışıyor
- [ ] Result 4 variant doğru
- [ ] Tüm test'ler

---

## 📅 Faz 6 — Mod 7 (Mirror — paralel) (Yarım gün)

**Önce branch**: `git checkout -b mirror-mode`

### Claude Code prompt:

```
FAZ 6 — MIRROR PARALLEL ENGINE:

ÖNEMLİ: turnBasedEngine'e DOKUNMA.

1. mode7Mirror.ts:
   rules: { 
     digitsUnique: false, 
     flags: { parallelMode: true, skipSecretSetup: true } 
   }
   evaluate: Mode 1 ile aynı (Wordle)
   bot.makeGuess: mode7Strategy.ts (zamanlama-aware)

2. parallelEngine.ts:
   - createMatch(modeId, rng): 
     sistem secret üretir (secretGeneration helper)
     phase: 'active_parallel'
   - submitPlayerGuess(state, guess) → state
   - tickOpponent(state, deltaMs) → bot rastgele aralıkla guess
   - checkResult: önce çözen kazanır; aynı turda → draw

3. engines/index.ts router:
   selectEngine(mode) → mode.rules.flags.parallelMode ? parallel : turnBased

4. RootNavigator:
   Matchmaking sonrası mode.rules.flags.skipSecretSetup ise 
   SecretSetup'ı atla, direkt Match'e

5. MatchScreen Mirror variant:
   - Tek kolon (oyuncu tahminleri)
   - Üst banner: "SOLO RACE — Both solving the same code"
   - Sağ üstte mini opponent: "{name}: X guesses"
   - Tahminler GÖRÜNMEZ
   - Sporadik "{name} is guessing..." (rastgele 2-8 sn aralık)
   - Mode7Row = Mode1Row, parent layout farklı

6. mode7Strategy.ts:
   - "Yarış" hedefi: oyuncudan ±2 turda bitir
   - Bazı oyunlarda (1/3 ihtimalle) gerçekten önce bitir
     (sahte yanılsama önle)

7. MatchResultScreen Mirror:
   "You: 6 guesses · Opponent: 8 guesses"

8. TESTS:
   - parallelEngine ayrı suite
   - Mode 7 evaluate Mode 1 ile aynı

9. Manual full flow Mode 7 — 5+ kez oyna

10. turnBasedEngine.ts'te değişiklik var mı? 
    (git diff master -- src/game/engines/turnBasedEngine.ts)
    YOKSA tamam. Varsa düzelt.

Tamamlanınca branch merge.
```

### Başarı kriteri:
- [ ] Mirror oynanabilir, SecretSetup atlanır
- [ ] Rakip tahminleri görünmez, sadece tur sayısı
- [ ] Bot bazen senden önce bitiyor
- [ ] turnBasedEngine değişmedi
- [ ] 7 mod da Home'dan çalışır

---

## 📅 Faz 7A — Economy + UX Polish (1 gün)

**Amaç**: Token ekonomisi, profil, onboarding, haptics. Görünür kullanıcı deneyimi.

### Claude Code prompt:

```
FAZ 7A — ECONOMY + UX POLISH:

A. RAKİP ÜRETİMİ (src/game/opponentGenerator.ts):
   - SPEC Bölüm 6 tam implement
   - generateOpponent(): PlayerProfile
   - İsim havuzu, avatar, level (3-47), bayrak, last seen

B. TOKEN EKONOMİSİ:
   - InsufficientTokensModal entegre 
     (bakiye < min stake → modal göster)
   - AdWatchScreen fonksiyonel:
     * 5 sn countdown
     * +50 token
     * Günlük 10 sınırı (AsyncStorage tarih+sayaç)
     * Sınır aşımında "Bugünlük limit doldu" toast
   - ShopScreen sahte IAP modal'ı
   - Dev mode'da test token ekleme aktif (settingsStore)

C. PROFILE + XP:
   - SPEC 7.2 XP formülü (level = floor(sqrt(xp/50)) + 1)
   - Level up animasyonu (confetti + scale + sound future)
   - ProfileScreen mode-başı istatistik
   - Username düzenleme

D. ONBOARDING:
   - 3 slide animasyonlu (moti)
   - hasCompletedOnboarding flag (settingsStore + persist)
   - İlk açılışta gösterilsin
   - **Blitz tip**: İlk kez Blitz maç başlatan oyuncuya tek seferlik 
     küçük info-toast: "Quick tip: If you switch apps briefly, 
     your clock keeps running — but you have a few seconds grace 
     before it counts as a loss."
     settingsStore.hasSeenBlitzTip flag

E. HAPTICS:
   - expo-haptics integration:
     * Light: tahmin submit, button press
     * Medium: token earned, correct digit
     * Heavy: victory
     * Error: invalid input shake

F. ANIMASYON CİLA:
   - Page transition: slide right
   - Token counter animasyonu (0'dan hedefe roll)
   - Match start "VS" overlay
   - Victory confetti (canvas veya particle system)
```

### Başarı kriteri:
- [ ] İflas modal çalışıyor
- [ ] Reklam izleme +50 ekliyor, günlük limit
- [ ] XP doğru hesaplanıyor
- [ ] Onboarding ilk açılışta, sonra atlanıyor
- [ ] Haptic feedback hissedilir
- [ ] Dev mode'da test token ekleme

---

## 📅 Faz 7B — Resilience + Dev Tools (1 gün)

**Amaç**: Görünmez ama hayati. Crash recovery, error states, dev panel, analytics map.

### Claude Code prompt:

```
FAZ 7B — RESILIENCE + DEV TOOLS:

A. ERROR BOUNDARIES:
   - GlobalErrorBoundary (App.tsx wrap)
   - Crash → "Something went wrong" + Reset/Home buton
   - Error log (console + future analytics)

B. APPSTATE LIFECYCLE + RESUME:
   - src/lib/appLifecycle.ts:
     AppState listener (active/background/inactive)
   
   - Policy:
     * Mod 4 (Blitz): background → **5 saniye grace period** → sonra abandon
     * Diğer modlar: state korunur, geri gelince devam
   
   - **BLITZ GRACE PERIOD** (UX için kritik):
     Motivasyon: Kullanıcı telefonda çok şey yaşar — bildirim gelir, 
     yanlışlıkla swipe eder, biri seslenir, notification center açar. 
     Saniyesinde "kayıp" demek sert bir ceza. Küçük tolerans, 
     retention'a büyük etki eder.
     
     İmplementasyon:
     ```
     // appLifecycle.ts
     let blitzGraceTimer: NodeJS.Timeout | null = null
     const BLITZ_GRACE_MS = 5000
     
     function onAppStateChange(nextState: AppStateStatus) {
       const matchState = matchStore.getState().matchState
       const isBlitzActive = 
         matchState?.modeId === 4 && 
         matchState.phase !== 'completed'
       
       if (nextState === 'background' && isBlitzActive) {
         // Grace timer başlat — henüz abandon YOK
         blitzGraceTimer = setTimeout(() => {
           matchStore.applyTimeout('player')
           analytics.track('blitz_abandoned_timeout', { 
             graceMs: BLITZ_GRACE_MS 
           })
         }, BLITZ_GRACE_MS)
       }
       
       if (nextState === 'active' && blitzGraceTimer) {
         // Zamanında döndü — iptal et, abandon yok
         clearTimeout(blitzGraceTimer)
         blitzGraceTimer = null
         analytics.track('blitz_grace_recovered')
         // Live clock sync: arada geçen süre kullanıcı saatine yazılır
         // (yani 3 sn bg'de kaldıysa, 3 sn süre eksilmiş olur)
         const bgDuration = Date.now() - backgroundStartedAt
         liveMatchStore.subtractPlayerTime(bgDuration)
       }
     }
     ```
     
     **Önemli detay**: Grace içinde dönse bile, background'da geçen 
     süre kullanıcının saatinden DÜŞÜLÜR. Yani 3 sn kayboldu → saati 
     57 sn değil 54 sn devam eder. Böylece kullanıcı "ceza" yemez 
     ama tam exploit de yapamaz (bildirim okuyup dönmek).
     
     Test senaryosu:
     - Blitz başlat, 2 sn bg'de kal, dön → maç devam, saat 2sn az
     - Blitz başlat, 6 sn bg'de kal, dön → maç abandon, kayıp toast
     - Onboarding'de bu davranış kullanıcıya kısaca gösterilsin
       (yoksa sürpriz olur): "Blitz pauses briefly if you switch apps"
   
   - RESUME AKIŞI (uygulama kapatıldıktan sonra açılış):
     1. App açılınca matchStore hydrate olur (matchState + 
        clockSnapshot + rngState)
     2. Eğer matchState != null && phase != 'completed':
        a) **Blitz özel kural**: Mod 4 maçı varsa ve crash/kill 
           sebebiyle kapatılmışsa → otomatik abandon (grace period 
           uygulanmaz, çünkü dönüş süresi belirsiz). Kullanıcıya 
           "Your Blitz match was interrupted" toast + kayıp.
        b) Diğer modlar için modal: 
           "You have an unfinished match. Resume / Quit?"
           - Resume → 
             * liveMatchStore.syncFromMatchState(matchState)
             * Live clock = clockSnapshot (zaman akmaz)
             * RNG: createRNG(matchState.rngState)
             * MatchScreen'e navigate
           - Quit → 
             * matchStore.clearMatch()
             * Token iadesi YOK (oyuncu vazgeçti)
             * Home'a dön

   - **RNG Resume özellikle kritik**:
     matchState.rngState her tahminden sonra güncel.
     Restore'da createRNG(savedState) → bot tahminleri tutarlı.
     Test: aynı maçı save-load et, bot davranışı aynı olmalı.

   - Analytics event'leri (bu faz için):
     * blitz_grace_started { remainingClockMs }
     * blitz_grace_recovered { bgDurationMs }
     * blitz_abandoned_timeout { graceMs }
     * match_resumed_from_kill { modeId, guessCount }
     * match_quit_by_user { modeId, guessCount }

C. ASYNCSTORAGE RESILIENCE:
   - src/lib/storage.ts wrapper:
     * try/catch JSON.parse
     * Migration version check (storageVersion field)
     * Corruption → reset to defaults + log + analytics event
   - userStore + matchStore + settingsStore migration altyapısı:
     v1 → v2 mapping fonksiyonu (gelecek için iskelet)
   - matchStore özel: corruption durumunda silmek yerine 
     "lost match" toast göster + token iadesi (50%)

D. ERROR STATES (UI):
   - ModeNotFoundError → "Something went wrong" + Home
   - Storage corrupt → "Resetting your data..." + auto reset
   - Match state inconsistent → "Match interrupted" + Home + token iadesi
   - Toast component (src/components/Toast.tsx):
     * info, success, warning, error variant'ları

E. ANALYTICS EVENT MAP (src/lib/analytics.ts):
   - Henüz gerçek SDK yok, sadece event isimleri ve schema:
     * onboarding_completed
     * mode_selected { modeId, fromScreen }
     * matchmaking_started { modeId }
     * matchmaking_opponent_found { duration }
     * match_started { modeId, opponentName }
     * guess_submitted { modeId, isWin, turnNumber, durationMs }
     * match_result { modeId, outcome, turns, durationMs }
     * ad_watch_started, ad_watch_completed
     * shop_paywall_shown, shop_purchase_clicked
     * insufficient_tokens_shown
     * level_up { newLevel }
   - track(event, payload) → console.log
   - Sonra Mixpanel/Amplitude/PostHog kolayca takılır

F. DEV PANEL (src/lib/dev/DevPanel.tsx):
   - settingsStore.devMode true ise aktif
   - ProfileScreen'de gear icon long-press → DevPanel
   - Butonlar:
     * +1000 tokens
     * Set level to N
     * Reset onboarding
     * Reset ad counter
     * Force win/lose/draw current match
     * Trigger insufficient modal
     * Dump match state (console)
     * Clear all storage (with confirm)
     * Toggle every mode unlocked

G. PERFORMANS:
   - Candidate havuzları lazy + cached (modüle global)
   - FlatList virtualization (guess history > 20)
   - React.memo gerekirse
   - Profiler ile re-render kontrolü

H. BUG HUNT:
   - Her modu 5 kez oyna (W/L/D mix)
   - Edge case'ler:
     * İflas → ad watch → maç başlat
     * Onboarding → ilk maç
     * Maç ortasında uygulama kapat → resume
     * Blitz background → kayıp policy
     * Mode 6 stalemate → iade
   - TypeScript warnings: 0
   - Console warns: 0
   - npm run ci temiz
```

### Başarı kriteri:
- [ ] Uygulama kapat-aç → aktif maç restore
- [ ] Blitz background → kayıp policy çalışıyor
- [ ] DevPanel tüm butonlar işliyor
- [ ] AsyncStorage corrupt simülasyonu → graceful reset
- [ ] Crash → ErrorBoundary yakalıyor
- [ ] analytics.track() çağrıları console'da görünüyor
- [ ] Hiç crash, hiç error
- [ ] Bir arkadaşına ver, 5 dk sorunsuz oynasın

---

## 📦 Faz 8 (OPSİYONEL) — Store Hazırlığı

Ayrı hafta:
- RevenueCat IAP
- AdMob real ads
- Apple/Google hesaplar
- ToS + Privacy Policy (avukat)
- App Store Connect / Play Console
- 17+ rating
- Screenshots, app icon, splash
- TestFlight + Internal Testing

---

## 🎯 Zaman Çizelgesi v4

| Faz | İçerik | Süre |
|-----|--------|------|
| 0 | Setup + dev stack | 3-4 saat |
| 1 | Tüm ekranlar, mock data (registry shape) | 1 gün |
| 2 | Mimari + test infra + ARCHITECTURE.md (durable/transient ayrımı + RNG state + chunked filtering + checkEndConditions) | 1-1.5 gün |
| 3 | Mod 1 referans + checkpoint | 1 gün |
| 3.5 | Refactor checkpoint | 2-3 saat |
| 4 | Mod 2 + Mod 3 (Mode 3 chunked) | Yarım gün |
| 5 | Mod 4 + Mod 5 + Mod 6 (live clock store + chunked filtering) | 1-1.5 gün |
| 6 | Mod 7 (parallel) | Yarım gün |
| 7A | Economy + UX polish | 1 gün |
| 7B | Resilience + dev tools (RNG resume + AppState policy) | 1 gün |

**Toplam: ~8 gün** (gerçekçi 9-10). v3'e göre +1 gün ama production-safe.

---

## 🧠 v4'ün Altın Kuralları

1. **Mod dosyası React import etmez.** `grep -r "from 'react'" src/game/modes/` boş dönmeli.
2. **id sadece root'ta.** ModeMeta içinde id YOK.
3. **checkWinCondition YOK.** Engine her yerde `feedback.isWin` kullanır (sadece win check için).
4. **checkEndConditions her zaman çağrılır.** Win + timeout + guess limit + stalemate hep birlikte.
5. **Validation throw etmez.** `ValidationResult` döner. Sadece state corruption throw.
6. **SolverState player ve opponent için opsiyonel.** Hint mode/autoplay kapısı açık.
7. **Phase okunaklı.** `setup → active_turn_player/opponent/parallel → completed`.
8. **Durable vs Transient ayrımı.** matchStore persist edilir (event-driven update); liveMatchStore persist edilmez (tick-driven update). AsyncStorage'a saniyede 1+ yazma YOK.
9. **RNG state serializable.** `{ seed, callCount }` her tahmin sonrası matchState'e yazılır. Resume'da bot tutarlı.
10. **Heavy filtering chunked.** Pool > 1000 → `filterByFeedbackChunked` + `yieldToUI()`. Bot.makeGuess ASYNC.
11. **Engine pure, time-based event'ler MatchScreen'de.** Engine'de `tick` yok. Clock interval useEffect'te.
12. **Faz 3'te DUR.** Mode 1 şablonu beğenmedinse şimdi düzelt.
13. **Faz 6'da branch.** turnBasedEngine güvende.
14. **Resume policy ürün kararı.** Blitz → 5sn grace period, sonra kayıp; diğerleri → korunur (modal sürdür/iptal). Grace içinde dönen oyuncu cezalandırılmaz ama background'da geçen süre saatten düşer.
15. **Dev panel olmadan launch yok.** Saatler kazandırır.
16. **Analytics event isimleri şimdi tanımlı.** SDK sonra.
17. **ARCHITECTURE.md güncel kalır.** Yeni paternler oturdukça yaz.

---

## 🚨 Risk ve Geri Çekilme Planı

Eğer 1-2 gün geç kalırsan:
- **7B'yi v0.2'ye at**: Dev tools ve analytics map polish katmanı, MVP olmadan da çıkar (ama RNG resume + AppState policy KAL — onlar production-safe için zorunlu).
- **Mode 5 (Blackout) constraint solver'ı basit tut**: Önce naive (her tur full pool), sonra optimize.
- **Mirror'ı 2 güne çıkar**: Asla acele etme — engine kirlenmesi 1 hafta sonradan döner.

Ama mimari kararlar **baştan doğru olmak ZORUNDA** (sonradan refactor 3-4 gün alır):
- renderGuessRow ayrımı (UI/domain)
- Normalize feedback (discriminated union)
- Parallel engine (Mirror için)
- Hata stratejisi (return vs throw)
- **Durable/Transient state ayrımı** (persist storm önleyici)
- **RNG state serialization** (resume safe)
- **Chunked filtering** (UI thread)
- **checkEndConditions** (tüm bitiş senaryoları)
