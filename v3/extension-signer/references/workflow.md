# Signing Workflow

This guide explains the step-by-step process for using this skill to sign or package an extension.

## 1. Validation (Recommended)

Always run `check-manifest.cjs` first. Universal extensions often fail signing because of missing `browser_specific_settings` or MV2/MV3 mismatches.

```bash
node extension-signer/scripts/check-manifest.cjs
```

## 2. Firefox Signing

This process uploads the extension to Mozilla, waits for the automated validation, and downloads the signed XPI.

-   **Unlisted Extensions:** Fast, download occurs immediately after validation.
-   **Listed Extensions:** Not recommended for automated CLI signing as they require manual review.

```bash
node extension-signer/scripts/sign-firefox.cjs [source_dir] [output_dir]
```

## 3. Chrome/Edge Packaging

Creates a production-ready ZIP file. This script automatically filters out common development junk (`node_modules`, `.git`, etc.) to keep the package size small.

```bash
node extension-signer/scripts/package-chrome.cjs [source_dir] [output_filename.zip]
```
