# Bright obstacle art and matching fragments

Mode: built-in imagegen with transparent alpha. Canonical subjects: open-definitions.json. Full production prompt: open-shared-prompt.txt. Per-kind structure and official references: form-rules.json. Sources: source/open-silhouette/. The earlier definitions.json, shared-prompt.txt and framed style-reference.png describe the rejected blanket-frame revision; do not use them for production.

Keep the existing gameplay: obstacle types, hit counts, board layouts, rewards and progression. This package changes their visuals and the material particles only.

- Compose a readable, bright, sculpted game prop. Standalone pots, jars, bells, rocks, crystals, flowers and statues have their own silhouettes without any added square tile frame, backing card, socket or tray. Use the original pot's physical thickness and softly painted materials with restrained broad ornament.
- Only actual containers holding multiple contents may show their functional shelf, cupboard, basket or rack. Keep that container and its contents cohesive; do not frame each inner item again. A machine may have its real chassis and a crate its own boards. These are not decorative tile borders.
- Inspect every relevant reference individually. Do not infer a universal design rule from a few framed examples. The previous generic square-frame definitions and style-reference image were rejected by the user and must not guide new artwork.
- Vine and ice are overlays: preserve a genuinely transparent center so the underlying colored tile stays visible at its full size.
- Every new obstacle must ship three physical states AND three isolated matching fragments. Never place the fragments inside a second box. Their material, palette and broken edges must match the parent object.
- The builder finds the real transparent gutter between rows, then aligns the three states to a shared crop so the frame does not jump while damaged. Bodies are 256px, fragments are 128px, with transparent 4px margins.
- Register future obstacle kinds through the contracts. The complete-catalogue test automatically requires their body and fragment images, so a new obstacle cannot silently fall back to unrelated debris.

Build: `node tools/asset-pipeline/obstacle-redesign-build.mjs`.
Preflight all sources: `node tools/asset-pipeline/obstacle-redesign-audit.mjs`.
Validate: `npx vitest run tests/obstacle-redesign.test.ts` and inspect the actual Board at mobile tile sizes. Source sheets are retained in source/, final client assets in runtime/.

Royal Match research: all 109 entries and 323 official state images were reviewed; individual notes and links are in output/verification/royal-obstacle-audit/review.md. A standalone item is not made into a container just to fill a tile. Several shelf vases share one real shelf in the renderer; they never receive individual cubby frames.

Transparency corrections and rejected retries: transparency-edits.txt. No per-cell ornamental restored-bed texture is drawn under standalone obstacles. Only the normal board floor remains beneath them.

Shelf alignment correction: `shelf-alignment-prompt.txt` records the image edit and measured contact faces. The open-backed shelf has plain slim end posts and no finials/top crossbar. `apps/client/src/flower-shelf-layout.ts` maps the two painted standing faces exactly one tile apart and seats every vase state on those faces. Avoid resizing this rack uniformly: its decorative bounding box does not encode the gameplay row spacing.
