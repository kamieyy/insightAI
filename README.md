# 🧠 Insight AI — Chrome Extension

Lightweight Chrome extension (popup + background service worker) that sends prompts to the Google Gemini API and shows responses in a popup.

---

## ⚙️ Prerequisites
- Node.js (v16+ recommended)  
- npm (comes with Node)  
- Google GenAI API key  

---

## 🪜 Setup

```bash
# 1. Go to your project folder
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

Select the folder that contains manifest.json

Make sure dist/background.js exists (run npm run build first)
