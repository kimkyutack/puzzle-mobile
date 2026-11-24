# Shop reference v91

Approved target: output/design/footer-pages-v90/01-sky-surface.png, first displayed concept. Only inline shop uses these assets; package modals retain their existing art.

Source PNGs and exact prompts are kept in source/. Generated with built-in image_gen: starter-banner, tool-card, category-tab. These are UI surfaces, not gameplay obstacles. Existing tool and navigation icons are reused.

Runtime WebP files and sampled sky backdrop are produced by tools/asset-pipeline/shop-reference-v91.mjs. extraction.json records the selected image and extraction area. Component: ShopMenu.tsx. Styles: shop-reference-v91.css. Verification and comparison: docs/shop-reference-v91.md.
