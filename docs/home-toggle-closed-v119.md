# Closed fold-handle artwork

2026-11-24

The cropped v106 full-width rim left horizontal gold stubs at the isolated handle's sides. Replace that crop with a newly authored complete closed button in `packages/assets/home-toggle-v119/`. The gold rim curves around all four corners and the bottom; the entire image is shown with contain, without cut-off horizontal ends. Original artwork and prompt are retained.

The click target stays104×44px; the artwork occupies92×29px. Recenter the separate chevron on the new closed face. The white panel, matching content insets, original footer and camera/gesture instruction remain unchanged.

Validation: static Vite build passed. Actual App/CSS with isolated mocked APIs passed46 browser checks at320×568,390×844,430×932 in collapsed and expanded states, no runtime page errors. Inspected actual handle rendering and a3× crop. Runtime image is640×209px with maximum alpha of1/255 at crop edges, confirming no opaque rim touches the crop boundary. Screenshots and results: `output/verification/home-panel-v119/`.

No production deployment or native synchronization performed.
