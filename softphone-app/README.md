# Wazo Browser Softphone

A small browser phone built against the local `@wazo/sdk` checkout.

## Run locally

Requirements: Node.js 22+ and pnpm 10+.

```bash
cd softphone-app
pnpm install
pnpm dev
```

Open the local HTTPS/localhost URL, enter the Wazo host (without `https://`), username, and password, then allow microphone access.

## Production

```bash
pnpm build
```

Deploy the generated `dist` directory behind HTTPS. The browser must trust the TLS certificate used by Wazo, and the Wazo host must expose its authentication API and SIP-over-WebSocket/WebRTC services to the browser.
