# Cloud Garden Match art and delivery

Royal Match screenshots informed hierarchy, board prominence, touch targets and the distinction between a garden home and a puzzle screen. Its characters, tiles, logos, level layouts and audio were not extracted. This project uses the original Lumi red-panda gardener, enamel garden tiles, blue/gold chrome, pearl resource plates, lime/blue/amber molded buttons, mixed-color popup materials and floating gardens. The name is a development title.

## Source and reproducible pipeline

- `packages/assets/source/`: individually generated raster originals and style references, including historical sources retained for reproducibility. The current integrated runtime has122 distinct raster paths; an AI grid was not sliced into assets. See `prompts-ui-v9.json` for the latest21 originals.
- `packages/assets/prompts-ui-v2.json`: exact prompts and original generation paths for the 20 new UI/VFX assets.
- `packages/assets/prompts.json`: records for the original source set. 71 records preserve exact generation prompts. The initial style sheet, Lumi and six tile prompts are explicitly marked as reconstructed reproduction prompts rather than an exact transcript.
- `packages/assets/asset-manifest.json`:162 runtime entries, including restored-prop and semantic-material aliases, with source references, SHA-256 hashes, pixel dimensions, pivots, nine-slice insets and safe areas.
- `apps/client/public/assets/`: optimized PNGs, three deterministic atlases (at most 2048×2048), atlas JSON and 140 animation frames in 17 sequences. Runtime text is never baked into the game art.

Run `npm run assets` after changing a source. The Sharp pipeline trims transparent margins, preserves aspect ratio, normalizes padded canvases, verifies true alpha, hashes output, packs atlases with padding and edge extrusion, and removes its own obsolete generated output. Source files remain intact. Backgrounds use cover crop to 1080×2340; tiles and icons use 256px canvases; UI buttons/bubbles768×256; panel sizes follow the manifest(v9 panels640×800); Lumi variants512px. Native icons and launch art are derived by `node tools/native-assets.mjs`.

The source art for six props has before/after variants. Each of three areas places the six objects separately from the environment and switches their images only after a successful server restoration. The six aliases refer to actual repaired images. The background is scenery, not a complete clickable UI screenshot.

## Rendering and animation

React supplies real labels, inputs, accessible controls and layout. `ArtSurface.tsx` uses Pixi `NineSliceSprite` for actual raster panels and raster button images. Original button variants have normal/pressed/disabled assets; new sculpted buttons reuse their painted depth with position/scale press feedback and alpha for disabled state. Backgrounds use uniform cover scale; art never uses independently stretched X/Y proportions. A plain white texture is used only for rectangular clipping, not for visible game art.

`Board.tsx` renders image floors, shape-specific tiles, multi-cell obstacle instances, frost/vine overlays, a raster halo and an animated hand. It reuses tile sprites. `board-effects.ts` maintains a bounded pool of 180 image `AnimatedSprite` particles. It consumes engine events and never changes puzzle state or the puzzle RNG. Color-matched fragments, pollen, a wind trail, a glider and rainbow particles are all authored PNGs.

Animation metadata covers 8-frame tile pops, 8-frame wind launch/6-frame impact, a 12-frame bomb opening, glider launch/flight/impact (6/8/8), 12-frame rainbow charge and obstacle hit/break (6/10). Authored open/flight keyframes are combined with uniform scale/alpha interpolation; these are not 140 independently redrawn poses. Paths, rotation, travel, fade and confetti motion are calculated in code. Reduced-motion mode uses brief, limited image feedback. Input locks also account for the visual duration. The first tutorial highlights two cells and moves a real hand image between them. New obstacles and special pieces receive a short explanation before input resumes. Discovery and result dialogs wait for the current visual sequence; their transparent canvases and a 66% compositing scrim retain the live scene behind them.

`tools/asset-pipeline/audio.py` creates ten original additive-synthesis sound effects and an original 34-second garden loop. No external recordings or original-game sound samples are used. `sound.ts` limits simultaneous effects to three, follows music/sound/haptic preferences and pauses for app background/advertisement lifecycle events.

## Integrity, cache and memory

Every required image and sequence frame is fetched and SHA-256 checked before a guest run can start. Only a fully verified manifest becomes the cache fallback. A manifest outage can use that verified pack; a corrupt image stops loading before the first heart is spent. A running app keeps its chosen pack. Native builds contain these resources, with optional `VITE_ASSET_ORIGIN`/`VITE_ASSET_VERSION` for an immutable custom-domain R2 pack.

