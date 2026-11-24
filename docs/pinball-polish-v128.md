# Pinball motion, reward markers and compact labels

- Replaced restoration-star target markers with the existing coin artwork. Pocket values explicitly say points; the guide distinguishes +50/+5 points from the separate stage coin reward. Server reward amounts and certified physics remain unchanged.
- Replaced React state updates on every flight frame with a Web Animations transform track containing every certified physics sample. A lightweight animation-frame callback updates peg contact indicators and commits the shot once. Resize updates keyframes without restarting the flight; unmount/reset cancels playback and its callback.
- Guide navigation uses equal-width, equal-height 46px buttons. The former blue secondary-button minimum was 54px while the green action remained 46px. Small-screen guide pictures and headings fit without an isolated trailing character.
- Reduced the home utility separator to 4px and gave the weekly event a wider final column. The Korean pinball label stays on one line with unchanged text size; other locales retain wrapping.

## Validation

- Typecheck and client build passed; 34 focused tests passed, including legacy/current pinball physics and render-coordinate preservation across sizes.
- 23 browser checks cover coin artwork, point labels, matching navigation sizes in Korean/English/Japanese, home labels at 320/390px, real flight/scoring, reset and runtime errors. One flight produced 216 frame samples, 198 distinct positions and one inline style write; movement was driven by a compositor animation rather than per-frame React positioning.
- Three additional checks cover resize alignment, cancellation without a late score, and small-screen illustration/title alignment.
- Local artifacts: `output/verification/pinball-v128/`. Synthetic API fixtures were used; no native-device performance or production reward transaction was measured.
