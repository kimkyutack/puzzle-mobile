# Event design assets, v62

Selected visual truth: the user's `ChatGPT 이미지 2026년 11월 20일 오후 12_59_35.png` for the three standalone weekly games. The remaining event contents follow the final restrained v3 concept sheets from the same side conversation. Existing event header, horizontal tabs, bottom navigation, game rules, purchases and reward amounts remain live application data.

Production assets were created with the built-in image generation tool, then encoded to WebP using Sharp. Original generation files remain preserved at the source paths in the JSON manifests. `prompts.json` contains the main production prompt set; `detail-assets.json` and `hourglass-source.json` identify supporting assets.

- `rescue-scene.webp`: forest/map, empty title, quota, two reward rows and green CTA base. Animal, current stages, title, rewards and button are live elements.
- `pinball-scene.webp`: red fairground cabinet, blank board, five empty pocket faces, ticket/reward surfaces and red CTA base. The five pockets match the existing physics, despite the four pockets in the initial mockup. Pins and the flying acorn use the same display projection without changing simulation or replay coordinates.
- `water-scene.webp`: greenhouse, title/stat plaques, empty workbench and five milestone pedestals, cyan CTA base. The interactive board retains its actual three flower targets; the five lower pots represent stage milestones.
- `gold-peg.webp`, `home-back.webp`: standalone pinball peg and home/back button base. Back button label remains live.
- `picnic.webp`, `flowerbed.webp`, `season-islands.webp`, `workshop.webp`: restrained, event-specific content artwork.
- `pass-book.webp`: transparent blank open-book frame. Five rows of actual free/premium rewards and claim states are rendered above it.
- `hourglass.webp`: restrained transparent hourglass used only in the unlimited-tools content area; the existing tab icon is retained.

Mockup quantities are intentionally not copied into the application. No production data, purchase or payment was exercised by the local visual harness.

## Attendance correction v63

`attendance-calendar-v63.webp` is the selected calendar paper, envelopes and reward/button backplate with all editable foregrounds removed. `attendance-check-v63.webp` is its transparent claim checkmark. Prompts and preserved originals: `attendance-v63-prompts.json`. All coins still use the existing application `Icon` with id `coin`; the existing hammer is reused. Dates, quantities, checks, current-day outline and claim action remain live UI.

## Flowerlight correction v64

`flowerlight-scene-v64.webp` preserves the selected flowerbed scene with a blank petal plaque, three reward cards and button. The static petal illustration remains in the artwork; progress text, actual next three milestones, garden decorations, existing coins/tools, quantities, claim marks and actions are live UI. Prompts/original: `flowerlight-v64-prompts.json`. The subsequent shared full-bleed layout fills the available space between the original event tabs and bottom dock, following the user's 14:46 screenshots.

## Season and tools correction v65

`season-scene-v65.webp` and `tools-scene-v65.webp` are blank live-data backplates derived from the selected restrained v3 sheet. `meter-gold-v65.webp` provides the gold progress fill. Prompts and preserved generation paths: `season-tools-v65-prompts.json` (built-in image_gen). The existing game coin, tool identities/names, targets and actual rewards remain authoritative. Personal/guild claim actions and the power-festival provider request handling are preserved. Both tab contents fill the area between the existing tabs and dock.

## Source-faithful reward correction v66

The user's 15:32 detail screenshots supersede v65's reward-display deviations. `lock-v66.webp`, `leaf-v66.webp`, and `meter-v66.webp` are the transparent silver cabinet lock, paired season leaves, and dark green season gauge fill. Built-in image_gen prompts and preserved originals: `season-tools-v66-prompts.json`. Coin, rocket, hammer, restoration star and rainbow icons remain existing game assets. Shared season and festival reward definitions now also drive the authoritative grants; the artwork never supplies reward amounts.

## Title and background-button removal v70

`tools-scene-v70.webp` removes both the blue title plaque and the painted bottom green button. The real shared game Button remains a separate DOM/raster control for starting/claiming/navigating. `season-scene-v70.webp` removes the flowered title plaque and bottom green button; the season scene has no bottom play control. Existing event-page header/tabs/dock are retained. Built-in image_gen edit prompts/originals: `header-removal-v70-prompts.json` and `tools-buttonless-v70-followup.json`. Original v65 assets are preserved.


## v73 menu-specific headers

`event-header-{attendance,flowerlight,treasure,tools,season,rewards}-v73.webp` are six1024×512 background-only headers matched to each current event body. `event-headers-v73-prompts.json` records the built-in image_gen prompts, per-body references, preserved originals and encoding. Title/tab controls remain live. `EventHeaderBackdrop.tsx` selects via the actually rendered event panel and preloads all six; the old common bunting/string-light background is no longer used by HubPage events. Existing standalone weekly-event pages and the home Unlimited modal are outside this change.