The current optimized PNG runtime set is 58.18 MiB compressed and 131.76 MiB in raw RGBA pixels; the 140 animation frames add 19.69 MiB decoded. These figures do not represent measured GPU or total process memory. Atlases are provided for packaging; the current renderer uses manifest-backed individual textures, which Pixi uploads when used. Background texture ownership is counted across scene/popup renderers and its GPU data is unloaded after the last owner leaves. Renderer teardown frees only its own context resources. Shared Pixi global pools remain alive while other scene/board/popup canvases are mounted. Scroll masks belong only to a popup with actual scroll-frame children; scene canvases never attach an empty mask (older Android WebView scissor compatibility). The loader verifies the whole initial pack and keeps decoded sources for this small three-area build; area-pack streaming is not implemented. Real-device GPU memory, thermal load, frame pacing and 60fps must be measured before release.

## Visual and automated review

`output/verification/asset-report.json` records each PNG's actual dimensions, alpha, byte size and decoded estimate. `asset-contact-sheet.png` shows runtime files in the report's `contactOrder`. Review found and replaced an inconsistent glider frame. It also corrected the speech-bubble aspect ratio and empty-image URLs.

`tools/browser-gameplay.ts` captures home/start/play/win/failure/hearts/guild/shop at 360×800, 390×844, 430×932 and 768×1024, plus actual special-effect frames. `browser-community.ts` captures active two-account guild and reward flows. Image decoding, empty URLs and horizontal overflow are checked. Raster corners and typography were visually inspected. Supplied reference screenshots are not included in shipped art.

Google/Apple identity buttons are the exception to original game artwork: official provider resources and source links are in `apps/client/public/provider-assets/SOURCES.md` and are not repainted as game buttons.

## Visual feedback revision · 2026-11-02

The v2 pack (`garden-2026.11.02-visual-v2`) adds a cobalt HUD/dock, distinct coral move counter, gold/purple wallets, circular booster sockets and red count badges, green/blue/gold deep buttons, a purple popup and coral ribbon, blue board cells/thin gold frame, and five impact/beam/smoke/light sprites. These are 20 individual generated source PNGs, not crops from Royal Match. The footer paints through the bottom safe area while its controls keep safe padding.

Korean labels use local Jua; counters use local Lilita One, including Pixi obstacle HP. Font files and OFL/source metadata are in `apps/client/public/fonts`. Both are decoded before the first board. Pointer preview follows the dominant axis, moves the neighbor in the opposite direction, returns elastically when cancelled, and performs a 120ms visual exchange before one engine action. Successful action feedback is bounded at 1.6s with a 1.7s parent guard; invalid input returns promptly. VFX reuse up to 180 sprites with no puzzle RNG or economy changes.

Older Android Chromium WebViews (<140) use `RasterSurface.ts` for UI/backgrounds: the same hashed PNGs are composited as images and CSS `border-image` nine-slices, with native DOM overflow clipping. The transparent borders supply slice geometry, not painted artwork. The board and its VFX remain Pixi. This isolates a verified legacy WebView framebuffer failure affecting stacked UI WebGL canvases; forcing WebGL 1 did not resolve it. iOS/current Chrome retain Pixi UI compositing. The compatibility path passed the same eight layout cases, pixel-alpha overlay comparison and six popup/scene cycles (`visual-v2/legacy-android/browser-layout.json`).

## UI containment and color revision · visual-v3

The accepted direction keeps the original lively environment and bright green/blue/gold buttons. The user clarified that glare came from broad cream popup interiors, not saturation of the whole game. Muted gray/wood and dimmed-background drafts are preserved as drafts and excluded from the runtime pack.

Five active v3 PNGs provide emerald/leaf-green garden, cobalt/sky-blue guild and utility panels, purple/indigo pass, orange/apricot shop, and a compact royal-blue/gold dock. Results use a colored interior too. `prompts-ui-v3-color-correction.json` records the source/edit provenance; the original shape drafts remain in `drafts-muted-v3`. There are 109 manifest entries (103 sources and six aliases), three atlases and the same17 sequences/140 frames.

