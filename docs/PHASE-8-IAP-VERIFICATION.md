# Phase 8.5.8 — IAP Sandbox Device Verification

**Status:** ✅ COMPLETE — all critical obligations device-verified (Obligation 4
deferred to 8.6 with the Remove Ads CTA).
**Base commit:** `f5bf7fc` (8.5.7 Restore Purchases UI)
**Library:** expo-iap v4.3.1 (StoreKit 2, client-side, no backend)
**Tester:** physical iOS device, real Apple **sandbox** account, Debug build
deployed via `expo run:ios` over Metro (iPhone hotspot LAN).
**Date executed:** 2026-06-10

This sub-phase is empirical, not code-writing. It confirms the four
load-bearing IAP assumptions (tracked in the `project_iap_858_device_checks`
memory) that Jest cannot exercise because expo-iap is native. The only code
delta was **temporary `[8.5.8-DIAG]` console logging**, reverted in this same
commit after the results below were captured.

---

## How it was run (operator: device owner)

1. **Sandbox tester signed in** on the device (Settings → App Store → *Sandbox
   Account*); main Apple ID untouched.
2. **Debug build over Metro.** Release builds do **not** route JS `console.log`
   to OSLog/Console.app (RN dev-gates it), so the `[8.5.8-DIAG]` lines were read
   from the **Metro terminal**. The device reached Metro over the Mac's LAN IP
   (physical device can't use `localhost`); built with
   `npx expo run:ios --device "<udid>"` with Metro already running.
3. Each test below executed on-device; `[8.5.8-DIAG]` output + observed UI
   pasted back and recorded.

> Diagnostics reverted in this commit (`git grep "8.5.8-DIAG"` → clean);
> `typecheck`/`lint`/`test` re-run green before committing.

---

## Prerequisite verification

### Repo-side (verified from source) ✅
- [x] Bundle ID `com.ozgurcetintas.cipherbreaker` (app.json) matches ASC.
      (Note: the gitignored `ios/` native folder had retained the pre-8.4
      bundle ID `com.cipherbreaker.app` and was regenerated with
      `npx expo prebuild --platform ios --clean` — see Bug log B1.)
- [x] 5 IAP products defined in `src/lib/iap/productCatalog.ts`:
      `tokens_500`, `tokens_1500`, `tokens_5000`, `tokens_15000`
      (consumables) + `remove_ads` (non-consumable). Wire SKUs derive from
      `SKU_PREFIX = com.ozgurcetintas.cipherbreaker.`.
- [x] iOS deployment target 15.1 (StoreKit 2 available).

### User-side (Apple setup) ✅ — all confirmed on device
- [x] App record exists: *CipherBreaker: Pure Deduction*.
- [x] 5 IAP products created in ASC with Pricing + Localization.
- [x] Paid Applications Agreement: **Active**.
- [x] Bank info + Tax forms: Active.
- [x] Sandbox tester account created (distinct email, US store, 18+).
- [x] Real iOS device, sandbox tester signed in.
- [x] Build deployed to device with matching bundle ID + dev-account signing.

---

## Pre-implementation findings (a–e)

**(a) Obligations documented in memory.** All four in
`project_iap_858_device_checks.md` with acceptance criteria; mapped to Tests
1–4 below.

**(b) Test surfaces.** ShopScreen 4 token packs (purchase) + Restore
Purchases button; app-launch re-delivery (kill mid-purchase → relaunch);
network failure (airplane mode); cancellation (decline sheet). Remove Ads
re-purchase / already-owned is **not yet surfaced** in ShopScreen (8.5.5
decision) → Tests 4 + E4 deferred to 8.6.

**(c) Diagnostic instrumentation (TEMPORARY, now reverted).** `[8.5.8-DIAG]`
logs at: `iapManager.initialize` (fetchProducts result),
`purchaseFlow.resultForError` / `resultForThrown` (raw error/reject codes),
`purchaseFlow.finalizePurchase` (txnId, raw + normalized environment, grant
outcome), `purchaseFlow.finalizeUnsolicited` (re-delivery marker), and
`ShopScreen.handleRestore` (discovered entitlements + grant). The kept `[iap]`
logs already cover rejection/finish-failure/orphan paths.

**(d) StoreKit Test Configuration (simulator).** Skipped as a substitute — a
local `.storekit` config reports `environmentIOS = 'Xcode'`, not `'Sandbox'`,
and uses synthetic transaction IDs; it would give the *wrong* answer for
Test 2.

**(e) Build.** No `eas.json` → local `expo run:ios --device` (Debug, for Metro
log streaming). EAS production / TestFlight build deferred to 8.10.

---

## TEST 1 — Verification-failure → `VERIFICATION_FAILED` contract

**Obligation 1.** A forged/failed transaction must surface as an error (no
silent grant).

**Status: ✅ VERIFIED (code inspection + device corroboration).**
Forging a transaction in real sandbox isn't feasible without invasive
scaffolding; the contract is established by code + library source:

- StoreKit 2 verifies the JWS **natively, before** expo-iap emits to JS.
  A verification failure surfaces as `purchase-verification-failed`, not a
  `purchased` event.
- `errors.ts` maps `ErrorCode.PurchaseVerificationFailed` →
  `VERIFICATION_FAILED`; `purchaseFlow.resultForError` routes it to an `error`
  result → **no grant**.
- Defense in depth: a malformed `purchased` event is rejected by
  `receiptValidator.validateTransaction` → `VERIFICATION_FAILED`. Unit-tested
  (`purchaseFlow.test.ts`: "malformed (no JWS)").

**Device corroboration:** across every purchase in Tests 2–3, a token grant
**always** had a matching `finalizePurchase grant: success` (or `duplicate`)
log — no silent grant ever appeared, consistent with this contract.

---

## TEST 2 — `environmentIOS` exact string

**Obligation 2.** Confirm StoreKit reports `environmentIOS === 'Sandbox'`
(capital S) so `grantIAPTokens` normalization labels the audit row correctly.

**Procedure:** Open ShopScreen, buy **Pocket Pack** (`tokens_500`); read
`[8.5.8-DIAG] finalizePurchase` → `rawEnvironment` / `normalizedEnvironment`.

**Result:** ✅ **VERIFIED (device)**
```
[8.5.8-DIAG] finalizePurchase
rawEnvironment        = "Sandbox"   (exact, uppercase S)
normalizedEnvironment = "Sandbox"
productId             = tokens_500
transactionId         = 2000001185378369
grant                 = success
Verdict: VERIFIED — no normalizer change needed.
```

---

## TEST 3 — Listener-before-init · finish-post-grant · launch re-delivery

**Obligation 3.** Transactions never stick in the queue; grants are idempotent
across interruptions.

### 3a — Normal flow + persistence across relaunch — ✅ PASS (device)
- 1st `tokens_500`: `grant: success`, txn `2000001185378369`.
- Force-quit + relaunch: **balance preserved**, `fetchProducts` re-fired,
  HomeScreen loaded clean. (userStore v9 persist + rehydration confirmed.)
- 2nd `tokens_1500`: txn `2000001185529385` — **distinct** txnId (consumable →
  fresh transaction each purchase), `grant: success`.
- Running balance **2100** (100 start + 500 + 1500). ✅

### 3b — Re-delivery after interrupted purchase — ✅ PASS (device-verified ★)
Reproduced on a retry: confirmed on the Apple sheet → transaction queued →
app killed before `finishTransaction` → relaunch. Metro log sequence:
```
[8.5.8-DIAG] finalizeUnsolicited (re-delivery) { id: 2000001185531428, state: "purchased" }
[8.5.8-DIAG] finalizePurchase { productId: tokens_500, txnId: 2000001185531428,
                                rawEnvironment: "Sandbox", grant: success }
```
Balance went **2100 → 2600 (+500, EXACTLY ONCE — no double-grant)**, and the
transaction was finished (no further re-delivery on the next launch).
**finishTransaction + idempotency verified end-to-end on device** — upgrades
Obligation 3 from code-confirmed to device-verified.

### 3c — Idempotency under duplicate delivery — ✅ PASS (device)
Distinct txnIds per consumable purchase; all clean grants; no false
duplicates; the re-delivered transaction granted exactly once. `iapHistory`
keeps one row per transactionId.

**Acceptance:** tokens credited exactly once per transactionId; no stuck
transactions; finish called on the success path **and** the re-delivery path.
✅ Met.

---

## TEST 4 — Restore `transactionId` stability — ⏳ DEFERRED to 8.6

**Obligation 4.** `getAvailablePurchases` re-presents the **same** transactionId
as the original purchase event, so restore idempotency holds.

**Deferred (not a failure):** restore is exercised through the **Remove Ads**
non-consumable, which has **no CTA in ShopScreen yet** (the 8.5.5 decision
keeps Remove Ads wiring for 8.6). With nothing to restore on this build, the
transactionId-stability check can't be exercised meaningfully. The Restore
Purchases button + grant loop are implemented and unit-tested (8.5.7); the
*device* idempotency check moves to 8.6 alongside the Remove Ads purchase.
Memory note #4 (restore txnId stability) carries forward to 8.6.

Blast radius if mismatched (already noted): cosmetic ("1 restored" vs "Nothing
to restore"), never a double-grant — non-consumables only, `transactionId`
dedup is the safety net.

---

## Edge cases

| # | Case | Result |
|---|------|--------|
| E1 | Cancel / interrupt during confirm | ✅ **PASS (device).** Airplane Mode during confirm → `code="user-cancelled"`; kept-log `[iap] purchase error with no purchase in flight`; graceful (no crash), balance unchanged, CTAs re-enabled. *(UI silent-vs-toast on cancel: cosmetic, user to confirm preference — non-blocking.)* |
| E2 | Ask-to-Buy | ⏭️ SKIPPED — requires Family Sharing setup; optional, non-blocking. Code path (`pending` → re-delivery on approval) is unit-tested. |
| E3 | Network failure before sheet | — not separately executed; the offline/interrupt behavior is covered by E1 (airplane) + 3b (re-delivery). Full network-error copy check folded into the 8.10 TestFlight pass. |
| E4 | Already-owned `remove_ads` | ⏳ DEFERRED to 8.6 (no Remove Ads CTA yet — see Test 4). |
| E5 | Background mid-sheet | — not separately executed; 3b (kill mid-transaction → re-delivery) exercises the harder superset. Folded into 8.10. |

---

## Bug log

- **B1 — Stale native bundle ID (FIXED before testing, not a code bug).**
  The gitignored `ios/` folder retained `com.cipherbreaker.app` from a
  pre-8.4 prebuild, causing `PRODUCT_NOT_FOUND` ("product unavailable") because
  StoreKit matched no products. `expo prebuild` had not been re-run after the
  Phase 8.4 app.json bundle-id edit (commit 86ac12a). Fixed with
  `npx expo prebuild --platform ios --clean` (regenerated to
  `com.ozgurcetintas.cipherbreaker`, verified). Phase 9 backlog item added:
  runtime bundle-identifier assertion at launch to catch native-cache drift.
- No application-code bugs surfaced. No in-tree fixes needed.

---

## Final status

| Obligation | Status | Method |
|---|---|---|
| 1 — verification-failure → error | ✅ VERIFIED | code inspection + device corroboration |
| 2 — `environmentIOS` == 'Sandbox' | ✅ VERIFIED | device |
| 3 — re-delivery / finish-post-grant / idempotency | ✅ VERIFIED | device (3a + 3b + 3c) |
| 4 — restore transactionId stability | ⏳ DEFERRED → 8.6 | with Remove Ads CTA |
| E1 cancel/interrupt | ✅ PASS | device |
| E2 Ask-to-Buy | ⏭️ skipped (optional) | — |
| E3 / E5 | folded into 8.10 TestFlight | — |
| E4 already-owned | ⏳ DEFERRED → 8.6 | with Remove Ads CTA |

**Overall: ✅ Phase 8.5.8 complete.** Three of four load-bearing assumptions
device-verified; the fourth (restore stability) is correctly deferred to 8.6
where the Remove Ads CTA makes it testable. Diagnostics reverted; no code bugs.
