#!/usr/bin/env node

/**
 * Packages the extension into a ZIP file for Chrome Web Store.
 * Automatically excludes common development files.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sourceDir = process.argv[2] || '.';
const outputZip = process.argv[3] || 'extension.zip';

// Default exclude list
const excludes = [
  '*.zip',
  '*.xpi',
  '*.skill',
  '*.pem',
  'node_modules/*',
  '.git*',
  '.env',
  'artifacts/*',
  'extension-signer/*'
];

try {
  console.log(`📦 Packaging extension from ${sourceDir}...`);
  
  // Use zip command if available
  const excludeArgs = excludes.map(ex => `-x "${ex}"`).join(' ');
  const cmd = `zip -r "${outputZip}" . ${excludeArgs}`;
  
  execSync(cmd, { stdio: 'inherit' });
  
  const stats = fs.statSync(outputZip);
  console.log(`\n✅ Packaging complete!`);
  console.log(`- File: ${outputZip}`);
  console.log(`- Size: ${(stats.size / 1024).toFixed(2)} KB`);
} catch (error) {
  console.error('\n❌ Packaging failed. Ensure "zip" is installed on your system.');
  process.exit(1);
}