`frame-layout.ts` chooses edge scale from button height, and source insets now separate the upper rim from the lower extrusion. Compact actions have a real center face; labels are not laid over a zero-height stretched center. `Row` separates title/metadata/actions, pass rewards sit outside claim buttons, and popup scroll viewports end above the authored lower rim. Home/tool dock base heights are64/80px plus native safe area. Loading no longer includes an English eyebrow. Broad cream backgrounds are replaced by distinct colored interiors, while vivid icon and button colors remain.

`tools/browser-ui-v3.ts` uses real local accounts and approved level clears, and checks each DOM text line (including line height/shadow) against button bounds and actual nine-slice source alpha. It covers home, play, pass30 tiers, guild11 members, public guild results including24-character names, and garden18 tasks, at360/390/430px with zero or59/34px insets. Intentional scroll-edge clipping is distinguished from text escaping a control. Oversized-label negative controls ensure the detector catches failures.

## Readability, grouping and motion revision · visual-v4

The lively v3 palette remains. `Card`/`Row` now give each related reward, balance, form, setting, and action group a real raster inset. Nested setting rows share their card; independent shop/garden/guild rows have their own inset. The blue/green/apricot card sources and exact prompts are in `prompts-ui-v4.json`. The v4 manifest contains112 entries, including six restoration aliases;17 sequences/140 frames are unchanged.

Bright green/gold/blue button faces use dark ink rather than weak white text. Disabled text stays fully opaque and the actual frame alone uses0.88alpha. Headers have a real dark text outline, shop uses darker brown ink, and text over scenery has a dark raster plate. Reward cards use headerless insets, stage numbers have their own plate, booster/emblem choices keep labels and selection inside the face, and results use the integrated header instead of stacking a thin ribbon. Tool targeting is shown in the existing stage plate with cancel in the HUD, so it cannot overlap the footer or resize the board.

App input now waits for Board's actual `onVisualSettled`, with no fixed1.7s wait. Board owns its animation lock, and the synchronous root barrier prevents a stale React state from rejecting the next action. Result/discovery dialogs and victory audio wait for the barrier. Normal moves settle around0.55–0.75s including the swap, while the tested bomb/wind/glider chain lasts~2.75s. Specials have preparation, travel and impact; corner hammer approaches stay within the board. Obstacle/frost art and one primary impact sound/haptic callback change at impact rather than when the final logical state first arrives.

The refill helper distinguishes supply tiles from newly formed specials/seeds. Normal newcomers enter before their actual gravity inlet, including internal lanes; formations start at their recorded birth, and explicit reshuffle destinations are not mistaken for gravity. All3,466 certified actions and25,653 surviving newborns were checked, including1,398 special/seed births. The engine RNG/state/events are unchanged. Actual pointer, resource/hash, impact and refill videos/reports are under `motion-video`, `impact-overlays` and `refill-origins` in the verification output.

Readability QA uses paired visible/text-hidden screenshots and computed ink/opacity to measure contrast on actual raster pixels, not a nominal flat CSS background. The initial full audit exposed previously missed booster, header, picker and pass overlap cases; corrected states are rerun with every long-page scroll interval covered. Native vibration and physical-device performance are not established by browser callback measurements.

The final native check exposed another Chromium113 difference: `CSS.supports('paint-order','stroke fill')` returns true, but HTML stroke still covers Jua glyph fills. The existing older-Android compatibility branch sets `legacy-text` and uses outside text-shadow outlines for headings, HUD and counters. Modern Chrome and iOS keep their audited stroke rendering. This is a text treatment only; all game frames and artwork remain authored rasters.

## Poster-led menus and direct garden restoration · visual-v5

Four opaque 960×720 poster paintings carry the hearts, gift, victory and continue stories. Lumi remains the original mascot. The original PNGs, exact prompts, references, built-in generation method and final saved paths are recorded in `packages/assets/prompts-ui-v5.json`. Posters are not nine-sliced or generated grids. The shop displays large tools with icon prices; all prices use coin/star rasters and numbers. Main actions remain prominent while advanced settings and unavailable rewards use disclosure/status treatments. Panels combine blue, green, apricot and purple within a single view.

Panel metadata includes a `titleCenter` measured from the actual title face, independent of the stretched body. Modal headings apply the edge scale and an optical font offset. Poster captions have an overlay-owned ArtSurface; the home dock has its own too. These raster layers prevent DOM artwork from covering a caption or showing through its plate. Legacy Android uses the same PNG nine-slice compatibility renderer for each layer.

