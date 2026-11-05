# Cloud Garden Match engine 1.0.0

2026-11-03: 새 판은 엔진1.1과 흐름 개선 콘텐츠를 사용하며 진행 중인1.0 판을 계속 지원합니다. 새 맵·섞기·구름길 구조대 계약과 검증 범위는 [flow-rescue-v1.md](flow-rescue-v1.md)를 참고하세요.

The pure TypeScript implementation in `packages/game-core` is shared by the browser and Workers. It has no clock, renderer, network, inventory balance, or ambient random source. `createGame`, `applyAction`, `legalActions`, `replay`, and `stateHash` are the public interface. A returned `accepted: false` leaves the original state unchanged; a safety-limit error produces `status: error` and cannot be settled as a win. The server alone authorizes inventory and additional moves.

## Coordinates, board and supply

Cells use row-major index `y * width + x`. A missing cell, occupied obstacle, fixed frost floor, normal/special tile, and falling seed are separate fields. Gravity is an explicit set of disjoint ordered lanes, each top to bottom from a declared inlet. Default generation splits a column at every missing cell, making the next connected segment a separate supplied zone. Lanes may encode non-geometric connections; the published pool does not enable portal/moving-lane features. The validator requires every existing cell exactly once and prohibits duplicate/cyclic paths. An exit must be a lane endpoint.

Crates, pots, moss and cabinets block falling. A vine holds its tile in place. Falling compacts each unblocked lane segment from the bottom up; only a segment connected to its lane inlet creates new tiles. Empty cells beneath an intact blocker do not receive invented bypass tiles. New draws use xorshift32 and the level's fixed color list. Seeds fall and are collected at declared exits; attacks do not erase them. Exiting seeds trigger another compact pass before refill.

## Actions and sequence

An ordinary orthogonally adjacent swap must produce a match involving one of its two cells. Row wrapping, diagonals, offboard targets, seeds, and locked cells cannot be swapped. An adjacent special/normal swap always works and activates at the special's arrival position. Taps activate unlocked special blocks. These actions consume exactly one move. Swap of two specials consumes one move for the entire combination.

The engine settles the full effect queue, gravity and cascades; then it checks victory even if zero moves remain. If unfinished, one move-consuming action can trigger one moss-spread phase. Finally it checks victory/loss and legal moves. Inventory boosters and automatic shuffles do not advance the turn or spread moss. Continuation accepts exactly +5 only on a settled `lost` state; the server applies the per-run limits and price. The client must gate animation input, while server sequence/idempotency checks reject duplicate actions independently.

## Matching and creation

Horizontal and vertical maximal runs of 3+ normal tiles and same-color 2×2 squares are recognized. Intersecting patterns of the same color merge into one group. Independent groups resolve in ascending minimum-cell order. Creation priority is straight 5+ (rainbow), intersecting horizontal/vertical L/T 5+ (bomb), 2×2 (glider), straight 4 (row/column wind). A horizontal run creates row wind; vertical creates column wind.

Creation location is the swap destination if included, then source if included, then the group's smallest cell index. A creation anchor still occupied by an obstacle does not create a special until freed. Every creation anchor in a simultaneous match phase is protected against all removal effects in that phase. After those effects settle, its normal tile is converted and its color/frost is counted once. The new special can be triggered by a later cascade, never deleted by the match that created it. Regression tests cover this collision rule.

## Special effects and combinations

Effects run FIFO. Every effect gets a monotonically increasing ID; its affected cells are deduplicated and sorted. A tile ID can activate only once in a turn's effect queue. Every obstacle instance receives at most one hit per effect regardless of footprint size. Separate effects may hit another layer.

| Special | Effect |
|---|---|
| Row/column wind | All existing cells in its row/column |
| Flower bomb | Chebyshev radius 2, clipped to the board |
| Seed glider | Origin plus orthogonal neighbors, then one target as a separate impact |
| Rainbow lantern | Selected swap color; on tap, most frequent ordinary color, ties by `COLORS` order |

Glider targets prefer active goal obstacles (higher remaining HP first), then frost goals, then goal-color ordinary tiles, then other obstacles, then specials, then other ordinary tiles. Ties use row-major index. Falling seeds and color-charge obstacles immune to an uncolored glider hit are never chosen for removal. Three gliders prefer distinct targets, then reuse the first deterministic available target when fewer than three exist.

