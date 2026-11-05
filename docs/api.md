# API contract

The base path is `/api`. User APIs take `Authorization: Bearer <accessToken>`; provider callbacks use provider verification instead. Requests are bounded JSON except the Apple form-post callback and original AdMob signed query.

Success is `{data,serverNow,stateVersion}`; times are UTC epoch milliseconds. Failure is `{error:{code,message},serverNow}` with an appropriate HTTP status. An expected refusal (empty heart, insufficient coins, cooldown, stale sequence) is not a completed transaction. Reuse the original idempotency key after transport failure. Reusing a key for different input returns 409.

`key` and `idempotencyKey` are accepted aliases for economic mutation identity (8–100 characters). Shared `Player`, `Run`, `GameState`, `Action`, `Gift`, guild, story and reward-intent types live in `packages/contracts/src/index.ts`.

| Route | Input / data |
|---|---|
| POST `/auth/guest` | Empty object → `AuthResponse` |
| POST `/auth/refresh` | `refreshToken` → refreshed `AuthResponse` |
| GET `/me` | `{player,activeRun}` |
| PATCH `/me` | Optional nickname/settings/tutorials; tutorials is the complete learned set, `[]` resets help |
| DELETE `/account` or `/me` | `confirmation:'DELETE'` (or `confirm`) → `{deleted:true,identityRevocation:'pending'|'not_needed'}`; legacy Apple links require reauthentication if no revoke credential was captured |
| POST `/auth/challenge` | `provider:'google'|'apple'` → `{nonce,challengeId}` |
| POST `/auth/link` | `provider,challengeId,idToken?`; native Apple also `authorizationCode,appleFlow:'native'` → linked result or conflict summaries and switchToken |
| POST `/auth/apple/callback` | Apple web form-post `state,code` → fixed native deep link with opaque state only |
| POST `/auth/apple/notifications` | Apple-signed identity `payload` → durable verified inbox; consent revocation disables affected sessions and disconnects the identity |
| POST `/auth/switch` | `switchToken` → chosen account `AuthResponse`; active source run must be resolved |
| POST `/auth/logout` | Revokes the current session |
| GET `/auth/links` | Linked provider names |
| POST `/runs/start` | `key,preBoosters:[]` → `{player,run}`; valid active run is resumed |
| GET `/runs/:id` | `{run}` owned by this player |
| POST `/runs/:id/actions` | `key,sequence,actions` of swap/tap and inventory booster actions; `{player,run,events}` |
| POST `/runs/:id/booster` | `key,sequence,item,at?` → `{player,run,events}` |
| POST `/runs/:id/continue` | `key,sequence` → `{player,run,cost}`; exact +5, maximum three |
| POST `/runs/:id/finish` | `key` → server-derived result/reward; client win/amount ignored |
| POST `/runs/:id/abandon` | `key` → closed run, no refund |
| POST `/hearts/free` | `key` → latest player; four-hour claim cooldown |
| POST `/hearts/buy` | `key,amount:1|'full'` → latest player and actual cost |
| POST `/shop/buy` | `key,item` → player, cost and bound provenance |
| POST `/garden/restore` | `key,taskId` → player and area-completion result |
| GET `/story` | `{contentVersion,unlocked,seen,styles}` derived from this account's restored work; read-only |
| POST `/story/seen` | `{sceneIds:string[]}` (1–19 known, unlocked scenes) → latest story state; retries/concurrent calls form a union |
| POST `/garden/style` | `{taskId,style:'classic'|'festival'}` for a completed planter/bench/lamp slot → latest story state; no currency cost |
| GET `/catalog` | Products, coin prices, 18 restorations and active season |
| GET `/events` | Daily availability, personal/guild progress, pass tiers/claim status |
| POST `/events/daily` | `key` → player |
| POST `/events/claim` | `key,kind:'personal'|'guild'` → player |
| POST `/pass/claim` | `key,tier:1..30,track:'free'|'premium'` → player |
| POST `/pass/guild-gift` | `key,seasonId` → tier30 voucher sent once to current guild members as one normal hammer each |
| GET `/profile/decorations` | Earned premium tier15 profile emblems; server requires retained season ownership |
| GET `/gifts` | `{gifts}`; only remaining quantities |
| POST `/gifts/:id/claim` | `key` → player, remaining gifts and actual claimed amount |
| GET `/guilds?q=` | Search results (maximum 50) |
| POST `/guilds` | `key,name,description,mode,emblem,minLevel` → guild and player |
| POST `/guilds/:id/join` | `key` → player, pending approval flag |
| GET `/guild` | Guild, members, active requests, filtered recent chat, applications; supportStatus contains current daily sent/received counts, next request times and stored hearts |
| PATCH `/guild` | `key,description?,notice?,mode?,minLevel?,emblem?`; officer/leader only |
| POST `/guild/approve` | `key,userId`; officer/leader only |
| POST `/guild/role` | `key,userId,role`; leader only; leader transfer demotes current leader |
| POST `/guild/leave` | `key`; committed gifts remain |
| POST `/guild/kick` | `key,userId`; role-checked |
| POST `/guild/chat` | `key,text`; maximum 240 characters, two-second throttle |
| POST `/guild/requests` | `key,kind:'heart'|Booster` |
| POST `/guild/requests/:id/help` | `key`; inventory/gift/quota transaction |
| POST `/guild/block` | `key,userId` |
| POST `/guild/report` | `key,messageId,reason` |
| POST `/guild/socket-ticket` | One-use, 30-second connection ticket |
| GET `/guild/socket?ticket=` | WebSocket upgrade; messages are invalidations, data is fetched with session auth |
| POST `/ads/reward-intents` | `key,placement:'heart'|'coin_bonus',runId?` → `{intent}` |
| GET `/ads/reward-intents` | Pending/history list |
| GET `/ads/reward-intents/:id` | `{intent}` |
| POST `/ads/reward-intents/:id` | `key,status:'pending'|'cancelled'|'review'`; never grants currency |
| POST `/ads/reward-intents/:id/cancel` | `key`; cancellation alias |
| GET `/ads/ssv` | Original provider-signed query; no user bearer token |
| POST `/purchases/prepare` | `key,productId` → immutable purchaseIntentId, pinned season, expiry |
| GET `/purchases/intents` | Incomplete intent list and canCancel flags |
| POST `/purchases/intents/:id/cancel` | `key`; reserved only; binding retained for late proof |
| POST `/purchases/intents/:id/pending` | `key`; deferred SDK hint, never a grant |
| POST `/purchases/verify` | `provider,productId,token,purchaseIntentId?`; missing intent is recovered from authenticated receipt binding |
| GET `/purchases` | Purchase status history and current player; no raw tokens |
| POST `/purchases/apple/webhook` | Signed App Store notification |
| POST `/purchases/google/webhook` | Authenticated Pub/Sub/RTDN envelope |
| POST `/auth/apple/callback` | Apple form_post state/code; fixed token-free app redirect |
| GET `/admin/overview` | Session + separate admin secret header; bounded diagnostics |
| GET `/assets/:version/assets/:file` | Public immutable R2 runtime artifact |

All sequence-bearing actions are applied through the shared engine. Moves and owned inventory boosters run locally and queue durably, including offline during an active run. The actions endpoint replays and charges every booster atomically; only starting a run, paid extra moves and granting final rewards require confirmation before proceeding. The client must compare/replace with confirmed state after a sequence conflict. Runs retain their engine/content/seed/initial booster approval for 24 hours and never trust a client snapshot as authority.

Story and decoration appearance are separate presentation state. All three story/style routes return `StoryState` directly as `data`. Their strict request bodies accept no economic idempotency key, price, balance or Player snapshot. They never rewrite `Player`, increment its version, consume stars, or append economic ledger entries. Unlocks derive from the server's completed restorations. Seen acknowledgements merge per scene; replay does not clear them. Missing styles mean `classic`; the nine completed planter, bench and lamp slots may change to `classic` or `festival` freely. Account deletion removes both presentation records.

The server cannot acknowledge an ad or purchase as real until its provider is configured and sends valid proof. Core gameplay, ordinary rewards, heart recovery and free unlimited claims do not depend on those providers.
