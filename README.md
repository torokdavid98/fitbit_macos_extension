# Fitbit Air macOS Extension

A small macOS menubar widget that shows your **Fitbit Air** (or any Fitbit / Pixel Watch) health
stats at a glance — latest heart rate, resting HR, steps, active calories, HRV, and SpO₂. Includes a
live connection-status indicator and a manual refresh button. Built with Electron + TypeScript.

<img width="387" height="809" alt="Screenshot 2026-06-11 at 14 23 19" src="https://github.com/user-attachments/assets/df628b53-6070-46e6-ae16-31ac92ae27b4" />

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
git clone <your-fork-url> fitbit_macos_extension
cd fitbit_macos_extension
npm install
```

## 2. Run it

```bash
npm run dev
```

Click the ❤︎ in the menubar to open the widget. On first launch you get a **setup screen**:

- **Just looking?** Click **"Skip — use demo data"** — explore the full UI with realistic fake
  data, no Google account needed.
- **Real data?** Follow the steps below, then paste your client JSON into the setup screen.

Everything is configured **in-app** — no editing files or source code.

---

## 3. Connect real Google Health data

### 3a. Create a Google Cloud project + OAuth client

(One-time Google setup — this part can't be skipped, it's how Google guards health data.)

1. Open the [Google Cloud Console](https://console.cloud.google.com/) (the setup screen has a button)
   and create a new project.
2. **Enable the Google Health API** (APIs & Services → Library → search "Google Health API" → Enable).
3. On the API's **Data Access** page, add these three read scopes:
   - `…/auth/googlehealth.activity_and_fitness.readonly`
   - `…/auth/googlehealth.health_metrics_and_measurements.readonly`
   - `…/auth/googlehealth.sleep.readonly`

   > ⚠️ The `.readonly` suffix matters — a missing/unselected scope makes Google reject consent with
   > a **400 malformed** error.
4. **OAuth consent screen**: User type **External**, leave in **Testing**, and under
   **Audience → Test users** add the Google account you'll sign in with (else **403 access_denied**).
5. **Create credentials → OAuth client ID → Desktop app**, then **download the JSON**.

### 3b. Paste it in

In the widget's setup screen, **paste the downloaded JSON** and click **Save & continue**. The
credentials are stored encrypted on-device (Keychain via `safeStorage`) — no `.env`, no code edits.
Then click **Connect Google Health** → consent in your browser → stats appear.

> Testing-mode tokens expire after ~7 days, so you'll reconnect about once a week.

> **Developer alternative:** instead of the in-app paste, you can put `GOOGLE_OAUTH_CLIENT_ID` /
> `GOOGLE_OAUTH_CLIENT_SECRET` in a project-root `.env` (see `.env.example`). The in-app store takes
> precedence when both exist.

---

## Build a packaged app

```bash
npm run dist
```

Produces a `.dmg` / `.app` under `dist/`. Credentials aren't baked in — just open the app and use the
in-app setup screen (stored in the app's userData). Toggle **Launch at login** from the tray's
right-click menu.

---

## Project structure

```
src/
  main/                 # Electron main process (Node)
    index.ts            # frameless widget window + menubar tray + login-item
    ipc.ts              # health:* and setup:* IPC channels
    oauth.ts            # Google OAuth2 PKCE loopback flow + token refresh
    tokenStore.ts       # OAuth tokens encrypted via safeStorage (Keychain)
    credStore.ts        # in-app client id/secret (encrypted) + JSON parsing
    settings.ts         # small plain-JSON settings (demo toggle)
    statsCache.ts       # last good stats for instant launch
    health/
      types.ts          # Stats model — the contract the whole UI renders
      provider.ts       # getProvider() — demo -> mock, else Google
      mock.ts           # fake stats + sleep/HR series, no network
      googleHealth.ts   # real Google Health API provider
  preload/index.ts      # contextBridge -> window.health
  renderer/             # UI: cards, HR chart, sleep chart, setup + auth screens
  shared/config.ts      # USE_MOCK (dev override), scopes, API base, refresh interval
```

The renderer only ever sees the `Stats` shape, so the UI is identical for mock and real data. The
provider is chosen at runtime: demo toggle (or the dev `USE_MOCK` flag) → mock; otherwise the real
Google provider, which reports `unconfigured` until credentials are entered in-app.

---
