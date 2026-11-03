# Local operation and deployment

The production API runs on the `puzzle-mobile` Cloudflare Worker with its own D1/R2 bindings. See [Cloudflare deployment](cloudflare-deployment.md) for the actual Git settings and client endpoint. Local Workers/D1 remain separate; local-only checks are not evidence of remote behavior.

## Local

From the repository root:

```sh
npm ci
npm run db:migrate
npm run dev
```

The client uses port 5173 and proxies `/api` to the API at 8787. The configured D1 UUID is a **local placeholder**, not a production database. Local state lives in `apps/api/.wrangler/state`. Deleting that directory deletes local accounts and progress. Use a separate directory/configuration for test environments.

```sh
npm test
npm run typecheck
npm run build
npx tsx tools/api-integration.ts
npx tsx tools/api-deep-checks.ts
npm run api:check
```

`api-integration.ts` accepts only localhost/127.0.0.1 and creates test accounts in the running local API. `api-deep-checks.ts` creates a separate, ephemeral workerd/D1 database. It injects **already-verified provider objects into private functions**, not into an HTTP bypass route. Cryptographic provider validation is independently covered by `tests/providers.test.ts`. These tests do not represent real AdMob views or sandbox purchases.

If the host denies Wrangler's default log path, set `WRANGLER_LOG_PATH` to a writable file under the project. Wrangler also requires permission to bind localhost ports.

## Cloudflare environment

1. Authenticate Wrangler under the intended Cloudflare account.
2. Create a distinct D1 database for each staging/production environment with `wrangler d1 create` and replace the placeholder database ID in an environment-specific config.
3. Create the R2 runtime bucket with `wrangler r2 bucket create`. Keep `packages/assets/source`, prompts, receipts, tokens and user data out of that public bucket.
4. Configure `ENVIRONMENT=production`, exact `CLIENT_ORIGINS`, `ASSET_VERSION`, and the public asset custom domain. Do not deploy with development error details enabled.
5. Apply migrations to the selected remote database with `wrangler d1 migrations apply cloud-garden --remote --config <config>`.
6. Run `wrangler deploy --dry-run --config <config>`, then deploy the reviewed artifact to the selected environment. The Durable Object `GuildRoom` uses the `new_sqlite_classes` migration and does not own financial balances.
7. Publish versioned runtime assets. `tools/api-publish-assets.ts` defaults to a dry run; `--remote` uploads with Wrangler. It includes runtime PNG/atlas/sequence files, original synthesized audio and approved content definitions, with a SHA-256 `pack-manifest.json`. It excludes solver logs, source art and private configuration. Serve images from an R2 custom domain or the Worker `/api/assets/<version>/assets/<file>` route. Audio/content remain in the same immutable version under `audio/` and `content/`; native apps also bundle them. `r2.dev` is not a production CDN choice.
8. Verify CORS, cache headers, hash/version consistency, start/reconnect behavior and one real pair of guild accounts in staging. Retain the previous immutable asset/content version for rollback.

All API clocks are UTC epoch **milliseconds**. The five-minute scheduled handler retries committed outbox records, verified advertisement inbox entries and store notifications. It does not add hearts. Heart recovery is calculated at request time. A fresh attempt checks heart availability without spending; only final failure or explicit give-up debits one, with pinned unlimited protection and idempotent settlement.

## Identity configuration

Workers settings: `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS`, `APPLE_BUNDLE_ID`, `APPLE_AUTH_CLIENT_ID`, `APPLE_AUTH_REDIRECT_URL`, `APPLE_TEAM_ID`, `APPLE_AUTH_KEY_ID`. Store the Apple authentication signing key as secret `APPLE_AUTH_PRIVATE_KEY`, and a cryptographically random 32-byte base64url encryption key as secret `AUTH_TOKEN_ENCRYPTION_KEY`. Preserve that encryption key until all existing authorizations have been reencrypted or revoked; changing it alone makes captured credentials unreadable.

