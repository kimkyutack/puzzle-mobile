# Tutorial hand above the spotlight

2026-11-24

The hand was drawn inside Board's Pixi canvas, while ItemLessonFocus was a higher DOM SVG. Its dimmer covered parts of the moving hand whenever they left the transparent tile apertures.

Render the same dimmer, transparent apertures and rounded outlines with Pixi Graphics after the board's existing layers. Put the hand in a dedicated final container above the dimmer. Keep the original 1600ms animation, anchor, sprite size and input logic. The focus refreshes even when only tutorial props change on the same board state. Remove the unused SVG component/CSS, and explicitly dispose of the hand when clearing highlights.

Verification:

- TypeScript and static Vite build passed.
- Existing drag-preview and idle-hint tests: 31 passed.
- Real level 43, actual Board and actual engine, no account/API mutations. Browser captures at 400/800/1168ms compare no dimmer, a reproduction of the old DOM dimmer, and the fixed renderer. Also verified 320px layout, dismissing the guide without changing board state, and a real pointer drag accepting the guided swap. No runtime page errors.
- 332 sampled hand pixels outside the apertures: mean RGB difference versus the undimmed reference was 114.30 with the old overlay and 0.57 after the fix (0–255 scale). The dimmed tile sample still differed by 105.33, the highlighted tile matched exactly, and dismissing the guide restored the dimmed tile exactly.
- Evidence: `output/verification/tutorial-pointer-v120/results.json` and screenshots. Original DOM rendering is reproduced only in the isolated QA fixture.

No deployment or native synchronization performed.