| Combination | Effect |
|---|---|
| Wind + wind | Destination row and column as one cross |
| Wind + bomb | Destination-centered three rows and three columns, deduplicated |
| Bomb + bomb | Chebyshev radius 4 |
| Glider + glider | Origin cross and three deterministic goal impacts |
| Glider + wind/bomb | Origin cross; payload activates at selected target |
| Rainbow + wind/bomb/glider | Most frequent normal color is converted, then activated in row-major order |
| Rainbow + rainbow | One effect hits every ordinary tile and at most one removable layer of every obstacle instance. Other specials are preserved, not silently activated. Seeds remain falling objectives. |

## Obstacles

All obstacles stay fixed. Their shared `id`, `anchor` and `footprint` identify one durability and one target count. Hit events carry this footprint and the effect ID, allowing the renderer to change state at the impact frame.

| Kind | Damage and behavior |
|---|---|
| Crate | Adjacent natural match or direct special/inventory hit; 1–3 layers |
| Vine | Its locked tile can match but cannot move or activate. A hit removes one lock layer; the underlying tile survives that hit. |
| Frost | One fixed floor layer is removed when the tile above is removed or converted. |
| Color pot | One charge per natural match of its specified color anywhere on the board; adjacent and global paths deduplicate within the effect. Uncolored hammer/wind damage cannot charge it. The rainbow-pair override removes one layer. |
| Moss | Direct attack or adjacent match clears a patch. If no moss was hit during a move, the first row-major moss patch grows to its first eligible row-major neighbor once. This increases actual moss goal count and remaining count together. |
| Cabinet | Direct/adjacent hits; an optional color condition can restrict charges. At zero HP its shared footprint opens and emits its configured finite seed count at sorted available cells. The published two-cell cabinet emits one seed. |

Hammer on an immune color-charge obstacle, missing/empty cell, or falling seed is rejected without inventory consumption. Row/column sweeps can strike ordinary tiles and trigger specials along their valid cells. Inventory shuffle preserves the exact multiset of movable normal/special tile IDs and fixed seed/obstacle/floor state. It searches at most256 deterministic permutations for no immediate match. Version1.0 keeps its original first permutation with at least one legal action. Version1.1 aims for at least three actions and, only if unavailable within the bound, restores the best playable permutation. Failure returns the original state and must not consume stock. Automatic deadlock shuffle uses the same bounded process, free of move/heart cost. An unrecoverable board becomes an explicit engine error.

## Safety and content approval

A turn is bounded to 128 cascade rounds and 2,048 effects. The engine fails closed when these limits are exceeded. FNV-1a `stateHash` is only a deterministic diagnostic fingerprint, not an anti-cheat proof. Server replay remains mandatory.

`packages/content/src/approved.json` contains 200 fixed definitions, including the first five crafted tutorial patterns. Levels 1–30 are fixed introductory data; they are not regenerated during start requests. Build-time candidate generation changes layouts, color count, obstacle types/layers and objectives in bounded complexity bands. The first four guided moves teach swap, wind, bomb and glider; the fifth teaches rainbow. A candidate is rejected if its guided move makes the wrong special or an initial automatic match.

`tools/level-validation/validate.ts --build` performs candidate generation, static checks, a no-purchase greedy policy, and exact replay. Unsolved candidates remain rejected, not declared impossible. The approved file is written only after all 200 have verified winning logs. `solutions.json` stores the actual logs. The validation-only command replays them and checks versions, initial matches, at least one legal action and hashes. A second policy evaluates all 200 approved seeds. Reports include policy labels and expressly do not claim human win rates.

Beyond 200, an O(1) lookup cycles through the certified 141–200 fallback pool while retaining the new visible level number. No unverified random seed or heavy search is introduced at run start. Levels 201, 1,000 and 10,000 are explicitly replayed. This is an unlimited supply of approved bounded templates, not unlimited new mechanics or artwork. Additional packs can replace future selections after their own versioned validation. There is no purchase-based or loss-based RNG adjustment. Human difficulty/fun testing is still required before a commercial launch.