`GardenScene.tsx` anchors all18 before/after objects in the actual cover-transformed background. Ground footprints determine sizing. The editor is a scene interaction with one task action at the bottom, instead of18 identical task buttons. A successful authoritative restore holds the old image for construction, reveals the saved after image at650ms, and ends the celebration at2250ms. Server failure leaves the old object/resources; the existing mutation key provides retry safety. Pixel-footprint and real resource/persistence checks are under `native-v5-browser`.

Effects distinguish a hammer's backswing/recoil, leading rake heads and comb trails, spinning wind heads, spiralling flower fragments, and colored lantern orbits/light packets. Authored raster sprites, bounded transforms and a small reduced-motion-aware impact impulse preserve the existing timings and deterministic state. No procedural game art or puzzle RNG changes were introduced.

## Forest teal, coral and seafoam · visual-v6

Ten authored raster assets replace the bright scene/chrome combination: three edited garden backgrounds with their original ground anchors, a quiet play background, a horizontal forest tray, coral and mint buttons, a teal modal panel, a sage inset, and a closed board frame. Exact prompts, references, generation method and final paths are in `packages/assets/prompts-ui-v6.json`. Older sources remain available; runtime aliases select the v6 art instead of loading duplicate old backgrounds. Verified-image preparation shares decoding between aliases of the same hash/path.

The home uses one resource rail, three side shortcuts, a compact garden selector, two main actions and five footer destinations. The large quest gauge is removed. The start preview separates the light goal card, dark tool tray and primary action. Profile identity and settings have distinct routes. Dark surfaces use pale ink; light cards and button faces use dark ink. New modal `titleCenter` is (320,78) in its 640×800 raster, independent of body height. Button text has an optical offset within its painted face.

The main button-label offset is +6px; compact guild tabs use +3px and the icon-over-label offer tabs use −3px. The selected offer tab uses coral to remain distinct from the mint alternatives. Native launch, window and WebView backing colors use `#174c49` so old blue padding does not surround the new palette. `tools/native-assets.mjs` owns regenerated launch backgrounds and the Android icon background color.

Sage-card stretch boundaries must exclude the lower copper rim: top48/bottom60 at 768×272. The footer explicitly uses a flexible grid row so the selected icon cannot push labels into the bottom safe area. Background edits preserve the six original restoration pads and use the same cover-space anchor calculation.

Both compositor paths ignore closed disclosure bodies, even when the browser still reports a positive bounding rectangle for a hidden descendant. Otherwise hidden cards can paint over the next visible instruction. Opening/closing a disclosure invalidates the raster frame layout immediately.

The board clip is derived from the verified frame PNG's enclosed transparent opening and intersected with the actual level cells. Tile, obstacle, drag, pop and refill layers share this geometry with pointer coordinates; special effects remain outside that mask. It changes presentation only, preserving engine hashes, settlement and next-input timing. Pixel comparisons and video are under `output/verification/board-v6/`.

## Shop imagery and persistent hub pages · visual-v7

The footer has four actual destinations: shop, home, guild and events. `HubNavigation` remains mounted while `HubPage` replaces the content, with independent scroll bounds, header and authored background. Hash routes and browser back/forward follow those destinations. Pass/ranking shortcuts belong to Home; profile, settings, pass and individual promotional overlays retain their existing modal contexts.

Four new raster originals were generated with built-in image_gen: `poster_shop_v7` (1440×600 opaque masthead) and three 640×640 transparent product vignettes (`bundle_starter_v7`, `bundle_tools_v7`, `bundle_coins_v7`). Prompts, references, original outputs, method and final project paths are recorded in `packages/assets/prompts-ui-v7.json`. Artwork conveys the bundle identity; actual quantities and purchase status are rendered separately from the live catalog.

Shop uses one wallet in the page header, a shopkeeper sign, a distinct featured package banner, three-column tool/coin shelves and illustrated catalog bundles. Each promotional offer owns its picture, exact icon quantities, deadline and price/status; it no longer relies on one shared giant poster. The local store-unavailable state has one section notice, with no repeated inactive purchase buttons. Purchasing still requires actual platform availability and localized prices.

The ranking podium and oversized own-record panel are removed. Every entry uses the same compact row geometry. Top-three rank plates, emblems, right-aligned scores and a tinted current-player row provide hierarchy. A separate own row appears only when absent from the returned list. Tied ranks retain identical numbers, accessible labels and a single tie explanation, avoiding tiny repeated text on the badge rim. Long names use one-line ellipsis with the full title/accessibility label retained.

