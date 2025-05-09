'use strict';

const assert = require('node:assert');

const { HappyPumpSDK } = require('../dist/cjs/index.cjs');

assert.ok(HappyPumpSDK, 'HappyPumpSDK should be defined');
assert.strictEqual(typeof HappyPumpSDK, 'function', 'HappyPumpSDK should be a class (function)');
assert.strictEqual(HappyPumpSDK.name, 'HappyPumpSDK', 'HappyPumpSDK should have the name "HappyPumpSDK"');