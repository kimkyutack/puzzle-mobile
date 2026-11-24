# Direct extraction of the selected garden lawn

This asset is extracted directly from the approved original design. No ImageGen redraw, color filter, painted edge, procedural grid or invented texture is used.

- Original source: `source/selected-original.png` (853×1844, preserved byte-for-byte).
- Exact source patch: `source/lawn-patch.png`, source rectangle x289, y183, 140×73. Verified decoded RGB difference: 0 pixels.
- Chosen diamond vertices in original source: left (291.5,219.25), top (359.5,185.25), right (426.5,218.75), bottom (358.5,252.75).
- Affine axes: U=x+2y, U∈[730,864]; V=x−2y, V∈[−147,−11]. The slight original axis difference is normalized into the existing 2:1 runtime footprint with bilinear resampling only.
- Runtime: `runtime/ground.webp`, 256×128 lossless RGBA. Alpha copied exactly from the original production ground.png; verified mismatch count 0.
- Runtime palette mean: RGB (136.98,175.39,61.16), taken from source pixels with no recoloring.

Reproduce with `node packages/garden-world/art/home-v78/extract-ground.mjs`, then `verify-mobile-repeat-64.mjs` and `verify-source-comparison.mjs`.

`verification/source-vs-repeat-64.png` shows the exact approved lawn crop at left and a repeated 64×32 rendering of the extracted asset at right, enlarged 3× for inspection. Repeating a single authored cell naturally repeats that cell's variation; it does not recreate the complete unique reference map. Object placement and map code remain untouched by this asset task.

## Direct stone-path extraction

`runtime/path.webp` is extracted from the ORIGINAL weathered two-row cream-paver strip immediately before the lamp, below the fountain. It includes the original small chipped corners, tiny grass holes/joins and grass margins. It is deliberately not a fabricated full-diamond four-square pavement pattern. Original paver density and the narrow two-row walkway are retained when drawn as a 64×32 terrain cell.

- Exact source rectangle: x176, y692, 148×77, saved as `source/path-patch.png`; source RGB differences 0.
- Original quad vertices: left (178,730), top (250,694), right (322,730), bottom (250,766).
- Axes: U=x+2y ∈[1638,1782], V=x−2y ∈[−1282,−1138]. Pure uniform affine crop with bilinear resampling only; no recoloring or synthesized pavement.
- Existing original path.png alpha is copied verbatim into the 256×128 lossless WebP; alpha differences 0.
- The strip follows the world +x direction in its unrotated image. Existing ground-tile rotation can turn it to the perpendicular direction. Corners/junctions must be judged in the real map, since this extracted straight strip does not invent an intersection shape.

Reproduce with `extract-path.mjs` and `verify-path-mobile.mjs`. Verification: `path-source-vs-tile.png`, `path-repeat-64x32.png`, `path-detail-64x32.png`, and `path-extraction.json`. Alternate source candidates remain under verification only; the final runtime uses candidate A, the weathered strip.

## Paving-only production overlay

`runtime/path-paving.webp` separates the already extracted paving from its green lawn backing. `runtime/path.webp` and its earlier proof files are unchanged.

`pack-paving.mjs` modifies **alpha only** where **G>R and G>B**. At green-minus-red 0..5, a smoothstep alpha transition keeps soft anti-aliased stone edges; stronger green pixels become transparent. Every non-green stone pixel retains both original RGB and alpha exactly (verified mismatch counts 0). No RGB recoloring, new stone, redraw or AI generation is involved.

Use the overlay over the live lawn, and rotate the same overlay for perpendicular paths. The X-join proof is in `verification/path-paving-cross-32.png` and `path-paving-cross-detail-32.png`; native 64×32 versions are also provided. `path-overlay-comparison-32.png` shows opaque grass-backed source at left, paving-only overlay at right. Both are rendered with DPR4 and downsampled to the actual small 32×16 tile scale.

Reproduce by running `pack-paving.mjs` then `verify-paving.mjs`. Full source hash, mask rule and stone RGB/alpha proof are in `verification/path-paving-mask.json`.
