#!/usr/bin/env node

/**
 * Validates the manifest.json for cross-browser compatibility.
 * Focuses on differences between Chrome (MV3) and Firefox (Gecko).
 */

const fs = require('fs');
const path = require('path');

const manifestPath = process.argv[2] || 'manifest.json';

if (!fs.existsSync(manifestPath)) {
  console.error(`Error: Manifest file not found at ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const issues = [];

// 1. Check Browser Specific Settings (Required for Firefox if not using a specific signing flow)
if (!manifest.browser_specific_settings || !manifest.browser_specific_settings.gecko) {
  issues.push('Warning: Missing "browser_specific_settings.gecko". Firefox requires an ID for signing.');
}

// 2. Check Action vs Browser Action
if (manifest.manifest_version === 3) {
  if (manifest.browser_action) {
    issues.push('Error: "browser_action" found in Manifest V3. Use "action" instead.');
  }
}

// 3. Check Host Permissions
if (manifest.manifest_version === 3 && manifest.permissions) {
  const hostPermissions = manifest.permissions.filter(p => p.includes('://') || p === '<all_urls>');
  if (hostPermissions.length > 0) {
    issues.push('Warning: Host permissions should be in "host_permissions" for MV3, not "permissions".');
  }
}

// 4. Background Service Worker vs Scripts
if (manifest.manifest_version === 3) {
  if (manifest.background && manifest.background.scripts && !manifest.background.service_worker) {
    issues.push('Note: Manifest V3 uses "service_worker". Firefox supports service workers in MV3, but check compatibility if you rely on "scripts".');
  }
}

if (issues.length === 0) {
  console.log('✅ Manifest looks good for cross-browser distribution.');
} else {
  console.log('📋 Manifest validation results:');
  issues.forEach(issue => console.log(`- ${issue}`));
}
