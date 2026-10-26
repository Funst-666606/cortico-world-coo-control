# Changelog

## 0.1.0

- First release: a Cortico World that hands the desktop pet's default click, petting and idle
  behaviour to a configurable policy.
- Presets `expressive` (stock), `reserved`, `cold`, `custom`; per-action and per-face weights
  0–100; heart particle switch.
- Hot-reload policy through `web/kit/coo-control.json`; no restart after a change.
- AI tools `coo_control_status/get/set/reset/apply/restore`; model edits can be disabled.
- Narrow patch of `web/kit/body.js` and `web/pet-app.js`, with content-addressed backups,
  state hashes, exact restore, and refusal of unknown code.
- Re-applies after a Coopanion update when the target blocks still match; otherwise reports
  `unsupported` and waits for a plugin update.
- Tested against Coopanion 0.2.11 and upstream main `41c4095`.
