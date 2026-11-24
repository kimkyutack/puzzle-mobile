# Home source refinement v80

These are UI assets extracted from the approved home reference, not new obstacle or power artwork. The tracked input is `packages/garden-world/art/home-v78/source/selected-original.png`.

Rebuild with `node tools/asset-pipeline/home-fidelity-surfaces-v80.mjs`. `extraction.json` records the normalized source coordinates and treatment. Original crops are in `source/`; lossless WebP files are in `runtime/`.

The source outlines of the gift, festival and selected-home faces are retained. Editable foreground is removed using clean source material columns or row interpolation. The festival/gift icons are matted separately so they do not include nearby frame/text pixels. The ivory textures sample empty source edges. Button faces reuse the previous foreground removal, with soft shadows separated from the original backdrop.

These assets only affect the home presentation. Actual item art, quantities, balances and event rules remain owned by their existing models. See `docs/design-qa-home-fidelity-v80.md` and `output/verification/home-fidelity-v80/` for comparisons and verification limits.
