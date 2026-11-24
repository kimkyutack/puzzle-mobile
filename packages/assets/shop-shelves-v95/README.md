# Garden shelf shop assets v95

Approved reference: output/design/shop-shelves-coins-v94/scroll-states.png.

Built-in image_gen created individual background/sign/shelf/section heading/card faces and six coin product cutouts. Original PNGs and exact prompts are preserved in source/. This is commerce UI artwork, not gameplay obstacle artwork; no obstacle or debris selector was changed.

Run node tools/asset-pipeline/shop-shelves-v95.mjs to produce runtime WebP files. It trims transparent export margins from the sign/headings/card faces, preserves source PNGs, and derives the category rail from the authored shelf front board. Artwork metadata is recorded in artwork.json.

Coin cutouts match actual catalog amounts1000,2500,6000,15000,40000,100000. Unknown future amounts use the existing legacy bundle icon. Native store prices, item names, quantities and account balances remain live UI text.

Consumers: apps/client/src/shop-shelf-art.ts, shop-shelves-v95.css, ShopMenu.tsx, HubPage.tsx. Shared footer and modal artwork remain unchanged. QA: docs/shop-shelves-v95.md.
