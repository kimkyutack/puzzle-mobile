# Initial economy and accounting

These are Cloud Garden Match test values, not claims about another game's economy and not revenue-optimized values. Server handlers and D1 are authoritative. All API timestamps are UTC epoch milliseconds; daily limits reset at UTC midnight regardless of device timezone or guild changes.

| Item | Initial rule |
|---|---|
| New player | 500 normal coins, 5 hearts; two of each inventory/pre-game booster for introduction |
| Heart maximum / recovery | 5 / one every 3,600 seconds |
| New run | Requires a heart or unlimited time, without spending one |
| Failed / given-up run | One heart on final settlement, except unlimited-protected attempts |
| Free unlimited | Unlock after four clears; claim 30 minutes every four hours from claim approval |
| First-clear coins | Normal 50, hard 75, super 100 |
| First-clear restoration stars | 1 |
| Continue | +5 moves for 300 / 600 / 900 coins, at most three times per run |
| Heart purchase | 100 per missing heart; full refill costs only missing quantity |
| Hammer / shuffle | 150 each |
| Row / column sweep | 250 each |
| Start wind / bomb / rainbow | 150 / 200 / 300 |
| Area completion | 100 coins after its sixth restoration task |

Natural recovery preserves a partly elapsed interval when another heart is spent. At cap, no additional time accumulates. Spending the first heart from cap starts a new interval. Natural recovery continues during unlimited play. A new unlimited award appends to `max(now, unlimitedUntil)`; it never erases an existing entitlement. Restarting a device does not pause the time.

Every successful new run pins its heart policy, selected pre-game boosters, initial board and content version. Clearing keeps the heart; final failure or explicit give-up spends one heart atomically and only once. Running out of moves while considering or purchasing +5 does not settle the failure. Recovery time starts when a heart is actually lost. Reconnecting or returning home with progress saved never spends a heart. Attempts started during unlimited time remain protected for that whole attempt. Technical errors and the 24-hour recovery expiry do not create a new debit. Legacy active runs that already paid at entry return that heart once on a clear and never pay twice on failure. Invalid pre-game placement or insufficient inventory fails the entire transaction. A clear reward is independent of advertisements and unique per player/level.

## Provenance

`coins` and `boundCoins` are separate balances; the UI displays their total. Inventory has `normal` and `bound` buckets. Personal purchases/spends consume bound funds/items first. If any bound coin funds one purchased item, that whole item becomes bound. Guild donation can use only normal inventory. Stars, coins, receipts, pass ownership and unlimited claims cannot be donated.

Ledger entries record each changed asset, delta, reason, source ID and server time. A DB version assertion protects the computed result; negative balances and duplicate reward/donation/receipt identifiers are also rejected by database constraints. Provider grant and store finalization are separate retryable steps.

## Guild support

Guilds unlock at level 5 and hold at most 30 people. Heart requests expire after four hours, allow five distinct helpers and have a four-hour request cooldown. A helper loses no personal playing heart; instead the initial daily send quota is ten. The receiver's initial daily heart intake is ten, with up to twenty unclaimed hearts in storage. Heart gifts do not expire. Claim uses only available heart capacity and preserves the remainder.

Item requests support hammer, horizontal sweep, vertical sweep and shuffle. One item can be received per request, with a four-hour request cooldown and initial send/receive quotas of three per UTC day. Sending deducts one transferable item and creates the recipient gift atomically. Claim changes gift quantity and inventory atomically. Leaving closes unfinished requests but preserves gifts already committed.

## Voluntary ads

Only heart +1 and first-clear coin doubling are active placements. The first four levels hide ad offers. A heart offer is ineligible at cap or during unlimited time. An approved intent preserves its promised personal heart if natural recovery fills the wallet while an ad plays; the granted heart remains in a bound personal gift.

Coin doubling awards one additional copy of that run's already-confirmed base coins. It never doubles stars, pass points, event or area awards. Maximum initial daily grants are five heart ads and ten coin bonuses, with one bonus per won run. Quota reservation is distinct from granted usage; load failure/cancellation does not claim a reward. A valid late signed callback is processed against the original intent rather than the current screen/account/day. Client SDK callbacks and arbitrary timers do not authorize currency.

## Products and events

The test catalog defines six consumable coin quantities: 1,000; 2,500; 6,000; 15,000; 40,000; 100,000. A once-per-account starter pack and a specified booster bundle are separate products. Prices must come from the native stores, never invented purchase labels.

The garden pass is a 28-day, 30-tier, non-renewing season entitlement. Clears provide progress to free and premium tracks. Season windows and claim keys are stored on the server. Daily, personal-goal and guild-progress rewards have their own durable claim keys. These rewards do not modify puzzle drops or maximum hearts. Expired season windows remain closed until an operator publishes a new configured season; device time cannot reopen them.

Each first clear within the season adds ten pass points. Each free tier awards 25 normal coins; each premium tier awards 75 normal coins and every fifth premium tier also awards one hammer. Premium tier 15 unlocks the seasonal gardener profile emblem, displayed using the generated star asset. Premium tier 30 grants one guild gift voucher. The voucher remains available until the player chooses a guild and sends it; this creates one normal hammer gift for every current member, including the sender, in one D1 transaction. It has no effect on the separate free support quotas. Duplicate sends and simultaneous requests cannot create another set of gifts. Badge/voucher claims and recipient gift grants have immutable ledger entries.

A revoked season purchase removes access to its profile emblem and any unsent voucher. Already-delivered guild gifts remain with their recipients; the system does not debit another player's wallet in response to the purchaser's refund. Claim records remain, so repurchasing a revoked season cannot repeat already-claimed rewards.


## Pass bulk collection and coin purchase confirmation · visual-v9

`POST /pass/claim-all` accepts the existing idempotency key and returns `{player, claimed: [{tier, track}], seasonId, reason}`. The server derives points from season clear records and premium access from season ownership, then atomically grants only currently unlocked, unclaimed rewards. It shares the per-tier grant path with `/pass/claim`, including tier15 decoration and tier30 guild-gift voucher. Same/different-key retries and individual/bulk races cannot duplicate rewards. No eligible reward returns `NOTHING_TO_CLAIM` without changing Player/version/assets/ledger; the idempotent operation receipt is still recorded. There is no schema migration.

The pass shows an eligible-count bulk action and a premium purchase entry. The latter uses the real catalog product and localized platform store price before invoking the existing prepare/verify/cancel/pending adapter. An unavailable store shows product information and navigation, without inventing a price or a successful purchase. Coin tool purchases first show item image/name/quantity, price and current coin balance; cancel sends no purchase, confirm invokes the original authoritative `/shop/buy` once. Insufficient funds and server errors retain the confirmation instead of claiming success.

The new bulk endpoint's actual HTTP checks use an isolated workerd/D1,39 server-validated clears and a private premium-owner test fixture. That fixture verifies server reward authority, not a real store entitlement purchase. The user's existing local D1 and native account are outside those tests.
