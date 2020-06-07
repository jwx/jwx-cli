#!/usr/bin/env node
'use strict';

let jwx;
// Require lib (local, for debugging) or dist (production)
try {
    jwx = require('../lib');
} catch (e) {
    jwx = require('../dist');
}

const { version } = require('../package.json');
console.log(`jwx- v${version}\n`);

jwx().catch(error => {
    console.error(error);
    process.exit(1);
});
