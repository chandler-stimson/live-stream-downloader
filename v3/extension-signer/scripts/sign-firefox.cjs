#!/usr/bin/env node

/**
 * Wrapper for web-ext sign.
 * Requires:
 * - AMO_JWT_ISSUER
 * - AMO_JWT_SECRET
 */

const { execSync } = require('child_process');
const path = require('path');

const sourceDir = process.argv[2] || '.';
const artifactsDir = process.argv[3] || './artifacts';

const issuer = process.env.AMO_JWT_ISSUER;
const secret = process.env.AMO_JWT_SECRET;

if (!issuer || !secret) {
  console.error('Error: AMO_JWT_ISSUER and AMO_JWT_SECRET environment variables are required.');
  console.log('You can find these at https://addons.mozilla.org/en-US/developers/addon/api/key/');
  process.exit(1);
}

try {
  console.log(`🚀 Signing extension in ${sourceDir}...`);
  const cmd = `npx web-ext sign --source-dir "${sourceDir}" --artifacts-dir "${artifactsDir}" --api-key "${issuer}" --api-secret "${secret}" --no-input`;
  
  execSync(cmd, { stdio: 'inherit' });
  
  console.log(`\n✅ Signing complete! Check ${artifactsDir} for the signed XPI.`);
} catch (error) {
  console.error('\n❌ Signing failed. Check the web-ext output above for details.');
  process.exit(1);
}
