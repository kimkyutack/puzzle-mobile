# Plain white home panel

2026-11-24

The user replaced the full gold frame direction with a plain white panel and a gold-edged center fold handle. Removed the v116 full-panel surface from the active DOM/CSS; retained its original artwork files. Restored HomeDockFace with a simple white background, rounded upper corners, and a30px overlap behind the footer.

The existing gold/blue tab artwork is shown only within the104px-wide center handle. No gold line runs across the panel or down its sides. The original three-part rounded footer raster and active-menu crown are restored on home, matching the other footer pages. Gesture instructions and expand/collapse behavior are retained.

One shared8px content inset aligns the expanded rewards row and utility menu with the primary buttons (18px from viewport edges). The main action/footer spacing fromv117 is retained.

Validation: TypeScript and static Vite build passed. Actual App/CSS with isolated mock APIs passed46 Playwright checks in collapsed/expanded states at320×568,390×844,430×932, with no runtime page errors. Verified removed full-width frame, gold confined to the handle, rounded white body, original footer artwork, consistent rewards/menu/action alignment, complete folding, instruction visibility and no horizontal overflow.

Screenshots and results: `output/verification/home-panel-v118/`. No Worker deployment or native synchronization performed.
