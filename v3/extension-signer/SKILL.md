---
name: extension-signer
description: Validates, packages, and signs universal web extensions for Firefox (AMO) and Chrome distribution. Use when you need to prepare an extension folder for production or sign an XPI for Firefox.
---

# Extension Signer

This skill aids in the production lifecycle of web extensions, ensuring they are cross-browser compatible and correctly signed.

## Quick Start

### Validate Manifest
Run this to catch common cross-browser issues before signing:
`node scripts/check-manifest.cjs [path-to-manifest]`

### Sign for Firefox
Requires `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`.
`node scripts/sign-firefox.cjs [source-dir] [artifacts-dir]`

### Package for Chrome/Generic
Creates a clean ZIP for store upload.
`node scripts/package-chrome.cjs [source-dir] [output.zip]`

## Resources

- **Credentials**: See [credentials.md](references/credentials.md) for API key setup.
- **Workflow**: See [workflow.md](references/workflow.md) for detailed steps.
- **Automated Checks**: The validator checks for MV3 host permissions, Gecko IDs, and background script compatibility.
