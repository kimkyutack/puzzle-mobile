# Friends sky artwork

Selected visual: `output/design/friends-concepts-v101/concept-1.png` (first displayed image). User requested removal of the header level. All artwork was generated with built-in `image_gen`; original PNGs and exact prompts are retained in `source/`.

| Runtime file | Use | Size |
| --- | --- | --- |
| background.webp | Opaque sky/garden page backdrop | 780 × 1690 |
| header-clean.webp | Transparent red panda / blank blue-gold title plaque | 1122 × 400 |
| panel.webp | Filled pale-blue nine-slice list panel | 512 × 512 |
| heading.webp | Blank blue section label with left flower | 880 × 174 |
| row.webp | Subtle icy-blue friend row surface | 1074 × 202 |

The original header variant is preserved as `header.webp`; the cleaned variant is used by the app. No UI text or levels are baked into the assets. Titles, counts, names and actions are real accessible DOM. Footer and avatars use existing app art; green/blue actions use existing shared button assets.

Panel/row slicing: 64 source pixels per side. Heading slicing: top40/right70/bottom35/left190. Panel, heading and row exports use `sharp(original).trim({threshold:16}).resize({width}).webp({quality:95,alphaQuality:100})`. Header and background preserve the full composition and aspect ratio. CSS/Vite imports package the used assets with the existing web/native app.
