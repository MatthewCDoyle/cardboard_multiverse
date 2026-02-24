# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
yarn
```

## eBay Proxy Setup

Create `.env.local` in the project root with your eBay sandbox credentials:

```bash
EBAY_APP_ID=your-app-id
EBAY_DEV_ID=your-dev-id
EBAY_CERT_ID=your-cert-id
EBAY_PROXY_PORT=8787
```

Start the backend proxy in one terminal:

```bash
npm run api
```

If you are using a remote browser session (Codespaces/dev container), set a forwarded proxy URL in the browser console before opening the Card Tracker:

```js
window.__EBAY_PROXY_URL__ = 'https://<your-forwarded-proxy-host>'
```

Example: `https://<codespace-name>-8787.app.github.dev` (not `:8787` on the app.github.dev host)

## Local Development

```bash
yarn start
```

Run this in a second terminal while the proxy is running to use live sold listings in the tracker.

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

Using SSH:

```bash
USE_SSH=true yarn deploy
```

Not using SSH:

```bash
GIT_USER=<Your GitHub username> yarn deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.
