# Header currency alpha cleanup

Removes the cream resource-backplate and lawn fragments left in the existing coin, heart and restoration-star crops. The visible icon RGB pixels, 128×128 canvas, and pixel positions are preserved. No icon CSS dimensions or positions were changed.

Input: `packages/assets/home-refinement-v78/runtime/header-{coin,heart,star}.webp`.

Rebuild with `node tools/asset-pipeline/home-header-alpha-clean.mjs` from the repository root. The pipeline changes transparency only, then removes detached background remnants. Original assets are retained.

The three header imports in `apps/client/src/home-icon-art.ts` point to this directory. Numeric counters, their long cream backplates and their click behavior are unchanged.

Verification: `output/verification/home-header-clean-v1/pixel-check.json` confirms identical dimensions and zero RGB changes among retained visible pixels. `alpha-comparison.png` shows original assets above cleaned assets. TypeScript passed. The actual App was viewed in a separate browser tab at390×844; all three new assets loaded and the extra white rectangles/lines were absent. CSS sizes remained31.5px/34px/34.5px. This did not modify the parent chat's camera/collapse work, deploy, sync native assets or change API data.