Native/web client values and platform registrations are listed in `.env.example` and `docs/native-services.md`. Google audiences may contain multiple comma-separated valid OAuth client IDs. The server validates provider signature, audience, issuer, expiration and the session-bound nonce before linking. Both native and Android web Apple codes are exchanged server-side with the exact client audience. The original challenge holds a verified subject and an authenticated-encrypted refresh credential until linking commits. The Android callback redirects to `cloudgarden://auth` with an opaque state identifier; no tokens are placed in that URL.

An existing provider identity returns both progress summaries and a short-lived account-switch token. The player chooses switch/cancel. Current active runs must be explicitly resolved before switching. Accounts are never merged. Refresh credentials are opaque and hashed in D1; revocation and account deletion invalidate sessions.

Deletion removes provider links, disables sessions and anonymizes player/chat names. The same D1 transaction puts encrypted Apple credentials into the revocation outbox and removes them from active authorization storage. Delivery calls Apple's revoke endpoint, retries after outages, and erases the delivered ciphertext. The API reports identity revocation as pending until delivery; older Apple links with no captured credential must reauthenticate before deletion. Configure `/api/auth/apple/notifications` separately from App Store notifications: verified consent/account revocation events enter the durable identity inbox and disable affected sessions and links. Delayed events cannot remove an authorization created after the event timestamp.

Settings lists linked provider names and offers explicit current-device logout. Logout revokes that access/refresh session; account deletion revokes every session. Guest logout asks the player to link first to avoid stranding unlinked progress. Pseudonymous financial/idempotency records remain for transaction integrity. A launch retention policy and support process must be selected before publishing; this implementation does not claim regulatory certification.

## Store configuration and sequence

Google settings: `GOOGLE_PACKAGE_NAME`, `GOOGLE_IAP_ENVIRONMENT=Sandbox|Production`, `GOOGLE_RTDN_AUDIENCE`, `GOOGLE_RTDN_EMAIL`; secret `GOOGLE_SERVICE_ACCOUNT_JSON`. Give the service account the required Play Developer API rights for the actual package. Register all product IDs from `/api/catalog`.

Apple settings: `APPLE_BUNDLE_ID`, `APPLE_APP_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_ENVIRONMENT=Sandbox|Production`, and `APPLE_ROOT_CA_PEMS` containing trusted Apple root PEM certificates as a JSON array. Secret: `APPLE_IAP_PRIVATE_KEY`. Register the bundle, products and App Store notification URL.

The app prepares a purchase intent before opening the platform payment sheet. This checks current ownership and prevents simultaneous active requests for the same product. A pass intent pins the season; a later approval cannot silently buy a different season. Google pass purchases are consumable at the store layer so the same SKU can be bought in a later season; D1 `season_owners` carries the entitlement. The starter pack is a one-time product.

Apple `appAccountToken` is the immutable purchase-intent UUID. Google `obfuscatedAccountId` is SHA-256 of `userId:purchaseIntentId`. The server validates these exact bindings and can recover the intent after reinstall or if a notification precedes the device response. The intent owner is the recipient; an account switch cannot redirect the purchase. `GET /api/purchases/intents` lists incomplete requests. A definite pre-sheet failure or user cancellation may call `POST /api/purchases/intents/:id/cancel`; the binding remains available for a valid late receipt. Native deferred/pending results mark the intent pending even before a receipt is available. Pending purchases are never silently expired or reopened as a new sheet. An expired reserved request can be explicitly cancelled after platform reconciliation; the API does not blindly release an unknown in-flight purchase.

Sequence: prepare intent → platform purchase → provider verification → atomic D1 grant/receipt ledger → acknowledge/consume/finish. Pending purchases do not grant anything. Lost grant responses recover from the same unique provider transaction. Post-grant finalization retries through the outbox. Restore synchronizes current balances and entitlement state; it never re-adds previously consumed coins.

Webhook paths are `/api/purchases/google/webhook` and `/api/purchases/apple/webhook`. Notifications are authenticated with their provider-specific verification and stored in `external_events`. Unknown/unmatched transactions remain reviewable instead of guessing their owner. Refunds remove the remaining normal purchase currency/items and revoke the pass entitlement. Already-spent coin shortfalls are recorded in `purchase_debts` for operator review, never turned into a negative wallet or automatically charged again.

## Voluntary AdMob rewards

