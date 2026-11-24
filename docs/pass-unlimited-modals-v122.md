# Pass and unlimited-tools modals

2026-11-24

Both home dialogs now use the existing shared raster Modal frame and close icon. Removed full-bleed custom framing, custom close artwork and the premium screen's back button. Pass stage navigation uses range chips instead of back arrows. Other event pages and settings/decoration/package dialogs are unchanged.

The pass book uses normal grid/flex layout, centered tier numbers, and one large reward image/quantity per track and tier. Five tiers fit on taller screens, three on shorter screens and two on very short screens. The premium purchase summary separates coins, tools, placeable decorations, the profile emblem and guild voucher. The existing purchase/verification flow remains in the modal.

The unlimited scene retains its illustration and authored status/tool/time positions inside the shared frame. Explicit image stacking prevents the raster modal backing from covering it. Schedule notes have readable contrast and a minimum font size. No event schedule behavior changed.

## Actual pass rewards

The authoritative shared map is `packages/contracts/src/pass-rewards.ts`. Each free/premium slot contains exactly one prize. A fresh complete pass retains 750 free coins and 2,250 premium coins, plus the existing total of six premium hammers. New tools and real placeable decorations are interleaved:

| Track | Non-coin tiers |
|---|---|
| Free |5 rocket,10 daisies,15 flower bomb,20 hammer,25 potted flowers,30 rainbow lantern|
| Premium |3 two hammers,5 rocket,6 bench,9 flower bomb,11 two hammers,12 lamp,15 profile emblem,17 rainbow lantern,18 blue hydrangeas,20 row sweep,23 two hammers,24 cherry tree,27 shuffle,29 swing,30 guild gift voucher|

New claims write both their original independent track receipt and a `pass:reward-v2:<track>` marker. Previously claimed rewards remain claimed and retain their legacy receipt metadata. New decorations are stored as trusted garden grants; a claim-all accumulates all grants against one world snapshot and saves it once. The returned world updates the home's cached garden immediately. Existing idempotency and paid-track/point eligibility remain in force.

## Verification

- TypeScript and static Vite build passed.
- 18 tests passed across pass catalog totals/valid items, real SQLite transactions and legacy claims, client selection/claim state, and attention integration.
- 78 browser checks passed using the actual App/components and isolated API fixtures. Covered 320×568,390×844,430×932, English/Japanese at 320×640, owned/claimed states, all 30 tiers, decoded decoration images, single-prize cells, icon size, no text overflow, tier navigation, individual/claim-all UI, shared frames, close controls and nonoverlapping unlimited labels/CTA. No page errors.
- Premium purchase entry/completion was checked with a mocked native store. No live purchase was made; browser API fixtures do not prove production delivery. Server payouts/storage were separately checked against SQLite.
- Screenshots/results: `output/verification/pass-modals-v122/`.

No Worker deployment or native synchronization performed.