## Cloud letters, resident friends and real decoration choices · visual-v8

Nine new originals were made with built-in image_gen: Tori the sparrow courier, Naru the otter repairer, a sealed invitation, three chapter illustrations and festival variants of the bench, planter and lamp. Exact prompts, input reference roles, generation method and final source paths are preserved in `packages/assets/prompts-ui-v8.json`. Chapter posters are opaque1200×900; residents are transparent512×512; the invitation and three matching-footprint decorations are transparent256×256. The manifest has139 entries, including aliases, with118 distinct source rasters, three atlases,17 effect sequences and no missing entries.

The authored story follows the18 existing restoration IDs across Sky Garden, Greenhouse Workshop and Fountain Terrace: one prologue and18 restoration scenes,64 short dialogue beats. The first new clear queues the prologue for the next return home. Successful restoration completes its2250ms world effect before opening its associated scene. Legacy completed tasks unlock replay in the journal without automatic backlog playback or another restoration charge. The journal uses chapter poster art, speaker portraits and contrasting sage dialogue cards; next, skip and close share the same acknowledgement path. Seen acknowledgements have an account-scoped local retry queue and separate server persistence.

Tori appears in the garden after the sky bench, Naru after the sky fountain. Their feet use the same cover transform and depth order as the existing world objects. Restored bench/planter/lamp objects have free natural/festival choices, with actual distinct PNGs in all three areas; the saved style controls both the world image and editor preview. Original anchors, object footprints, restoration prices, Player resources and puzzle engine rules are unchanged. Server-confirmed style writes update the picture; failed writes retain the prior appearance. Story and styles are stored outside the economic Player and ledger. Future post office and other locations remain narrative teasers, rather than extra playable regions in this phase.

World-site prices/completion labels own foreground DOM nine-slices of the authored mint PNG. A single scene-level background compositor can otherwise place the label plate behind its building image. The site label's local stacking context keeps its plate above world art and below its own icon/text without an additional WebGL context per label. Price glyphs use a larger inner face and explicit15px text. Garden-tab counts use the darker card ink; story headings shift4px down within the existing cap so long titles clear its copper rim.

Home side shortcuts own small local raster surfaces at their UI depth, keeping their plates ahead of tall world objects on short screens. Resident poses retain their world anchors on larger screens; on shorter screens their feet stop above the measured main-action row with breathing room. Resize observers track scene, actions and footer geometry, including safe-area changes. The depth order and horizontal world positions stay tied to the authored garden.


## Molded casual-game materials and home palette correction · visual-v9

The visual reference is the user-selected Royal Match home, used for hierarchy, raised silhouettes and separate image-backed resources/actions/navigation. The garden environment, Lumi and story identities remain this project's artwork. No source-game graphics or typography were extracted. The later user correction specifically rejected purple beside the garden: Home's four event plaques now use sky blue/gold, the chapter button amber, and the build progress inset pearl/navy. Modal contexts may still use their independent sapphire/violet/sunset combinations.

Twenty-one original raster assets and exact prompts/reference roles/generation methods/output paths are recorded in `packages/assets/prompts-ui-v9.json`. Built-in image_gen produced each original separately: three buttons, three popup panels, three internal cards, footer, resource plate, two event plates, gear/guild/event icons, board frame, shop illustration and page backdrop. Sources under `packages/assets/source/*_v9.png` are preserved unchanged. The pipeline aliases older semantic IDs to the new materials and excludes duplicate old entries before packing.

`tools/asset-pipeline/alpha-cleanup.ts` removes only tiny detached transparent-source specks during standard runtime normalization; it retains meaningful connected components and their two-pixel antialiased neighborhood. This is technical cleanup of derived images, not creative code-drawn artwork. The v9 report records18 normalization checks, with17 sources having detached pixels removed. Source PNGs remain untouched. The verified runtime contains160 manifest entries,120 distinct PNG paths, three atlases and17 existing effect sequences, with no missing entry. Stable loading-background/track/fill PNGs are derived from the same authored assets before the full pack loads.

