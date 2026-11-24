# Event design v62 — selected image implementation

final result: blocked

Implementation and focused functional checks are complete. The blocking gate is the **fresh visual recapture after the last small CSS/pipe-texture corrections**. Earlier browser captures and interactions are available; they must not be presented as verification of every final pixel.

## Reference and scope

- Weekly target: the user's attached `ChatGPT 이미지 2026년 11월 20일 오후 12_59_35.png`, three 512×1024 panels. A previously captured normalized reference is preserved as `output/playwright/event-design-v62/selected-reference-normalized.jpg`; the original Downloads file is no longer available at its supplied path.
- Remaining contents: final restrained v3 sheets in the side-conversation visualization folder, covering attendance, flower festival, treasure cards, tool festival, season, unlimited tools, event gifts and garden pass.
- Preserve original events header, horizontal icon tabs and bottom dock. Weekly games use their selected standalone forest, fairground and greenhouse layouts.
- Source changes are local. No deployment, native sync, production player mutation or payment verification was performed.

## Same-size comparison

The three weekly reference panels were normalized to 390×780 each. `weekly-comparison-current-evidence.jpg` combines that reference on the top row with the last available 390×780 browser captures on the bottom row. The final pipe-padding correction, water progress-label adjustment and home-background specificity were built after those captures; a new capture is required to close the gate.

### Fidelity surfaces

| Surface | Inspected result |
| --- | --- |
| Layout and hierarchy | Full-screen 1:2 weekly stage; rescue quota/trail/reward rows/green CTA; pinball machine/pockets/ticket/reward/red CTA; water stats/5×5 board/reward shelf/cyan CTA. Original events header/tabs/dock retained. |
| Typography and text | Existing game font retained; titles centered on blank raster plaques; live counters and quantities. Corrected raw interpolation, title overlaps and footer/CTA overlaps in prior iterations. |
| Color and artwork | Forest/parchment, red/gold cabinet and aqua/brass greenhouse use generated raster artwork. Close button, back button, pins and water textures are real assets. |
| Spacing and responsiveness | 390×780 full-page review, 320×694 pass and 430×932 rescue checks; no horizontal overflow in tested views. Primary event CTAs remain above the dock. Small helper text can scroll in compact views. |
| Behavior and state | Home/close, starts, pinball launch, water rotation, attendance claim, card start and pass pagination were exercised with isolated synthetic fixtures. Live application handlers and existing rules/rewards retained. |

## Intentional live-data differences

- Mockup reward numbers are illustrative; existing actual rewards remain authoritative.
- Pinball retains five physics pockets. The target pocket shows the existing restoration reward; unused pockets do not invent new payouts.
- Water retains three actual flower targets, actual puzzle topology and remaining moves. The five lower pots represent stage milestones 1/3/5/7/10 rather than changing the gameplay target to five.
- Rescue displays the configured animal and actual stage/final rewards. Existing animal artwork differs from the illustrative upright panda in the source.
- Editable UI labels use the existing game fonts rather than baked lettering.

## Iterations and evidence

Corrected title/art collision, quota interpolation, CTA/footer overlap, oversized legacy prize blocks, close-button padding, undersized gold pins and water art width. Final tube arm/joint assets were trimmed consistently; simulation/replay coordinates were not changed.

- `weekly-metrics.json`: all three weekly events available in the isolated fixture; no broken displayed images or raw placeholders at that checkpoint.
- `tab-metrics.json`: all seven event tabs, primary CTA positions and scroll sizes. Primary buttons at or above y=690, dock begins y=704 in 390×780 review.
- Pinball: start revealed seven launch controls; a side launch consumed a ball (3→2).
- Water: a pipe rotation changed remaining turns 12→11 and watered targets 0/3→2/3; seven wet cells visible in `water-flow-390.jpg`.
- Attendance: claim changed to today's completed state. Treasure: start showed twelve interactive cards. Pass: paging displayed tier six; purchase CTA remained in view at 320px.
- Fresh fixture console check before the browser connection failure had no new errors/warnings. Historical development HMR warnings were fixed; no claim is made about the entire historic console log.

## Automated validation

- Client build and TypeScript validation passed.
- Focused Vitest: five files, 53 tests passed (`client-event-tabs`, `content-events`, `client-event-discovery`, `client-pass-rewards`, `acorn-pinball`).
- `git diff --check` passed.
- Logs and screenshots: `output/playwright/event-design-v62/`.

## Remaining gate

The selected Chrome tab stopped responding to browser automation during final recapture. A native Chrome-app binding was rejected by automatic approval review because it could expose unrelated signed-in/private tabs; that fallback was not bypassed. No approval is requested for this optional broad access. A new capture of only the local preview tab is needed to verify the last small rendering changes and change this report to passed.

The production CSS review fixture maps built `/assets/` URLs to the built files under Vite's `/@fs/` path solely for local review. Production asset paths are unchanged. Preview fixture APIs are isolated synthetic mocks, not backend proof.
