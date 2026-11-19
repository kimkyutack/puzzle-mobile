# Event UI v44 artwork

Generated with the built-in Image Gen tool on 2026-11-09. These are original reusable game UI assets; text, rewards, buttons, scenes, and progress remain live DOM/game content.

## festival-frame

A single landscape casual mobile puzzle game frame. Polished honey-gold bevels, a slim cobalt enamel rim, coral garden blossoms and leaves restricted to the four corners. A fully transparent center and exterior, no text, icons, buttons, or scenery. Orthographic view; plain long edges suitable for nine-slicing.

- Source: `festival-frame.png`, with original alpha.
- Runtime: `festival-frame.webp`, 1200 × 600px, alpha retained.
- Slices: top/bottom 160px, left/right 240px. Displayed at a consistent scale so floral corners keep their proportions.

## mission-scroll

A single isolated horizontal parchment scroll for a game goal/reward tray. Chunky curled ends, gently irregular edges, muted warm apricot face, golden edge highlights, amber underside depth, empty central face. No rectangular thin border, text, symbols, icons, flowers, or props. Straight-on, tactile painted 3D casual-game style, transparent exterior.

- Source: `mission-scroll.png`, with original alpha.
- Runtime: `mission-scroll.webp`, 1200 × 600px, alpha retained.
- Slices: top/bottom 110px, left/right 200px. Curled ends remain proportional across phone widths.

Consuming components: `ContentEventCards` and `FlowerlightFestival` in `apps/client/src/ContentEvents.tsx`; sizing and artwork slicing in `apps/client/src/content-events.css`.

## Treasure reward bloom

Generated with the built-in Image Gen tool on 2026-11-16.

Create one production-quality 2-state sprite atlas for the original Korean cozy gardening match-3 game Cloud Garden. It depicts one iconic flower-bud keepsake box that players tap and open after winning a card-matching mini-game. Wide 2:1 canvas, two equal cells side by side, each on completely transparent alpha. Both states must use the very same object, dimensions of base, angle, center, lighting and materials, positioned on the same baseline. LEFT: closed, six overlapping sculpted warm ivory petals curl around the lid of a squat round periwinkle porcelain seed case, with a little mint green sprout clasp at front; its low round ceramic base has a few fine gold vine details. RIGHT: the same case opened as a blossom with its ivory petal lid gently spread back into five broad individual petal shapes around a shallow softly lit sky-blue dish. Empty interior, so the game can display the actual rewards. Gentle gold light inside the dish without bright glow extending beyond the shape. Hand-painted dimensional mobile game art, polished porcelain, cheerful soft-saturated teal, cream, lavender with tiny warm gold accents, bright warm daylight, bold compact silhouette that reads clearly at 200 pixels. Each state fits in its own square with clear margins, no overlapping states, same three-quarter front view with a slight view of the top. No text, no letter forms, no button, no star badge, no cards or coin props, no bag or vertical red-and-gold pouch, no background, no floating fragments or ground shadow. Genuine transparency beyond the object.

- Runtime: `treasure-bloom-closed.webp` and `treasure-bloom-open.webp`, 640 × 588px, alpha retained.
- Screen: `apps/client/src/TreasureRewardReveal.tsx`.
