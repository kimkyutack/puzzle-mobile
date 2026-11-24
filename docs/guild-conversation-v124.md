# Guild support feedback and conversation layout

- Heart and item requests render a disabled pending button immediately. A synchronous guard blocks repeated submissions per account, guild and request category. Other tabs remain usable while the API request runs.
- Accepted requests show the cooldown immediately and refresh guild data in the background. A failed background read cannot undo acceptance. A rejected request restores its buttons; refreshed authoritative timestamps replace temporary presentation state.
- The chat tab uses a compact guild identity strip. Introduction, member count and notice open in the existing dialog design; the other guild tabs retain their illustrated layout.
- The message list fills the remaining viewport above a fixed composer. Garden invitations use compact inline cards. Reporting and blocking remain available through each message's more menu.
- Initial and followed conversations scroll to the latest message. Reading older messages preserves the scroll position; a separate new-message row returns to the bottom without covering messages.

## Validation

- Actual App in an isolated browser fixture: 32 checks at 320×568, 390×844 and 430×932, plus English and Japanese at 320×640. Deliberately held/rejected API responses verify immediate feedback, continued tab navigation, polling races, retry and accepted requests whose background refresh fails.
- Checked chat send, initial scroll, unread navigation, inline invitation bounds, introduction dialog, visible composer and no horizontal overflow. No runtime page errors.
- Conversation list height: 158px at 320×568 and 431px at 390×844; the former fixed maximum was 216px and the surrounding introduction forced outer scrolling.
- Typecheck, client build and 69 focused tests passed. Browser artifacts and the isolated API fixture are local under `output/verification/guild-conversation-v124/` and excluded from Git.
- This changes client presentation and scheduling only. Production network latency and native keyboard behavior were not measured in this browser fixture.
