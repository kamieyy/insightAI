# Insight AI — Chrome Extension

A lightweight Chrome extension (popup + background service worker) that sends prompts to the Google GenAI (Gemini) API and displays results in a popup UI.

This README explains how to build the extension, where the important files live, and how to load it into Chrome for testing.

## Prerequisites

- Node.js (LTS recommended, e.g. 16/18/20+)
- npm (bundled with Node) or yarn
- A Google Cloud / GenAI API key (see security notes below)

## Install

1. Open a terminal in the project root (the folder that contains `package.json`).

```powershell
cd 'c:\selfProjects\covergo hackathon\don-extension'
npm install
```

## Build

The project uses Vite to bundle files into the `dist/` folder. The extension manifest references the built service worker at `dist/background.js`.

```powershell
npm run build
```

Notes:

- The build output will be written to `dist/` (configured in `vite.config.js`).
- `vite` is configured to keep filenames like `background.js` in the output so the manifest's service worker path matches.

## Load the extension in Chrome (for testing)

1. Open Chrome and go to `chrome://extensions/`.
2. Enable "Developer mode" (top-right).
3. Click "Load unpacked" and select this extension directory (the folder that contains `manifest.json`).
   - Make sure you have run `npm run build` first so `dist/background.js` exists.
4. The extension action's popup uses `content/popup.html` and the background service worker is `dist/background.js`.

## Where to look in the code

- `manifest.json` — extension metadata and permissions. The background service worker points to `dist/background.js`.
- `content/popup.html`, `content/popup.js`, `content/popup.css` — popup UI and client-side logic.
- `dist/background.js` — built background/service-worker code (contains the runtime Gemini calls).
- `vite.config.js` — build configuration (outputs `dist/`, keeps `background.js` filename).
- `package.json` — build scripts and dependencies (`@google/genai` is listed).

## Configuring the Gemini / GenAI API key

- The built `dist/background.js` currently contains a placeholder API key constant (search for `apiKey:`). Do NOT commit real API keys into source control.
- Recommended approaches:
  - Prefer storing secrets outside version control. For a Chrome extension, you can store the API key in `chrome.storage` and set it through an options page (not currently included). Or use a small server proxy that holds the key instead of exposing it to the client.
  - If you need to quickly test locally, edit the background source (or `dist/background.js`) to set your key and rebuild, then reload the unpacked extension. Remember to remove the key before committing.

## Quick development tips

- After editing code, run `npm run build` to produce an updated `dist/` and then reload the extension on `chrome://extensions/`.
- The extension communicates with the background service worker via `chrome.runtime.sendMessage({ type: 'SEND_TO_GEMINI', prompt })` from the popup. The background builds a request to the GenAI client and returns model text.

## Security & privacy

- Do not commit API keys, credentials, or sensitive data into the repository. If any keys are present in `dist/` or other files, rotate them and remove them from the repo's history if necessary.
- Consider moving any direct calls to the GenAI API to a trusted server-side component to keep API keys secret.

## Troubleshooting

- If the popup shows "Unable to reach Gemini API" or errors are logged, check the extension background console: go to `chrome://extensions/`, enable developer mode, find the extension, and click "service worker" under Inspect to view logs.
- If `dist/background.js` is missing, run `npm run build`.

## Optional follow-ups I can prepare for you

- Add an options page to securely store the API key in `chrome.storage` and read it in the background script.
- Replace the hard-coded key with a build-time placeholder that reads from an environment variable and injects at build (safer when combined with CI secrets).
- Add a small server proxy to hold the API key and forward requests from the extension.

If you'd like any of the optional follow-ups, tell me which and I will implement it next.

---

Generated on: 2025-10-26
