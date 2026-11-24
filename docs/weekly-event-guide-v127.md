# Weekly event guides and visible pinball controls

- Each weekly event opens a three-page illustrated guide on its first visit. Dismissals are saved per account and event on the device; unavailable storage falls back to the current session. The blue info icon always reopens the guide, including when the event has ended.
- The middle page is interactive practice. Pinball and water use the same components, artwork and replay functions as the weekly game. Animal rescue uses a real `CascadeBoard` and legal actions on an authored expedition board. Practice never sends an account mutation or grants rewards.
- Pinball explains the daily free attempt, one ticket per newly rewarded puzzle clear, configured storage cap, seven firing positions, scoring and the starred-pocket win condition. Water explains clockwise rotation and watering all three pots within the move budget. Rescue explains its configured daily attempts, free continuation and the ten-course animal reward.
- Live pinball launch buttons now show numbers 1–7; the score has an opaque, larger panel. The instruction points to the numbered row. The tiny bottom instruction was replaced by the reusable guide.
- Guides reuse the standard modal frame and close button. Footer navigation remains outside the scrollable content. English and Japanese copy is included.

## Validation

- Typecheck and client build passed; 75 focused tests passed, including acknowledgement persistence, account/event isolation and blocked storage.
- 60 browser checks cover first entry, dismissal, reload, info reopening, actual pinball flight/scoring, water rotation, a legal rescue move, no practice account mutations, active attempt preservation and English/Japanese at mobile sizes.
- Four additional checks confirm readable, updating water counters at 320×568, 390×844 and English/Japanese 320×640.
- The actual client was exercised with isolated synthetic API responses. No production rewards, live purchases or native build was involved. Artifacts remain local under `output/verification/weekly-event-guide-v127/`.
