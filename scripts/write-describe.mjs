/** Writes describe.json from src/describe.js; run after changing a tool schema. */
import { writeFileSync } from 'node:fs';
import { DESCRIBE } from '../src/describe.js';

writeFileSync(new URL('../describe.json', import.meta.url), `${JSON.stringify(DESCRIBE, null, 2)}\n`, 'utf8');
console.log('describe.json written');
