# Varied garden obstacle release

Engine 1.30.0; retained engines including 1.29.0 continue publishing their original definitions and replaying their original rules. No production deployment or native packaging is part of this change.

## First introductions

| Level | Family | Behavior |
| --- | --- | --- |
| 101 | Flower tea caddy | Several ordinary hits progressively open and crack it. |
| 201 | Golden honeycomb | Capped wax changes to exposed honey and a broken rim. |
| 301 | Acorn nest | Destroying it releases a usable beehive power-up. |
| 401 | Starcloud cushion | Destroying it releases a usable dragonfly power-up. |
| 501 | Petal launcher and sun gate | Every launcher hit sends one disc to its linked remote gate. Only deliveries damage the gate. |
| 601 | Bouncy mushroom cluster | Breaking it hits the eight surrounding cells. A pulse does not recursively launch more pulses. |
| 701 | Star crystal geode | The outer stone reveals an independently breakable star crystal. |

All attacking families accept ordinary adjacent matches of three or more and attack items, without four-match, color-sequence, or cascade-only requirements. The gate uses the explicitly taught remote-delivery rule. The geode previews its contained crystal on the board.

The seven primary families rotate in runs of two or three after introduction. Counts rise from 15 to 27 ordinary blockers across density tiers; layers rise to three, and remote gates to six deliveries. Only the first introduction is lighter. Existing routes, frost puzzles, campaign chapter mechanics, preplaced-item chain boards and split windmill boards remain in the rotation. 15,927 final published boards use this new catalogue; the remainder retain their distinct existing mechanics.

## Artwork

Nine original obstacle identities, three separately authored damage states each, plus a separate flower-disc projectile: 28 runtime WebP images. Sources and the exact family prompts are in this folder. Runtime frames are 256px with genuine alpha and fit approximately 99 percent of a board cell. New obstacles show damage through art instead of numeric health labels. The gate occupies an authored 2x2 footprint; it is not an enlarged box.

## Validation

- The final publisher, not only raw content definitions, was checked through level 20,000: no validation failures or initial tile cells without a refill route.
- All 100 reachable density/layout/intro profile proofs replayed to victory with ordinary gameplay actions. This is automated solvability evidence, not a measured human win rate.
- The mobile browser rendered actual new textures instead of crate fallbacks. A physical tile swap activated a petal delivery. During flight the visual gate retained its old state; after arrival it updated its damage frame.
- A clean production client build and Worker dry run passed. No deployment was performed.

## Research references

[Royal Match official game elements](https://dreamgames.helpshift.com/hc/en/3-royal-match/section/56-game-elements-1732263700/) describes layered obstacles, revealed contents and break reactions. [Original level 36–41 gameplay](https://www.youtube.com/watch?v=0-f9Ynb-el8) was visually checked for packed obstacle banks and successive removals. The precise plate-to-door clip mentioned by the user was not positively identified. The petal-disc delivery is an original implementation of that requested interaction, not a claim that the inspected video contains it.
