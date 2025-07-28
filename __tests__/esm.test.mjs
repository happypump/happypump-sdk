import assert from 'node:assert';

import { HappyPumpSDK } from '../dist/esm/index.mjs';

assert.ok(HappyPumpSDK, 'HappyPumpSDK should be defined');
assert.strictEqual(typeof HappyPumpSDK, 'function', 'HappyPumpSDK should be a class (function)');
assert.strictEqual(HappyPumpSDK.name, 'HappyPumpSDK', 'HappyPumpSDK should have the name "HappyPumpSDK"');