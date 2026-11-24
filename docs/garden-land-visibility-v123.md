# Visible buildable garden land

2026-11-24

Home previously repeated the same full-brightness lawn over the entire viewport; only editing mode distinguished owned cells. The terrain now paints a muted background lawn, then clips the original full-brightness lawn to `gardenLandCells(world)`. A thin light grass edge over a darker bank marks exposed boundaries. Buildings, ground paths, residents and existing placement/expansion previews still draw afterward.

The boundary uses actual cell adjacency, not the map's bounding rectangle. Shared edges between regions and purchased plots disappear; notches and separately unlocked areas retain their correct shape. Locked land remains muted in both home and editor modes. Installation/collision rules, expansion pricing, selection gestures and purchase confirmation are unchanged. No new ground artwork replaces the accepted garden tiles.

Verification:

- TypeScript and static Vite build passed.
- 29 tests passed: exposed-edge topology and actual expansion transition, existing land rules and world placement/camera behavior.
- Actual App/WorldMap with isolated local API fixtures: inspected home, expansion preview, confirmation, successful purchase and return home. The authoritative expansion function changed the fixture from144 to164 open cells; the new plot immediately rendered as bright owned land, with the shared old boundary removed.
- Drag/zoom remained usable; no browser console errors or warnings.
- Evidence: `output/verification/garden-land-v123/home-land.png`, `expansion-before.png`, `expansion-after.png`, `home-expanded.png` and `expanded-results.txt`.

No production purchase, Worker deployment or native synchronization performed.
