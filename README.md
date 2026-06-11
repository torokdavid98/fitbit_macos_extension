# Mood Widget

A small macOS menubar widget that shows your **Fitbit Air** (or any Fitbit / Pixel Watch) health
stats at a glance — latest heart rate, resting HR, steps, active calories, HRV, and SpO₂. Includes a
live connection-status indicator and a manual refresh button. Built with Electron + TypeScript. Mood
tracking is planned (a slot is reserved in the UI).

> **Heads-up:** Fitbit Air is screenless and syncs to the **Google Health app**, not the classic
> Fitbit app. So this widget reads from the **Google Health API** (the next-generation Fitbit Web
> API), *not* the legacy Fitbit Web API or Google Fit (which is shut down).

---

## How this works (read before cloning)

Google Health data lives behind **restricted OAuth scopes**. There is no shared public app you can
just log into. **Each person who runs this creates their own Google Cloud OAuth client and adds
themselves as a test user.** That keeps you inside Google's *testing mode*, which needs **no app
verification and no security assessment** — the catch is:

- You can add up to **100 test users** per project.
- Testing-mode refresh tokens **expire after 7 days**, so you re-connect about once a week.

This is the normal trade-off for a clone-and-run open-source health app. Shipping a one-click public
build would require Google's [restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
plus an annual [CASA security assessment](https://developers.google.com/health/app-verification) — out
of scope here.

**Want to try the UI without any of this?** It ships with a mock data provider — see
[Run with mock data](#run-with-mock-data).

---

## Prerequisites

- macOS
- [Node.js](https://nodejs.org) 18+ and npm
- A Fitbit Air / Fitbit / Pixel Watch synced to the **Google Health** app
- A Google account (the same one your device syncs to)

---

## 1. Clone & install

```bash
git clone <your-fork-url> mood-widget
cd mood-widget
npm install
```

## 2. Run with mock data

No Google setup needed — just see the widget working:

```bash
npm run dev
```

`USE_MOCK` is `true` by default in `src/shared/config.ts`. Click the ❤︎ in the menubar to show the
widget; the cards drift slightly on each refresh so you can see it update.

---

## 3. Connect real Google Health data

### 3a. Create a Google Cloud project + OAuth client

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
2. **Enable the Google Health API** for the project
   (APIs & Services → Library → search "Google Health API" → Enable).
3. **Select the read scopes on the Data Access page.** In the Google Health API screen, open
   **Data Access** and select these three read scopes (the app requests exactly these — see
   `GOOGLE_HEALTH_SCOPES` in `src/shared/config.ts`):
   - `…/auth/googlehealth.activity_and_fitness.readonly`
   - `…/auth/googlehealth.health_metrics_and_measurements.readonly`
   - `…/auth/googlehealth.sleep.readonly`

   > ⚠️ The `.readonly` suffix matters. Requesting a scope that isn't selected here — or dropping
   > `.readonly` — makes Google reject the consent request with a **400 malformed** error.
4. **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type: **External**, leave the app in **Testing** (do not publish).
   - Under **Audience → Test users**, **add the Google account you'll sign in with**
     (the one your device syncs to). Skipping this gives a **403 access_denied** on consent.
5. **Create credentials** (APIs & Services → Credentials → Create credentials → OAuth client ID):
   - Application type: **Desktop app**.
   - Download the JSON. You need the **Client ID** and **Client secret** from it. (Desktop clients
     use PKCE; the secret is non-confidential but Google's token endpoint still expects it.)

### 3b. Configure the app

Copy the example env file and fill in your client details (`.env` is gitignored):

```bash
cp .env.example .env
# then edit .env:
#   GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
#   GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
```

Then flip the provider in `src/shared/config.ts`:

```ts
export const USE_MOCK = false
```

### 3c. Run and connect

```bash
npm run dev
```

Open the widget from the menubar → **Connect Google Health** → consent in your browser → stats
appear. Tokens are stored encrypted on-device via Electron `safeStorage` (macOS Keychain).

> Because the app is in testing mode, you'll need to reconnect roughly every 7 days when the refresh
> token expires.

---

## Build a packaged app

```bash
npm run dist
```

Produces a `.dmg` / `.app` under `dist/`. There's no shared credential baked in, and a packaged app
doesn't read the project `.env`. Put your credentials in the app's userData dir instead:

```
~/Library/Application Support/Mood Widget/.env
```

(In dev it still reads the project-root `.env`.) Toggle **Launch at login** from the tray's
right-click menu.

---

## Project structure

```
src/
  main/                 # Electron main process (Node)
    index.ts            # frameless widget window + menubar tray toggle
    ipc.ts              # health:getStats / status / login channels
    oauth.ts            # Google OAuth2 PKCE loopback flow + token refresh
    tokenStore.ts       # tokens encrypted via safeStorage (Keychain)
    health/
      types.ts          # Stats model — the contract the whole UI renders
      provider.ts       # getProvider() — swaps mock vs real via USE_MOCK
      mock.ts           # fake stats, no network
      googleHealth.ts   # real Google Health API provider
  preload/index.ts      # contextBridge -> window.health
  renderer/             # UI: stat cards grid + reserved mood slot
  shared/config.ts      # USE_MOCK, scopes, API base, refresh interval
```

Swapping data sources is a single flag: `USE_MOCK` in `src/shared/config.ts`. The renderer only ever
sees the `Stats` shape, so the UI never changes between mock and real.

---

## Known limitations / TODO

- **Endpoint shapes are best-effort.** The request/response mapping in `googleHealth.ts` follows the
  docs but hasn't been validated against a live account for every metric — expect to tweak
  `latestSample` / `dailyValue` / `sleepTotal`. Confirm exact **read** scope strings at setup time.
- **Air metric coverage** — Fitbit Air is new; verify which metrics actually surface via the Google
  Health API for a personal account.
- **Testing-mode 7-day re-login** — inherent to unverified restricted scopes.
- **Mood tracking** — UI slot reserved (`#mood-slot`); entry flow not built yet.

---

## License

MIT (add a `LICENSE` file to your fork).