Buttons use768×256 canvases with painted gold bevel and lower extrusion. Panels use640×800 canvases with recorded title center(320,90); the top nine-slice excludes the whole170px cap. Ice/lavender/peach cards use768×272. The blue footer uses1024×256, resource plate512×208, event plaques512×192 and board frame512×512. The new board's actual alpha aperture continues to drive the existing clip geometry. Actual images are nine-sliced by the existing Pixi/raster compositor; `FrameFace` supplies a local PNG foreground plate where DOM imagery otherwise occludes labels. CSS supplies layout, text and motion, with no generated shapes, gradients or box shadows as game artwork.

Home uses independent pearl/gold currencies, overlapping resource icons, a separate portrait and gear, lime play, amber decoration and a raised blue selected footer destination. Shop/guild/events/loading use the quiet blue page backdrop; garden/play world backgrounds are retained. Profile/settings/hearts dialogs size to content within viewport limits. Iconless settings rows explicitly keep label and switch columns. Korean Jua and numeric Lilita One remain local licensed fonts; small controls use material-specific dark ink or a measured dark outline. Legacy Android retains external text-shadow strokes rather than the incompatible internal-stroke paint path.

Native window/WebView/launch backing is #1645a0. Regenerate launch derivations with `node tools/native-assets.mjs` before final sync. Full-view and focused reference comparisons are under `output/design-v9/`; browser-rendered evidence and numeric contrast sampling are under `output/verification/visual-v9/`. Test-only renderer fixtures stay under `tools/` and are absent from public build/package inputs.


### Follow-up: meaningful goals and a coherent play scene

The user's10:20 Android screenshot identified a small target count inside an oversized tray and an incompatible blue grid/flat teal background. Single objectives now use a144×84px maximum pearl tray,46px objective icon and36px count. Two objectives use36px icons/29px counts; three to five use32px icons/23px counts in a94px tray, with extra room prioritized over the portrait for dense goals. Completed objectives use readable Korean status at the smaller appropriate size. The cap and icon rows are measured separately to avoid overlap.

Two additional generated raster originals provide the revised play scene: `board_cell_v9` is a single opaque neutral slate-stone face; `bg_play_v9` is a warm sandstone greenhouse terrace with fresh green/yellow/coral edges and a quiet center. The first desaturated gray scene draft is retained under `output/design-v9/drafts/` and excluded from runtime. The final image was edited using built-in image_gen, with the exact prompt, reference and generated/source paths in the shared v9 prompt record. Existing Home backgrounds remain unchanged. The actual level and transient play status use small sky-blue raster plaques, keeping the warm environment readable without floating light text or large purple signage.


### Follow-up: border geometry and raised navigation

Panel slices now preserve128px left/right,178px top and128px bottom; the earlier44px sides cut through painted curves, causing horizontal/vertical stretching of corners. Card slices preserve112px sides/80px top/88px bottom; button slices128px sides/80px top/100px bottom; pearl plates88px sides/64px top/72px bottom. These are metadata corrections to unchanged authored PNGs. Only the center and straight edge sections stretch. Source prompts and hashes remain unchanged.

Selected footer tabs own a local PNG `FrameFace` rather than being painted in the dock's shorter canvas. This allows the raised upper gold edge and all four corners to remain visible. The actual selected tab is still an accessible page-navigation button. The move counter uses explicit14px label/44px numeric rows with42px numerals and fixed inner padding; two-digit values stay within the red face. Pixi and legacy Android share the same corrected source geometry.


The final visual-v9 UI is packaged with the current shared `garden-2026.11.03-story-v10` pack(162entries/122distinct runtime PNGs). Parallel story/flow/localization additions are preserved rather than rolled back to the earlier160-entry candidate. The21 original UI/gameplay assets authored in this revision retain their v9 prompt record. Current visual acceptance is Korean UI; it is not a full multilingual layout certification.


## Shop poster follow-up v11

Four original full-scene PNGs are recorded in `packages/assets/prompts-ui-v11.json`: special-offer1200×600 and starter/tools/pass1200×800 runtime. Generated source bytes are preserved unchanged. Runtime resize retains exact2:1/3:2 aspect ratios; poster rims are not nine-sliced. Live product contents and native store prices remain DOM text, with local raster FrameFace controls over the paintings. Tools all use card_ice_v9 and coins all use card_peach_v9. The current integrated pack is garden-2026.11.03-shop-v11,166entries/3atlases/17sequences/missing0, preserving existing story/flow/localization assets. Details: `docs/shop-poster-v11.md`.
