# Back-of-hand tutorial pointer

2026-11-24

Replaced the palm-facing pointer with newly generated dorsal-view artwork: visible index fingernail, finger joints, smooth hand back and knuckles; other fingers curl away behind the hand. Preserved the up-left direction, cream/peach mobile-game material and transparent background. Original artwork and generation prompt retained under `packages/assets/tutorial-hand-v121/`.

The 256×256 lossless WebP registers under the existing `hand` asset ID during preparation. This build-pinned import takes precedence over the legacy downloaded manifest's pointer, including when a cached pack is reused. All other assets retain their existing verification path. Board anchor, size, animation timing, layer ordering and input behavior are unchanged.

Validation: TypeScript and static Vite build passed. Actual Board/level43 rendered at400/800/1168ms and at320px viewport width; inspected the back-facing pose and unoccluded hand outside the focus area. Asset resource check confirms the new bundled hand URL loads while the legacy hand URL is not requested. No browser runtime errors.

Screenshots/results: `output/verification/tutorial-hand-v121/`. No deployment or native synchronization performed.
