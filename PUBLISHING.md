# Publishing Coo Control

**Published:** `cortico-world-coo-control@0.1.0` on npm, 2026-10-27, by **funst**.

- npm: https://www.npmjs.com/package/cortico-world-coo-control
- source: https://github.com/Funst-666606/cortico-world-coo-control
- market sync: https://github.com/Pal-AI-Lab/cortico-extensions/issues/351

`0.0.0-stage` in the registry is npm's normal placeholder for a package first published through staged publishing; `latest` is `0.1.0`. The sync issue above asks the market index to pick it up.

## 1. Publish to npm

From this directory:

```bash
npm login
npm run release
# non-interactive, or if the browser flow is unavailable:
npm run release -- --otp 123456
```

`npm run release` runs `scripts/publish.mjs`. It refuses an already-published version, regenerates `describe.json`, runs the tests, lets npm run its browser 2FA flow (or takes `--otp` / `NPM_OTP`), publishes with `--access public`, and prints the npm page and the market-sync issue URL.

On Windows, **double-clicking `publish.cmd`** opens a terminal and runs the same command; the browser 2FA flow does not need a 6-digit code.

For a dry run:

```bash
node scripts/publish.mjs --dry-run
```

`package.json` already carries:

- `"type": "module"`, `"main": "./src/index.js"`
- `"cortico": { "kind": "world", "api": 6, ... }`
- `"os": ["win32"]`
- `"keywords": ["cortico-world", ...]`
- `describe.json` generated from `src/describe.js`

Before publishing:

```bash
node scripts/write-describe.mjs
node test/policy.test.mjs
node test/patch.test.mjs
node test/engine.test.mjs
node test/world.test.mjs
npm pack --dry-run
```

With a real app install:

```powershell
$env:COOPANION_APP_ROOT='F:\coo\Coopanion\resources\app'
node test/patch.test.mjs
```

The tarball should contain:

```
src/index.js  src/patch.js  src/policy.js  src/config.js  src/describe.js  src/ENV_PROMPT.md  src/icon.svg
scripts/write-describe.mjs
test/*.test.mjs  test/fixtures/*
describe.json  package.json  README.md  IMPLEMENTATION.md  PUBLISHING.md  CHANGELOG.md  LICENSE
```

## 2. Get it into the market

Coopanion's extension page reads npm; the index repository scans npm periodically. To force a sync, open an issue in `Pal-AI-Lab/cortico-extensions`:

- Title: `[sync] cortico-world-coo-control`
- Body:

  ```
  package: cortico-world-coo-control
  ```

The listing shows the npm name, version, description, icon, `os: win32`, and the tools from `describe.json`. The `coopanion` tag is maintainer-only and cannot be self-declared; this package declares `experimental`, `apps`, `companion`.

## 3. Updates

For a new version:

1. Bump `version` in `package.json`.
2. Add a `CHANGELOG.md` entry.
3. `npm publish`.
4. `[sync]` if you do not want to wait.

Coopanion's extension page compares the installed version with npm's `latest` and offers the update. After the update and a Coopanion restart, the World re-applies the patch if the new app files still match.

When Coopanion changes `body.js` / `pet-app.js`:

1. Run the patch test with `COOPANION_APP_ROOT` pointing at the new `resources/app`.
2. If it fails with `unsupported`, update the target regexes in `src/patch.js` (and the `source` checks) for the new lines.
3. Bump the plugin version, publish, sync.

The goal is that an app update is never silently half-patched: unknown code is refused, and the user is told to update this plugin.

## 4. Local install from the packed tarball

```powershell
cd F:\coo\Coopanion\data\extensions
pnpm add file:C:\path\to\cortico-world-coo-control\cortico-world-coo-control-0.1.0.tgz
```

Restart Coopanion, enable **控制权回交 / Coo Control**, restart once more.

To remove after restoring:

```powershell
pnpm remove cortico-world-coo-control
```

## 5. Manifest check

The package was checked against Cortico's `parseExtensionManifest` shape (`kind: world`, `api: 6`, `describe.json`, `webUiClient` absent). The World's default export has `id / label / defaults() / create()`; `describe` matches `describe.json`.

If the market rejects a tag, remove the unknown tag from `cortico.tags` and republish. `coopanion` is not allowed for community packages.

## 6. Source repository (recommended)

Before the first public release, put the source on GitHub and add:

```json
"repository": { "type": "git", "url": "https://github.com/<you>/cortico-world-coo-control.git" },
"bugs": { "url": "https://github.com/<you>/cortico-world-coo-control/issues" }
```

The market shows both, and users get an issue tracker separate from Coopanion's.