Set `ADMOB_HEART_AD_UNIT`, `ADMOB_COIN_AD_UNIT`, `ADMOB_AD_UNITS` (the explicit allowlist) and `ADMOB_REWARD_ITEMS` (normally `reward`). Configure both native SDK reward units to amount 1; the game reward amount comes from the immutable server intent. The SSV URL is `/api/ads/ssv`.

The app obtains an intent first, then loads an ad with `custom_data=intent.id` and `user_id=player.id`. Google signs the original query bytes. The Worker verifies ECDSA/P-256 using Google's public keys before decoding the signed fields. Only this proof can create a durable inbox entry and grant. The client reward callback is a pending-state hint.

The signed view time must fit the intent's approved window. Late HTTP arrival is accepted. A verified callback is persisted before success; Cron can retry its grant even if the original process dies. A full heart wallet converts an approved heart award into a bound personal gift. Coin bonuses are bound and cannot be laundered through item support.

Cancelled/no-fill loads do not increment `ad_daily_usage.granted`. Retrying the same placement/run reuses the cancelled intent and its quota slot, preventing cancellation followed by late SSV from generating multiple promises. Unresolved intents remain in `review` after expiry and can be inspected through admin diagnostics. This conservative policy can retain a slot while a missing callback is investigated; it never subtracts existing rewards or blocks normal play.

Test and production ad units/configs must be separated. Enable the official UMP consent/privacy options and relevant platform declarations before device validation. No runtime endpoint grants rewards from a fake client callback.

## Local-only heart refill

The deployment configuration defaults `LOCAL_DEV_TOOLS=disabled`. `tools/local-api.mjs` starts `wrangler dev --local` with explicit `ENVIRONMENT=development` and `LOCAL_DEV_TOOLS=enabled` overrides. These command-line overrides are not stored in deployment configuration. Production must retain the disabled flag and use `ENVIRONMENT=production`.

Authenticated `GET /api/local/features` reports `freeHeartRefill`. Authenticated `POST /api/local/hearts/refill` accepts a normal idempotency key and sets only hearts to five and their recovery anchor to zero, using the same CAS/operation/ledger transaction as other economy changes. It does not add coins, change the four-hour bonus, add unlimited time, advance levels or alter an active run. The grant route returns 404 unless all three conditions hold: development environment, explicitly enabled flag, and a loopback/private IPv4 request hostname. Public domain names fail closed even when flags are accidentally enabled. Forwarded host headers are not trusted.

`native:local` forces `VITE_LOCAL_DEV_TOOLS=enabled`; `native:release` forces it disabled regardless of the calling environment, and records the choice in `native-build.json`. Browser Vite development and explicitly configured native local bundles still require the server capability. Android local builds use `adb reverse tcp:8787 tcp:8787`; the iOS Simulator reaches the Mac through localhost. `getLocalFeatures()` and `refillLocalHearts(key)` in the client API enforce this client visibility contract while the server remains authoritative.

`tools/api-v5-checks.ts` verifies the real D1 backfill, ties, current-membership totals, pagination, deleted-account filtering and 300/600/900 continue races. `tools/api-v5-http.ts` starts the actual Worker against an isolated local D1 database and verifies the HTTP routes, auth, normal initial economy and production-disabled 404 behavior. Neither harness is a production grant API.

## Operational review

`GET /api/admin/overview` requires both an authenticated session and the `X-Admin-Token` header matching the Worker `ADMIN_TOKEN` secret. It exposes bounded approved-level samples, economy catalog, recent ledger, pending ads and delivery attempts. `tools/api-admin.ts` is a read-only CLI using environment variables for credentials.

Before a new season, insert its actual `starts_at`/`ends_at` (28 days) in `seasons`; existing receipts remain pinned to their original season. Publish only levels that pass the offline validator and keep rejected candidates quarantined. Never alter active-run seeds or reward quantities in response to purchases/losses.

Inspect callback age, outbox attempts, unmatched store events and refund debt records. Retry verified inbox/outbox work; never manufacture a grant from a user's assertion alone. Operation logs include categories and pseudonymous user IDs, not chat text, credentials or raw receipts. Deployment rollback must retain compatible engine/content support for all active runs during their 24-hour recovery window.

Official references checked during implementation: [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), [Durable Object WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
