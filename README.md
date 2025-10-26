🧠 Insight AI — Chrome Extension

Lightweight Chrome extension (popup + background service worker) that sends prompts to Google Gemini API and shows responses in a popup.

⚙️ Prerequisites

Node.js (v16+ recommended)

npm (comes with Node)

Google GenAI API key

🪜 Setup
# 1. Go to project folder
cd "c:\selfProjects\covergo hackathon\don-extension"

# 2. Initialize and install dependencies
npm init -y
npm install @google/genai
npm install --save-dev vite

# 3. Build the project
npm run build

🧩 Load in Chrome

Open chrome://extensions/

Enable Developer mode

Click Load unpacked

Select the folder containing manifest.json

Make sure dist/background.js exists (run build first)

📂 Key Files
File	Purpose
manifest.json	Extension config & permissions
content/popup.html, .js, .css	Popup UI
dist/background.js	Built background worker (Gemini logic)
vite.config.js	Build output config
package.json	Scripts & dependencies
🔑 API Key

Don’t commit real keys.

For quick local tests:
edit the key in background.js → rebuild → reload.

For security, store keys in chrome.storage or use a server proxy.

🧰 Troubleshooting
# Missing dist/background.js
npm run build

# Check logs
chrome://extensions/ → Enable dev mode → Inspect "service worker"
