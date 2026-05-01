# CipherBreaker — Proje Spesifikasyonu

> Bu doküman Claude Code'a verilmek üzere hazırlanmıştır. Her bölüm implementasyon için yeterli detay içerir.

---

## 1. Ürün Özeti

**Ad**: CipherBreaker (çalışma adı)
**Tür**: 1v1 sayı tahmin oyunu (multiplayer görünümlü, gerçekte bot'a karşı)
**Platform**: React Native (iOS + Android)
**Hedef kitle**: 17+ casual oyun oyuncuları
**Monetizasyon**: Token satışı (IAP) + reklam izleyerek token kazanma

**Kritik UX kuralı**: Oyuncu bot'a karşı oynadığını bilmemelidir. Rakip her zaman gerçek bir kullanıcı gibi sunulur (isim, seviye, bayrak, "yazıyor..." göstergesi, değişken düşünme süreleri).

---

## 2. Tech Stack

- **Framework**: React Native + Expo (SDK 51+)
- **Dil**: TypeScript
- **Navigasyon**: `@react-navigation/native` + native stack
- **State**: Zustand (hafif, boilerplate'siz)
- **Stil**: NativeWind (Tailwind for RN) veya StyleSheet — Claude Code kararı
- **Animasyon**: `react-native-reanimated` v3 + `moti` (declarative animasyon)
- **Icon**: `lucide-react-native`
- **Kalıcı depolama**: `@react-native-async-storage/async-storage`
- **Fontlar**: `expo-font` ile Chakra Petch (başlık) + Inter (gövde)
- **Haptic**: `expo-haptics` (kazanma/kaybetme geribildirimi)
- **Ses**: `expo-av` (buton sesleri, kazanma fanfarı — opsiyonel MVP)
- **IAP**: MVP'de YOK — sahte "Satın Al" modalı göster

---

## 3. Oyun Mekanikleri

> **Konvansiyon (tüm modlar)**: Gizli sayının ilk hanesi `1–9` aralığındadır. `0XXX` deseni geçersizdir — code-breaker görselinde leading-zero belirsizliği oluşturur. Bu kısıt aday havuzunu da etkiler: tekrar-izinli mod havuzu **9 000** (1000–9999), tekil-rakam havuzu **4 536** (`10·9·8·7 − 9·8·7`). Oyuncu girişinde `0XXX` tahmini izinli kalır (yalnızca kötü bir tahmindir, semantik olarak geçersiz değil).

### 3.1 Temel Akış

1. **Açılış**: Oyuncu uygulamayı ilk kez açarsa 500 token verilir. Ana ekrana düşer.
2. **Ana ekran**: Token bakiyesi üstte, 3 mod kartı ortada, profil (XP/istatistik) altta.
3. **Mod seçimi**: Oyuncu bir mod kartına dokunur → 50 token ödeme onayı → ödeme alınır → "rakip aranıyor" ekranı (2–4 saniye).
4. **Rakip bulundu**: Bot için rastgele profil üretilir (isim, seviye, bayrak). Oyuncuya "rakip bulundu" ekranı gösterilir (1 sn).
5. **Gizli sayı girme**: Oyuncu kendi 4 haneli sayısını seçer. Bot kendi gizli sayısını otomatik seçer (arka planda).
6. **Maç ekranı**: Sıralı tahmin akışı. Oyuncunun pozisyonu (sol/sağ) rastgele belirlenir. İlk tahmin hakkı rastgele atanır (50/50).
7. **Maç sonu**: Kazanma (+100 token), berabere (+50 token), kayıp (0 token). Sonuç ekranı + istatistik güncellenir.
8. **İflas**: Oyuncu bakiyesi 50'nin altına düşerse ve oyun başlatmaya çalışırsa → "Token'ın yetersiz" modal → [Reklam İzle (+50)] veya [Satın Al] seçenekleri.

### 3.2 Mod 1 — RENK (Wordle mantığı)

**Kurallar**: Gizli sayı 4 haneli, rakamlar tekrar edebilir (ör. `1122` geçerli).
**Geri bildirim**: Her hane için bir renk:
- 🟢 **Yeşil**: Rakam doğru, yeri doğru.
- 🟡 **Sarı**: Rakam gizlide var, ama bu pozisyonda değil.
- ⚫ **Gri**: Rakam gizlide yok.

**Wordle algoritması** (TEKRARLAR İÇİN KRİTİK):
```
function evaluateMode1(guess, secret):
  result = [gri, gri, gri, gri]
  secretArr = secret.split('')
  guessArr = guess.split('')
  used = [false, false, false, false]  // secret'ın hangi pozisyonları "tüketildi"

  // 1. AŞAMA: Yeşilleri işaretle (tam eşleşme)
  for i in 0..3:
    if guessArr[i] == secretArr[i]:
      result[i] = yeşil
      used[i] = true

  // 2. AŞAMA: Sarıları işaretle (tüketilmemiş pozisyonlar arasında)
  for i in 0..3:
    if result[i] == yeşil: continue
    for j in 0..3:
      if not used[j] and guessArr[i] == secretArr[j]:
        result[i] = sarı
        used[j] = true
        break
```

**Örnek**: gizli=`1122`, tahmin=`1919` → pozisyon 0 yeşil (`1`=`1`), pozisyon 1 gri (`9` yok), pozisyon 2 sarı (`1` gizlide var ama tüketilmiş değil çünkü 1. `1` 1. pozisyonda), pozisyon 3 gri. Sonuç: 🟢⚫🟡⚫

### 3.3 Mod 2 — YÖN (Binary Search)

**Kurallar**: Gizli sayı 4 haneli, rakamlar tekrar edebilir (ör. `1122` geçerli).
**Geri bildirim**: Tahminin TAMAMI, gizli sayı ile karşılaştırılır (integer olarak):
- ▲ **HIGHER**: Gizli sayı, tahminden daha büyük.
- ▼ **LOWER**: Gizli sayı, tahminden daha küçük.
- Eşit olduğunda: oyuncu kazanır (özel bir "equal" göstergesi yok; direkt win).

**Örnek**: gizli=`3817`
- tahmin=`7234` (>3817) → ▼ LOWER
- tahmin=`3142` (<3817) → ▲ HIGHER
- tahmin=`3817` → KAZANDI

```
function evaluateMode2(guess, secret):
  g = int(guess)
  s = int(secret)
  if g == s: return 'win'
  if g < s: return 'higher'  // gizli daha büyük, yukarı çık
  return 'lower'              // gizli daha küçük, aşağı in
```

**Oynanış karakteristiği**: Bu bir binary search oyunudur. Optimal oyuncu log₂(10000) ≈ 14 turda bulur. Ortalama maçlar 6–12 tur sürer (oyuncular her zaman optimal binary search yapmaz). Mod 1 ve Mod 3'e göre daha uzundur, ama mekanik daha analitik/matematiksel.

### 3.4 Mod 3 — SKOR (+/−)

**Kurallar**: Gizli sayı 4 haneli, **her rakam farklı olmalı** (unique). Oyuncunun girişi de unique olmalı — değilse validation hatası.
**Geri bildirim**: İki sayı:
- **+N**: Aynı pozisyonda olan doğru rakam sayısı.
- **−M**: Gizlide var ama farklı pozisyonda olan rakam sayısı.

**Örnek (kullanıcının verdiği)**: gizli=`1234`, tahmin=`1249` → pozisyon 0: `1`=`1` (+1), pozisyon 1: `2`=`2` (+1), pozisyon 2: `4` gizlide var ama pozisyon 3'te (−1), pozisyon 3: `9` yok. Sonuç: **+2 −1**.

```
function evaluateMode3(guess, secret):
  plus = 0, minus = 0
  secretArr = secret.split('')
  guessArr = guess.split('')
  used = [false, false, false, false]

  // Önce doğru pozisyonları işaretle
  for i in 0..3:
    if guessArr[i] == secretArr[i]:
      plus++
      used[i] = true

  // Sonra yanlış pozisyondakileri say
  for i in 0..3:
    if guessArr[i] == secretArr[i]: continue  // zaten sayıldı
    for j in 0..3:
      if i != j and not used[j] and guessArr[i] == secretArr[j]:
        minus++
        used[j] = true
        break
  return { plus, minus }
```

### 3.6 Mod 4 — BLITZ (Chess Clock)

**Kurallar**: Mod 1 geri bildirim mantığı (🟢🟡⚫ Wordle), rakamlar tekrar edebilir. **Ek olarak**: her oyuncunun toplam 60 saniyelik satranç saati vardır.
- Sıra sende → kendi saatin azalır.
- Tahmin ettiğin anda saatin durur, rakibin saati başlar.
- Süresi ilk biten oyuncu **OTOMATİK KAYBEDER**, gizli sayıyı çözmüş olsa bile.
- Beraberlik mümkün: ikisi de aynı turda bulursa berabere.
- Her iki saat 0'a yakın indiğinde (< 10 sn) görsel uyarı (kırmızı pulse + haptic).

**Token ekonomisi**:
- Giriş: 50 token
- Kazanma: **150 token** (net +100)
- Berabere: 50 token (net 0)
- Kayıp (süre veya tahmin): 0 token

**Bot zaman yönetimi** (inandırıcılık kritik):
- Kolay bot: zamanı kötü yönetir, panik yapar (son 15 sn'de aceleci tahminler).
- Normal bot: dengeli yönetir, süre baskısıyla hafif sub-optimal olur.
- Zor bot: verimli, tahminleri hızlı ama çok hızlı değil (2-5 sn, bot şüphesi uyandırmaz).

**Algoritma**: `evaluateMode1` ile aynı. Fark sadece clock state machine'de.

### 3.7 Mod 5 — BLACKOUT (Yalnız Yeşil)

**Kurallar**: Mod 1 mantığı ama **sadece YEŞİL bildirilir**. Sarı ve gri bilgisi verilmez. Rakamlar **unique** olmalı (tekrar yok).
- Tahmin sonrası sadece "kaç rakam doğru pozisyonda" bilgisi verilir.
- Hangi rakamların doğru olduğu **gösterilmez** — sadece sayısı.

**Örnek**: gizli=`3847`, tahmin=`3249` → sadece `3` doğru pozisyonda → sonuç: **"1 LOCKED"**.
(Oyuncu hangi rakamın doğru yerde olduğunu tahmin etmek zorunda.)

```
function evaluateMode5(guess, secret):
  locked = 0
  for i in 0..3:
    if guess[i] == secret[i]: locked++
  return locked  // sadece sayı, hangi pozisyon belirtilmez
```

**Token ekonomisi** (prestij modu, yüksek bahis):
- Giriş: 100 token
- Kazanma: **250 token** (net +150)
- Berabere: 100 token (net 0)
- Kayıp: 0 token

**Notlar**: Bu mod çok zorludur. Ortalama 8-15 turda bulunur. Hedef kitlesi "zeki oyuncu" — kazanmak prestij hissi verir. Bot stratejisi: tüm geçmişle tutarlı aday havuzunu daraltan tahminler yapar (constraint satisfaction).

### 3.8 Mod 6 — SUDDEN DEATH (5 Tahmin)

**Kurallar**: Mod 1 geri bildirim mantığı (🟢🟡⚫ Wordle), rakamlar tekrar edebilir. **Ek olarak**: her oyuncunun sadece **5 tahmin hakkı** vardır (toplam 10 tahmin/maç).
- 5 tahminde bulamayan kaybeder.
- Her ikisi de 5'te bulamazsa → **STALEMATE** (token iadesi).
- Normal kazanma/kayıp: gizli sayıyı bulan kazanır.

**Token ekonomisi**:
- Giriş: 50 token
- Kazanma: 120 token (net +70 — yüksek varyans için extra)
- Berabere (ikisi de aynı turda bulur): 50 token
- **Stalemate** (ikisi de bulamaz): **50 token iadesi** (net 0)
- Kayıp: 0 token

**Bot davranışı**: 5 tahmin limitinde ortalama oyuncunun kazanma oranı ~%30-40'tır. Bot bu dağılıma yakın olsun — çok agresif olmasın (her zaman bulursa oyuncu siniyor).

**Algoritma**: `evaluateMode1` ile aynı, sadece tur sayacı + "game over at 5" kontrolü eklenir.

### 3.9 Mod 7 — MIRROR (Paralel Çözüm)

**Kurallar**: Bu mod diğerlerinden **akış olarak farklıdır**:
- **Sistem tek bir gizli sayı üretir** (rakamlar tekrar edebilir, Mod 1 kuralı).
- İki oyuncu da aynı gizli sayıyı çözmeye çalışır.
- Oyuncular gizli sayı belirlemez (SecretSetup fazı yoktur).
- Tahminler **karşılıklı görünmez** — sadece kendi geçmişini görürsün.
- Rakibin **tur sayısı görünür** ("Opponent: 6 guesses in") — gerilim.
- Önce bulan kazanır. Aynı turda ikisi de bulursa berabere.
- Geri bildirim: Mod 1 (🟢🟡⚫).

**Token ekonomisi**:
- Giriş: 75 token (biraz yüksek — saf beceri yarışı)
- Kazanma: 180 token (net +105)
- Berabere: 75 token (net 0)
- Kayıp: 0 token

**UI farkı**:
- SecretSetup ekranı atlanır, direkt Match'e geçilir.
- Match ekranında sadece oyuncunun kendi tahmin geçmişi görünür (tek kolon, merkez).
- Üst bar'da rakibin tur sayısı + "typing" göstergesi.
- Sayfada "YOU AND YOUR OPPONENT ARE BOTH SOLVING THE SAME CODE" üstünde bilgi çubuğu.

**Bot davranışı**: Bot da aynı gizli sayıyı çözer, ama oyuncu ile **aynı hızda** olmamalı. Zor bot için hedef: oyuncudan 1-3 tur önce veya sonra bitirsin (yakın yarış hissi). Bunun için bot'un kaçıncı turda bulacağı önceden simule edilir, oyuncuyla kıyaslanır, ve tur sayısı buna göre "rötarlanır" ya da "hızlandırılır". **Dikkat**: bu dinamik ayar inandırıcılığı zedelemesin — bot bazen gerçekten de oyuncudan hızlı kazanmalı.

### 3.10 Turn-Based Akış

- İki tarafın da tahmin yaptığı "tur"lar vardır. Bir tur: X tahmin eder → Y tahmin eder → tur biter.
- İlk tahmin hakkı maç başında rastgele atanır.
- Bir taraf gizli sayıyı bulursa **turn tamamlanır** (karşı tarafın da aynı turda tahmin hakkı olur). İkisi de aynı turda bulursa **berabere**.
- Tur sınırı yok (sınırsız tahmin).

---

## 4. Bot AI

### 4.1 Zorluk Dağılımı (her maç başında rastgele atanır)

- **%5 Kolay**: Acemi oyuncu taklidi.
- **%70 Normal**: Ortalama oyuncu.
- **%25 Zor**: Deneyimli oyuncu.

Zorluk oyuncuya **asla gösterilmez** (maç sonunda bile).

### 4.2 Tutarlı Aday Havuzu (tüm seviyelerde ortak mantık)

Her modun tüm olası 4-haneli kombinasyon havuzu:
- Mod 1 ve 2: 10.000 kombinasyon (0000–9999).
- Mod 3: 5.040 permütasyon (unique rakamlı).

Her tahminden sonra bot, havuzu "aldığı geri bildirimle tutarlı" olan adaylara filtreler. Bot kendi tahminini hangi sayı için yaparsa, o sayıya karşı havuzdaki kalan adaylardan birini seçer.

```
function filterCandidates(pool, previousGuesses, mode):
  return pool.filter(candidate =>
    previousGuesses.every(({guess, feedback}) =>
      evaluate(guess, candidate, mode) == feedback
    )
  )
```

### 4.3 Seviyeye Göre Seçim Stratejisi

**KOLAY** (%5):
- %40 ihtimalle tutarlı aday havuzundan seç.
- %60 ihtimalle TÜM havuzdan rastgele seç (yani bazen elenmiş adayları bile tekrar dener — "ipuçlarını unutan" oyuncu taklidi).
- Açılış tahmini: tamamen rastgele.

**NORMAL** (%70):
- %85 ihtimalle tutarlı aday havuzundan rastgele seç.
- %15 ihtimalle tutarlı havuzun dışından rastgele seç (nadir mantık hatası).
- Açılış tahmini:
  - Mod 1: rastgele ama tekrar eden rakamları azalt (`1234` değil, `7392` gibi).
  - Mod 2: `5000` civarı (binary search'in optimal açılışı ~5000, ama insan gibi görünmesi için ±500 sapma ver; ör. 4783, 5412).
  - Mod 3: rastgele permütasyon.

**ZOR** (%25):
- Her zaman tutarlı aday havuzundan seç.
- Mod 2 için: **binary search optimal stratejisi**. Tutarlı havuzun ORTA noktasına en yakın sayıyı seç (havuz min+max / 2). Bu şekilde her turda havuzu yarıya böler.
- Açılış tahmini:
  - Mod 1: bilgi maksimize eden tekrarsız 4 rakam.
  - Mod 2: 5000 (kesin binary search orta noktası).
  - Mod 3: rastgele permütasyon (ilk tahminde bilgi eşit).
- Ortalama 4–6 turda bulmalı (Mod 2 için 6–10 tur).

### 4.4 Düşünme Süresi (inandırıcılık için KRİTİK)

Sabit delay → bot şüphesi. Değişken olmalı:

```
function botThinkingTime(difficulty, turnNumber):
  base = random(2000, 6000)  // ms
  if difficulty == 'hard': base += random(0, 3000)  // bazen uzun düşünür
  if difficulty == 'easy': base += random(2000, 5000)  // acemi yavaş
  if turnNumber > 6: base += random(1000, 4000)  // ilerledikçe düşünme uzar
  // nadiren çok uzun düşünme (telefonu bıraktı hissi):
  if random() < 0.08: base += random(5000, 12000)
  return base
```

### 4.5 "Yazıyor..." Göstergesi

Düşünme süresinin **son %60'lık** kısmında "{rakip_adı} yazıyor..." yazısı + üç nokta animasyonu göster. İlk %40 "düşünüyor" hissi için boş bekleme.

---

## 5. Token Ekonomisi

### 5.1 Global Olaylar

| Olay | Token Değişimi |
|------|----------------|
| İlk açılış | +500 |
| Reklam izleme | +50 (günde 10 kere sınırı) |
| Satın alma | paket boyutunca |

### 5.2 Mod-Başı Token Tablosu

Her modun kendi ekonomisi var. Giriş ücreti modu başlatırken alınır, ödüller maç sonunda eklenir.

| Mod | Giriş | Kazanma | Berabere | Kayıp | Özel |
|-----|-------|---------|----------|-------|------|
| 1 — COLOR MATCH | 50 | 100 | 50 | 0 | — |
| 2 — HIGH & LOW | 50 | 100 | 50 | 0 | — |
| 3 — PRECISION | 50 | 100 | 50 | 0 | — |
| 4 — BLITZ | 50 | **150** | 50 | 0 | Süre baskısı |
| 5 — BLACKOUT | **100** | **250** | 100 | 0 | Prestij modu |
| 6 — SUDDEN DEATH | 50 | 120 | 50 | 0 | **Stalemate: 50 iadesi** |
| 7 — MIRROR | 75 | 180 | 75 | 0 | Paralel çözüm |

### 5.3 Satın Alma Paketleri
- 500 token — $0.99
- 1.500 token — $2.99 **(en popüler)**
- 5.000 token — $7.99 **(+40% bonus)**
- 15.000 token — $19.99 **(+60% bonus)**

### 5.4 İflas Durumu

**İflas (bakiye < en düşük giriş ücreti = 50)**:
Maç başlatmaya çalışırken modal: "Yetersiz token. Token almak için:"
- [Reklam İzle (+50)] → sahte reklam ekranı 5 sn → +50
- [Token Satın Al] → paket seçim ekranı (sahte satın alma)

**Not**: Blackout modu için gereken 100 token yoksa ama 50+ varsa, o mod kartı "Need more tokens" olarak disable görünür (iflas değil, mod-özel kısıt).

**Reklam sınırı**: Günde 10 reklam. AsyncStorage'da tarih+sayaç tut. Sınır aşılırsa "Bugünlük reklam limiti doldu" mesajı.

### 5.5 Dinamik Kazanma Oranı (gizli)

Oyuncu long-term **yavaşça kaybetmeli** — ama bunu hissetmemeli. Backend olmadığı için basit bir lokal DDA (dynamic difficulty adjustment):

```
function selectDifficulty(stats):
  winRate = stats.wins / (stats.games || 1)
  if stats.games < 5: return weightedRandom({easy: 0.10, normal: 0.80, hard: 0.10})  // ilk günler tatlı
  if winRate > 0.60: return weightedRandom({easy: 0.02, normal: 0.58, hard: 0.40})  // çok kazanıyorsa zorlaştır
  if winRate < 0.30: return weightedRandom({easy: 0.15, normal: 0.75, hard: 0.10})  // çok kaybediyorsa yumuşat
  return weightedRandom({easy: 0.05, normal: 0.70, hard: 0.25})  // default
```

---

## 6. Rakip Profil Üretimi (İnandırıcılık)

Her maç başında sahte rakip profili üretilir:

**İsim formatları** (rastgele seçilen pattern):
- `{word}{number}` → "shadow42", "ninja1847", "eagle99"
- `{name}_{number}` → "mike_42", "sarah_kim"
- `{adjective}{noun}` → "swiftFox", "darkWolf"
- `{name}.{initial}` → "alex.k", "jordan.m"
- `xX_{word}_Xx` (nadiren, %5) → "xX_phoenix_Xx"

**Kelime havuzları** (uluslararası): shadow, ninja, eagle, phoenix, wolf, fox, dragon, viper, ghost, storm, blade, arrow, hunter, ranger, knight, rogue, mage, sniper, ace, pro, king, lord, master, legend, champion, hero, cipher, codex, matrix, neon, pixel, byte, vector, zero, nova, zen.

**İsim havuzu**: mike, alex, jordan, sarah, emma, noah, liam, olivia, mason, sophia, lucas, chloe, ethan, ava, ryan, mia, chen, kim, patel, ali, omar, raj, yuki, akira, ivan, mehmet, zeynep, john, lee.

**Avatar**: Rastgele renk + isim ilk harfi (örn: mavi daire, beyaz "M" harfi).

**Seviye**: `Lv. {random 3–47}` (çok yüksek seviye de şüpheli olur).

**Bayrak**: Rastgele ülke bayrağı (US, TR, DE, JP, BR, FR, GB, IN, MX, RU, KR, NL, ES, IT, CA, AU, PL, AR, SE, EG — emoji olarak 🇺🇸 🇹🇷 vs).

**"Son görülme"**: "çevrimiçi" (%70), "5 dk önce aktif" (%15), "yeni katıldı" (%10), "saat önce aktif" (%5).

**Eşleşme süresi**: 2.0–4.2 sn arası rastgele. Ekranda "Rakip aranıyor..." sonra "Rakip bulundu: {name}".

---

## 7. Kullanıcı Profili ve İlerleme

### 7.1 Lokal Veri Modeli (AsyncStorage)

```typescript
type UserData = {
  tokens: number
  xp: number
  level: number  // xp'den türetilir
  stats: {
    gamesPlayed: number
    wins: number
    draws: number
    losses: number
    currentStreak: number
    bestStreak: number
    avgTurnsToWin: number  // sadece kazanılan maçlardan
    modeStats: {
      [mode: 1|2|3|4|5|6|7]: { played: number, wins: number }
    }
  }
  adWatchCount: number
  adWatchDate: string  // YYYY-MM-DD
  username: string  // kullanıcının kendi adı (opsiyonel, ayarlardan)
  createdAt: number
}
```

### 7.2 XP Sistemi

- Kazanma: +30 XP
- Berabere: +15 XP
- Kaybetme: +5 XP (katılım ödülü)
- Seviye formülü: `level = floor(sqrt(xp / 50)) + 1` → Lv 1: 0–199 XP, Lv 2: 200–449, Lv 3: 450–799...

### 7.3 Kullanıcının Kendi Rakip Kimliği

Uygulama ilk açıldığında kullanıcıya da rastgele bir kullanıcı adı atanır (aynı algoritma). Bu adı ayarlardan değiştirebilir. Bot'lara karşı "senin adın" bu.

---

## 8. Ekranlar ve Navigasyon

```
RootNavigator (Stack)
├── Onboarding (ilk açılış, skip edilebilir)
├── Home (ana ekran — token, modlar, profil)
├── Matchmaking (eşleşme simülasyonu, 2-4 sn)
├── SecretSetup (gizli sayı girme)
├── Match (oyun ekranı)
├── MatchResult (kazanma/beraberlik/kayıp)
├── Shop (token paketleri — sahte IAP)
├── AdWatch (sahte reklam ekranı — 5 sn geri sayım)
├── Profile (istatistik, ayarlar, kullanıcı adı)
└── ModeInfo (her mod için nasıl oynanır açıklama)
```

### 8.1 Home Screen

- Üst bar: Token bakiyesi (altın ikon + sayı) + "+" butonu (Shop'a gider) + profil avatarı (Profile'a gider).
- Başlık: "CipherBreaker" — Chakra Petch, büyük, neon glow.
- Orta: **7 mod kartı**, dikey scroll'lanabilir liste. İki gruba ayrılmış:
  - **Group 1: Classic Modes** (Mod 1, 2, 3) — temel deneyim
  - **Group 2: Advanced Modes** (Mod 4, 5, 6, 7) — prestij/twist
- Her kart:
  - Sol: mod ikonu (gradient dolgulu, glow).
  - Orta: mod adı + kısa açıklama.
  - Sağ: giriş ücreti "X 🪙" + "Play" butonu (chevron ikonlu).
  - Kart gradient'leri (her mod benzersiz):
    - Mod 1 (Color Match): cyan → violet
    - Mod 2 (High & Low): violet → pink
    - Mod 3 (Precision): gold → orange
    - Mod 4 (Blitz): red → orange (saat/aciliyet hissi)
    - Mod 5 (Blackout): deep purple → black (prestij, gizem)
    - Mod 6 (Sudden Death): dark red → crimson (tehlike)
    - Mod 7 (Mirror): teal → silver (ayna/paralel)
  - Blackout kartında "PRESTIGE" badge, Sudden Death kartında "HIGH RISK" badge, Blitz kartında "⏱ TIMED" badge, Mirror kartında "SOLO RACE" badge — her biri Tiny uppercase, ilgili accent rengi.
- Alt: Seviye çubuğu (Lv. X, XP/XP_next ile progress bar).

**Yetersiz token durumu**: Oyuncunun bakiyesi mod giriş ücretinden azsa, o kartın "Play" butonu "Need X tokens" olarak disable; tap edilirse Shop'a yönlendirir.

### 8.2 Matchmaking Screen

- Tam ekran koyu arka plan, merkez: dönen radar animasyonu (SVG, reanimated).
- Yazı: "Rakip aranıyor..." → 2-4 sn sonra → "Rakip bulundu!" → rakip kartı açılır (fade+scale).
- Rakip kartı: avatar, isim, "Lv. X", bayrak, durum.
- "Başla" butonu otomatik 1 sn sonra Match'e götürür.
- **Mirror modunda**: "Rakip aranıyor..." yerine "Finding a rival to race..." + ekstra bilgi "You'll both crack the same code."

### 8.3 SecretSetup Screen

- Üst: mod adı + "Gizli sayını belirle" başlığı.
- Alt-orta: 4 büyük kutu (haneler için). Sayısal keyboard.
- Mod 3 ve Mod 5'te: "Her rakam farklı olmalı" yazısı + canlı validation.
- Hata: shake animasyonu + kırmızı glow.
- "Onayla" butonu (disabled → active geçişi).
- **Mirror modunda (Mod 7) bu ekran atlanır** — direkt Match'e geçilir çünkü sistem gizli sayıyı üretir.

### 8.4 Match Screen (en karmaşık ekran)

**Layout**: Dikey, 3 bölüm:
1. **Üst**: Sol ve sağ oyuncu kartları yan yana. Oyuncunun pozisyonu (sol/sağ) maç başında rastgele belirlenir. Her kartta: avatar + isim + Lv + mini istatistik. Aktif olan parlayan border'la belirtilir.
   - **Mod 4 (Blitz) özel**: her oyuncu kartında satranç saati gösterimi. Aktif olanın saati tick-tick sayar (monospace font). Son 10 sn'de kırmızı pulse.
   - **Mod 6 (Sudden Death) özel**: her oyuncu kartında "guesses left" sayacı (ör. "3 LEFT"). 1'e düşünce kırmızı pulse.
   - **Mod 7 (Mirror) özel**: iki kart yerine tek kolon. Üstte sadece rakip bilgisi + "Opponent: 6 guesses in" göstergesi.
2. **Orta (scrollable)**: Tahmin geçmişi.
   - **Standart modlar (1, 2, 3, 4, 6)**: iki taraflı timeline — kim tahmin etti, geri bildirim ne. Yeni tahminler slide-in.
   - **Blackout (Mod 5)**: iki taraflı ama geri bildirim farklı — sadece "{n} LOCKED" sayısı (hangi rakam locked bilinmez).
   - **Mirror (Mod 7)**: tek kolon, sadece oyuncunun kendi tahminleri. Rakibin tahminleri **görünmez**.
3. **Alt**: Kendi sıran geldiğinde input alanı + keyboard + "Guess" butonu.
   - **Mirror (Mod 7)**: turn-based yok, istediğin zaman tahmin edebilirsin. Rakip arka planda tahmin yapar, "Opponent is guessing..." indikatörü periodik gözükür.

**Animasyonlar**:
- Yeni tahmin: fade+slide-in.
- Mod 1/4/6 yeşil: pulse glow.
- Mod 2 ok (HIGHER/LOWER): slight bounce.
- Mod 3 skor: sayı sayma animasyonu.
- Mod 5 "LOCKED" sayısı: büyüyerek in.
- Haptic: her tahmin sonrası hafif (`Haptics.impactAsync(ImpactFeedbackStyle.Light)`).
- Mod 4 son 10 sn: her saniyede heavy haptic.
- Mod 6 son tahmin (1 LEFT): medium haptic + kırmızı glow.

### 8.5 MatchResult Screen

**Kazanma**: Altın/yeşil tema, büyük "VICTORY" yazısı, confetti animasyonu (reanimated ile parçacık sistemi), +100 token sayacı (0'dan 100'e artan sayı animasyonu), "Tekrar Oyna" ve "Ana Menü" butonları.

**Berabere**: Mor/nötr tema, "DRAW", +50 token.

**Kayıp**: Koyu kırmızı tema, "DEFEAT", "0 token". Kaybettiğinde kullanıcıya motivasyon: "Rakibin sayısı: 5847" + "Yakındın!" vs.

Tüm sonuç ekranlarında: mini stat ("{X} turda bulundu", "{Y} tahmin yaptın") + rakibin istatistiği.

### 8.6 Shop Screen

Koyu arka plan, 4 paket kartı (500/1500/5000/15000), her biri farklı parlaklık. "EN POPÜLER" badge'i 1500 paketinde. "Satın Al" butonu → MVP'de sahte modal: "Bu özellik yakında gelecek" (veya dev mode: "Test: {X} token eklendi"). Seçim: **dev mode'da test token ekleme işlevsel olsun, production'da disabled.**

### 8.7 AdWatch Screen

Sahte reklam: 5 saniyelik geri sayım, "Atla" butonu (son 2 saniyede aktifleşir), ortada "Reklam Oynatılıyor" placeholder. Tamamlanınca +50 token verir, geri döner.

---

## 9. Görsel Yön (Neo-noir Casino Arcade)

### 9.1 Renkler (CSS token formatında)

```
--bg-base: #0a0b1e        // koyu lacivert
--bg-elevated: #15172e    // kart arkaplanı
--bg-overlay: #1f2142     // modal

--accent-primary: #8b5cf6   // mor (aksiyon)
--accent-secondary: #06b6d4 // cyan (vurgu)
--accent-tertiary: #ec4899  // pembe (özel)

--token-gold: #fbbf24       // altın (token)
--token-gold-dark: #d97706  // altın gölge

--success: #10b981          // yeşil (kazanma)
--warning: #f59e0b          // sarı (uyarı)
--danger: #ef4444           // kırmızı (kayıp)

--text-primary: #f5f5f7     // beyaz
--text-secondary: #a1a1b5   // gri
--text-dim: #5a5a7a         // koyu gri

--border: #2a2c54           // ince çizgi
--border-bright: #8b5cf6    // vurgu çizgi
```

### 9.2 Tipografi

- **Başlık**: Chakra Petch (700, 900) — oyun/tech hissi, karakterli. Alternatif: Rajdhani.
- **Gövde**: Inter (400, 600) — okunabilirlik.
- **Monospace (sayılar)**: JetBrains Mono (700) — 4 haneli sayıların hizalı görünümü için.

Fontlar `expo-font` ile yüklenir; splash'de yükleme bekletilir.

### 9.3 Atmosfer

- **Glow efektleri**: Aktif butonlarda, kazanma ekranında, token ikonunda box-shadow glow'lar.
- **Gradient arkaplanlar**: Ana ekranda hafif radial gradient (merkez biraz daha mor), mod kartlarında lineer gradient.
- **Noise texture**: Tüm uygulama üzerinde %5 opacity noise overlay (SVG filter veya küçük PNG) — premium his.
- **Glass morphism**: Modal'larda backdrop blur + hafif saydamlık.
- **Animasyonlar**: Ekran geçişleri slide, butonlar press'de scale 0.95, token artışları spring bounce.

### 9.4 Referanslar (Claude Code'a ilham)

- Pokerstars mobile app (premium, koyu, altın)
- Among Us (karakterli, mobile-native)
- Monument Valley 2 (renk paleti uyumu)
- Balatro (casino + dijital crossover)

---

## 10. Dosya Yapısı

```
cipherbreaker/
├── App.tsx
├── app.json
├── package.json
├── tsconfig.json
├── babel.config.js
├── assets/
│   ├── fonts/
│   │   ├── ChakraPetch-Bold.ttf
│   │   ├── ChakraPetch-Black.ttf
│   │   ├── Inter-Regular.ttf
│   │   ├── Inter-SemiBold.ttf
│   │   └── JetBrainsMono-Bold.ttf
│   ├── icons/ (SVG veya PNG)
│   └── sounds/ (opsiyonel)
└── src/
    ├── navigation/
    │   └── RootNavigator.tsx
    ├── screens/
    │   ├── OnboardingScreen.tsx
    │   ├── HomeScreen.tsx
    │   ├── MatchmakingScreen.tsx
    │   ├── SecretSetupScreen.tsx
    │   ├── MatchScreen.tsx
    │   ├── MatchResultScreen.tsx
    │   ├── ShopScreen.tsx
    │   ├── AdWatchScreen.tsx
    │   └── ProfileScreen.tsx
    ├── components/
    │   ├── TokenBadge.tsx
    │   ├── ModeCard.tsx
    │   ├── OpponentCard.tsx
    │   ├── GuessRow.tsx           // modlara göre render
    │   ├── GuessInput.tsx         // 4 haneli input
    │   ├── TypingIndicator.tsx    // "yazıyor..." animasyon
    │   ├── RadarAnimation.tsx
    │   ├── ConfettiAnimation.tsx
    │   ├── LevelBar.tsx
    │   └── AnimatedNumber.tsx     // token artışı animasyonu
    ├── game/
    │   ├── evaluators.ts          // evaluateMode1, 2, 3
    │   ├── botAI.ts               // candidate filtering, strategy
    │   ├── matchEngine.ts         // maç state machine
    │   └── constants.ts
    ├── state/
    │   ├── userStore.ts           // Zustand: token, XP, stats
    │   └── matchStore.ts          // Zustand: aktif maç state
    ├── data/
    │   ├── opponentNames.ts       // kelime havuzları
    │   ├── countries.ts           // bayrak+kod listesi
    │   └── tokenPackages.ts
    ├── lib/
    │   ├── storage.ts             // AsyncStorage wrapper
    │   ├── random.ts              // weightedRandom, vb.
    │   └── haptics.ts
    └── theme/
        ├── colors.ts
        ├── typography.ts
        └── spacing.ts
```

---

## 11. Önemli Davranışsal Kurallar (Bot İnandırıcılığı — ÖZET)

1. **"Bot" kelimesi UI'da asla görünmez.**
2. Rakip profili her maçta yeniden üretilir.
3. Düşünme süresi her turda farklı olmalı (2–12 sn).
4. "Yazıyor..." göstergesi düşünme süresinin son %60'ında.
5. Bot bazen sub-optimal tahmin yapmalı (Normal %15, Kolay %60).
6. Bot ortalama 4–14 tur arasında değişen sayıda kazansın (zorluğa göre).
7. Bot her zaman insan gibi 4-5 sn içinde tahmin etmesin — bazen 10+ sn beklemesi gerçekçi (%8 ihtimal).
8. Bot maç kaybettiğinde, maç sonu ekranında "iyi oynadın!" gibi sahte bir chat mesajı gösterilebilir (opsiyonel).

---

## 12. Yasal / Etik Notlar (Claude Code'un bilmesi lazım)

- Uygulama App Store/Play Store'a çıkarılmak isteniyor. 17+ yaş kısıtlaması gerekli olacak (sanal para + şans öğesi).
- Bot'un insan gibi sunulması etik gri alandır. MVP için kabul ediyoruz ama **production'a çıkmadan önce**:
  - Kullanım Şartları (ToS) ve Gizlilik Politikası zorunlu.
  - "Bu oyundaki rakipler yapay zekâ kontrollüdür" bildirimini ToS'da net belirt.
- Token'lar gerçek paraya çevrilemez — bu kritik; "kumar" sınıfına girmemek için.
- IAP entegre edildiğinde RevenueCat kullan (Apple/Google için tek API).

---

## 13. MVP Scope (v0.1.0)

**DAHİL**:
- Tüm 7 mod (3 Classic + 4 Advanced)
- Bot AI (3 zorluk, mod-özel stratejiler)
- Satranç saati (Mod 4), tahmin sayacı (Mod 6), paralel çözüm (Mod 7), sınırlı geri bildirim (Mod 5)
- Token ekonomisi (mod-başı değişken, lokal)
- Reklam sistemi (sahte reklam ekranı)
- Shop (sahte IAP)
- Profil + XP + mod-başı istatistik
- Rakip üretimi
- Tüm 9 ekran (home, matchmaking, secret setup, match, result, shop, ad watch, profile, onboarding)

**DAHİL DEĞİL (v0.2+)**:
- Gerçek IAP (RevenueCat)
- Gerçek reklam (AdMob)
- Başarımlar
- Günlük ödüller / giriş serisi
- Leaderboard (mod-başı global sıralama)
- Push bildirimleri
- Tema özelleştirmesi
- Ses efektleri
- Çok dilli destek (MVP: sadece İngilizce)
- Ek modlar (Shifting, Double Up, High Roller, Streak)

---

## 14. Claude Code'a Başlangıç Komutu

```bash
npx create-expo-app@latest cipherbreaker --template expo-template-blank-typescript
cd cipherbreaker
npx expo install react-native-reanimated moti @react-navigation/native @react-navigation/native-stack @react-native-async-storage/async-storage expo-font expo-haptics expo-linear-gradient react-native-screens react-native-safe-area-context lucide-react-native zustand
```

Font dosyaları `assets/fonts/` altına Google Fonts'tan indirilir. Detaylar implementasyon sırasında.
