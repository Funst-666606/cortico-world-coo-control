#!/usr/bin/env node
/**
 * Publish this package to npm with the checks this project needs.
 *
 *   node scripts/publish.mjs --otp 123456
 *   npm run release -- --otp 123456
 *   node scripts/publish.mjs --dry-run
 *
 * The script:
 *  1. refuses a version that is already on the registry;
 *  2. regenerates describe.json and runs the test suite (unless --skip-tests);
 *  3. when no OTP is passed, lets npm run its browser 2FA flow in a terminal
 *     (or prompts for the OTP itself); a non-TTY run must pass --otp / NPM_OTP;
 *  4. runs `npm publish --access public`;
 *  5. prints the npm page and a ready-made market-sync issue URL.
 *
 * The browser flow means you do not need to find a 6-digit code: npm opens its
 * auth URL and waits for you to approve with the account's password/security key.
 *
 * Options:
 *   --otp <code>        npm one-time password (or NPM_OTP env)
 *   --tag <name>        dist-tag, default latest
 *   --access <mode>     public (default) or restricted
 *   --dry-run           run the publish with --dry-run, no upload
 *   --skip-tests        publish without regenerating describe/tests
 *   --help
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);

const usage = () => {
  console.log(`usage: node scripts/publish.mjs [--otp 123456] [--tag latest] [--access public] [--dry-run] [--skip-tests]`);
  console.log('Without --otp, run it in a terminal: npm opens its browser 2FA flow.');
};

let otp = process.env.NPM_OTP || '';
let tag = 'latest';
let access = 'public';
let dryRun = false;
let skipTests = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') { usage(); process.exit(0); }
  else if (arg === '--dry-run') dryRun = true;
  else if (arg === '--skip-tests') skipTests = true;
  else if (arg === '--otp') otp = args[++i] ?? '';
  else if (arg.startsWith('--otp=')) otp = arg.slice('--otp='.length);
  else if (arg === '--tag') tag = args[++i] ?? '';
  else if (arg.startsWith('--tag=')) tag = arg.slice('--tag='.length);
  else if (arg === '--access') access = args[++i] ?? '';
  else if (arg.startsWith('--access=')) access = arg.slice('--access='.length);
  else { console.error(`unknown option: ${arg}`); usage(); process.exit(2); }
}

if (!pkg.name || !pkg.version) {
  console.error('package.json has no name/version');
  process.exit(2);
}
if (!/^[a-z0-9][a-z0-9._-]*$/.test(tag)) {
  console.error(`invalid dist-tag: ${tag}`);
  process.exit(2);
}
if (access !== 'public' && access !== 'restricted') {
  console.error(`invalid access: ${access}`);
  process.exit(2);
}
if (otp && !/^\d{6,8}$/.test(otp)) {
  console.error('OTP must be 6–8 digits');
  process.exit(2);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, commandArgs) {
  // A .cmd shim needs the shell on Windows; node.exe must not go through it (its path
  // contains spaces, and an unquoted `C:\Program` is not a command).
  const useShell = process.platform === 'win32' && command === npm;
  const result = spawnSync(command, commandArgs, { shell: useShell, stdio: 'inherit', env: process.env });
  if (result.error) {
    console.error(`could not start ${command}: ${result.error.message}`);
    process.exit(3);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function alreadyPublished() {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`, {
    headers: { 'user-agent': 'cortico-world-coo-control-release' },
  });
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  throw new Error(`registry returned HTTP ${res.status}`);
}

console.log(`package: ${pkg.name}@${pkg.version}`);
console.log(`registry: https://registry.npmjs.org/ (${access}, tag ${tag})`);

try {
  if (await alreadyPublished()) {
    console.error(`already published: ${pkg.name}@${pkg.version}`);
    console.error('bump the version first (and add a CHANGELOG entry)');
    process.exit(4);
  }
} catch (error) {
  console.error(`could not check the registry: ${error.message}`);
  console.error('refusing to publish blindly; check the network/registry and retry');
  process.exit(5);
}

if (!skipTests) {
  console.log('regenerating describe.json…');
  run(process.execPath, ['scripts/write-describe.mjs']);
  console.log('running tests…');
  run(npm, ['test']);
}

if (!dryRun && !otp) {
  if (!process.stdin.isTTY) {
    console.error('npm 2FA needs an interactive terminal for its browser flow.');
    console.error('run this from a terminal, or pass --otp <code>, or set NPM_OTP.');
    process.exit(6);
  }
  console.log('No OTP passed: npm will open its browser 2FA flow here (or prompt for an OTP).');
}

const publishArgs = ['publish', '--access', access, '--tag', tag];
if (dryRun) publishArgs.push('--dry-run');
if (otp) publishArgs.push(`--otp=${otp}`);

console.log(`running: npm ${publishArgs.map((a) => (a.startsWith('--otp=') ? '--otp=<redacted>' : a)).join(' ')}`);
run(npm, publishArgs);

if (dryRun) {
  console.log('dry run complete; nothing was uploaded');
  process.exit(0);
}

const page = `https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`;
const syncTitle = encodeURIComponent(`[sync] ${pkg.name}`);
const syncBody = encodeURIComponent(`package: ${pkg.name}`);
const sync = `https://github.com/Pal-AI-Lab/cortico-extensions/issues/new?title=${syncTitle}&body=${syncBody}`;
console.log('');
console.log(`published: ${page}`);
console.log(`market sync: ${sync}`);
console.log('If the market does not pick it up within ~10 minutes, open the sync issue above.');
