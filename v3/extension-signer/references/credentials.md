# Credentials Reference

The `extension-signer` skill requires API keys for automated signing.

## Firefox (Add-ons Mozilla)

To sign Firefox extensions (`.xpi`), you need a JWT Issuer and Secret.

1.  Go to [AMO Developer Hub - API Keys](https://addons.mozilla.org/en-US/developers/addon/api/key/).
2.  Copy your **JWT issuer** and **JWT secret**.
3.  Set them as environment variables:

```bash
export AMO_JWT_ISSUER="user:xxxx:123"
export AMO_JWT_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Alternatively, you can provide a `.env` file in the project root:

```text
AMO_JWT_ISSUER=user:xxxx:123
AMO_JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Chrome (CRX / ZIP)

Chrome distribution typically uses a `.pem` file for local `.crx` generation, but the Chrome Web Store prefers a clean `.zip` for upload. No specific API keys are required for the `package-chrome` script as it creates a standard ZIP.
