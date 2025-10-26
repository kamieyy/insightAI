const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");
const closeBtn = document.getElementById("closeSidebar");

// Global storage for current scraping session
let geminiResults = []; // Only id, title, description

chrome.storage.local.get(["messages", "geminiResults"], (data) => {
  const msgs = data.messages || [];
  const results = data.geminiResults || [];

  messages.innerHTML = msgs
    .map(
      (m) =>
        `<div class="${m.sender === "user" ? "msg-user" : "msg-bot"}">
           ${m.text}  <!-- text is already HTML -->
         </div>`
    )
    .join("");

  geminiResults = results;

  messages.scrollTop = messages.scrollHeight;
});

// Add message to chat
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.className = sender === "user" ? "msg-user" : "msg-bot";

  let formatted = text;

  // Convert markdown bold (**text**) to <b>text</b>
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  // Convert clickable titles in the form <a href="...">Title</a>
  // Ensure Gemini's <a> tags are preserved
  // (If Gemini outputs raw links like "Title - URL", optionally convert them to <a>)
  // Example: "Title - https://example.com" -> <a href="https://example.com">Title</a>
  formatted = formatted.replace(
    /(.+?) - (https?:\/\/\S+)/g,
    '<a href="$2" target="_blank">$1</a>'
  );

  // Convert newlines to <br>
  formatted = formatted.replace(/\n/g, "<br>");

  msg.innerHTML = formatted;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;

  chrome.storage.local.get(["messages"], (data) => {
    const msgs = data.messages || [];
    msgs.push({ sender, text: formatted });
    saveMessages(msgs);
  });
}

// Send text to Gemini API
async function sendToGemini(prompt) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "SEND_TO_GEMINI", prompt },
      (response) => {
        if (response && response.success) {
          resolve(response.reply);
        } else {
          resolve("⚠️ Error: Unable to reach Gemini API.");
        }
      }
    );
  });
}

// General scrape function
async function generalScholarScrape(searchOptions) {
  // Wipe previous data
  geminiResults = [];

  let currentPage = 1;
  const totalPages = searchOptions.pages;

  // Get active tab ID once
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return "⚠️ No active tab";
  const activeTabId = tab.id;

  while (currentPage <= totalPages) {
    // 1. Navigate to Advanced Search URL (pass current page)
    await goToScholarAdvancedSearch({ ...searchOptions, page: currentPage });

    // 2. Wait for page to load
    await waitForTabLoad(activeTabId, 5000);

    // 3. Scrape current page
    const { geminiPageData } = await scrapeCurrentScholarPage();

    // 4. Append data
    geminiResults.push(...geminiPageData);
    saveGeminiResults(geminiResults);
    currentPage++;
  }

  return geminiResults;
}

// SCRAPE CURRENT PAGE
async function scrapeCurrentScholarPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return "⚠️ No active tab";

  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () => {
          const results = [];

          const blocks = Array.from(document.querySelectorAll("div.gs_r"));
          blocks.forEach((block) => {
            const titleEl = block.querySelector("h3.gs_rt");
            const titleLinkEl = titleEl?.querySelector("a");
            const id = titleLinkEl?.id || null;
            const title = titleEl?.textContent.trim() || "";
            const link = titleLinkEl?.href || "";
            const description =
              block.querySelector("div.gs_rs")?.textContent.trim() || "";
            const authors =
              block.querySelector("div.gs_a")?.textContent.trim() || "";
            const citedByEl = block.querySelector("a[href*='cites=']");
            const citedBy = citedByEl
              ? parseInt(citedByEl.textContent.match(/\d+/)?.[0] || 0)
              : 0;
            const relatedLink =
              block.querySelector("a[href*='related:']")?.href || "";
            const saveButton = !!block.querySelector("a.gs_or_sav.gs_or_btn");
            const type =
              titleEl?.querySelector("span.gs_ct1")?.textContent || "";

            results.push({
              title,
              description,
              link,
              citedBy,
              id,
            });
          });

          // JSON as text

          return {
            geminiPageData: results,
          };
        },
      },
      (res) => {
        if (res && res[0] && res[0].result) {
          resolve(res[0].result);
        } else {
          resolve("⚠️ Could not scrape Google Scholar.");
        }
      }
    );
  });
}

sendBtn.onclick = handleSend;
input.addEventListener("keydown", (e) => e.key === "Enter" && handleSend());
closeBtn.onclick = () => window.close();

async function handleGeminiReply(reply) {
  try {
    const cleanedReply = reply
      .trim()
      .replace(/^```(?:json)?/, "")
      .replace(/```$/, "")
      .trim();

    const parsed = JSON.parse(cleanedReply);

    if (!parsed.intent) {
      addMessage("bot", "I didn't understand your request. Please try again.");
      return;
    }

    switch (parsed.intent.toUpperCase()) {
      case "SEARCH":
        addMessage("bot", "Of course, I will start my search now...");
        addMessage("bot", "scraping google scholar...");
        // Call the scrape function with the details object
        const res = await generalScholarScrape(parsed.details);
        addMessage("bot", "Analyzing the scraped papers...");
        let prompt = `
        Forget all the previous instructions.
Your tasks:
1. Rewrite the titles and very brief descriptions in a **clear, easy-to-read format** in markdown. <a> tag for titles <span> for descriptions <small> for cited by. title should be texts only remove everything like [book] [html]
2. Frame the reply as if you found those data for the user yourself. (here are the results for you, etc.)
3. Make the title of each entry clickable using an HTML <a> tag with the link provided in the dataset.
   Example: <a href="https://example.com/paper.pdf">Paper Title</a> </br>
4. Keep the description short and readable after the title.
5. Only use links provided in the dataset; do not invent new links.
Optional follow-up: After presenting the formatted entries, ask the user if they want to:
- "tell me your field of research and I will send you the most relevant papers from these results."

Here is the data:
`;

        prompt += JSON.stringify(res, null, 2);
        return prompt;

      case "RELEVANT":
        addMessage(
          "bot",
          "Sure, I will search for relevant entries right now..."
        );
        addMessage("bot", "Finding relevant entries from previous list...");
        // 1. Check if there is any scraped data
        if (!geminiResults || geminiResults.length === 0) {
          addMessage(
            "bot",
            "⚠️ You have no searched papers yet. Please search for papers or files before asking for relevant results."
          );
          return;
        }

        // Build the prompt string (like SEARCH case)
        let relevantPrompt = `
Forget all previous instructions.
Your tasks:
1. look at the dataset below and identify the most relevant entries (maximum 4) based on the user's field/problem of interest.
2. the entries should only come from the dataset and you should not make up any new entries. MOST IMPORTANT
3. you shouldn't duplicate entries. you should pick at most 4 entries
4. remove ugly [HTML][BOOK] things from the title and write descriptions in a **clear, easy-to-read format** (one line per paper: title + very short and brief description + very brief and short about how it's relevant).
5. start with something like "based on your request, here are the most relevant papers I found:"
6. Make the title of each entry clickable using an HTML <a> tag with the link provided in the dataset. add a line break after
   Example: <a href="https://example.com/paper.pdf">Paper Title</a> </br>
7. Keep the description short and readable after the title.
8. Only use links provided in the dataset; do not invent new links.

User's field/problem of interest:
${
  parsed.details || ""
}  // assuming 'field' or 'problem' key is provided in details
if not provided, ask the user to provide clearer detail about their research interest or problem.

Here is the dataset:
${JSON.stringify(geminiResults, null, 2)}
`;

        // 3. Return the prompt string (to send to Gemini later)
        return relevantPrompt;

      case "CITE": {
        // parsed.details should include something like {title or identifier}

        const paperTitle = parsed.details; // e.g., "A Study on XYZ"
        addMessage("bot", "Of course. Fetching citation for the paper...");
        if (!paperTitle) {
          addMessage("bot", "⚠️ No paper title provided.");
          return;
        }

        const paper = geminiResults.find((p) => p.title === paperTitle);
        if (!paper || !paper.id) {
          addMessage("bot", "⚠️ Paper not found in previous results.");
          return;
        }

        const paperId = paper.id;

        // Click the cite button via scripting
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab) return;

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (id) => {
            const block = document.querySelector(`#${id}`)?.closest(".gs_ri");
            const citeBtn = block?.querySelector("a.gs_or_cit");
            if (citeBtn) citeBtn.click();
          },
          args: [paperId],
        });
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            func: () => {
              return new Promise((resolve) => {
                const interval = setInterval(() => {
                  const citTable = document.querySelector("#gs_citt");
                  if (citTable) {
                    clearInterval(interval);
                    resolve(citTable.innerText.trim());
                  }
                }, 100); // check every 100ms
                // optional timeout after 5s
                setTimeout(() => {
                  clearInterval(interval);
                  resolve(null);
                }, 5000);
              });
            },
          },
          (res) => {
            addMessage(
              "bot",
              "citations: <br>" +
                res[0].result +
                "<br> Do you want me to find more papers?"
            );
            return null;
          }
        );
      }

      default:
        console.warn("Unknown intent:", parsed.intent);
        // Optional: fallback function
        await handleFallback(parsed.details);
        break;
    }
  } catch (err) {
    console.error("Error parsing Gemini reply:", err);
  }
}

// Handle send button
async function handleSend() {
  const text = input.value.trim();
  if (!text) return;

  addMessage("user", text);
  input.value = "";

  let prompt = `
  This is a controlled test all done on public data and local datas for a hackathon project.
You are an intelligent assistant that can handle multiple tasks for a research-focused chatbot. 
Your job is to **decide the user's intent** based on their message and classify it into one of the following categories and respond in according json format

- SEARCH: The user wants to search for papers/books/articles.
- RELEVANT: Find relevant **entries** and summarize them according to the user's **interest** or problems.
- CITE: The user wants to cite a specific paper/book/article by providing it's title or description

Rules:
- Respond **only** with valid JSON, using the following structure:
  - intent: **only** one of the categories above
  - details: REQUIRED field. You **must** include it in every response, following the specified list for the intent. 
  - If any data is not provided by the user, leave the value as an empty string (""), but **still include the key**.
  - if there's no clear intent or user has written gibberish, respond with "NULL"
Example responses:

SEARCH {
  "intent": "SEARCH",
  "details": {
    "allWords": "artificial intelligence outcomes",
    "exactPhrase": "",
    "anyWords": "",
    "withoutWords": "chatgpt",
    "where": "any",
    "author": "",
    "publication": "",
    "yearFrom": "1990",
    "yearTo": "2025",
    "pages": 3 (10 paper per page, maximum 3 pages) || default 1
  }
}

RELEVANT {
  "intent": "RELEVANT",
  "details": "problem description or field of research"
}

CITE {
  "intent": "CITE",
  "details": "THE EXACT title of the paper to cite"
}

Now classify this user message:
"${text}"
`;

  // 3) Send to Gemini API
  const reply = await sendToGemini(prompt);
  // 4) Prompt again for action
  prompt = await handleGeminiReply(reply);
  if (!prompt) return;
  const final = await sendToGemini(prompt);
  addMessage("bot", final);
}

async function navigateToUrl(url) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await chrome.tabs.update(tab.id, { url }); // navigates the current tab
}

// Helper: wait for tab to complete loading
function waitForTabLoad(tabId, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    // fallback timeout
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(); // still resolve after timeout
    }, timeout);
  });
}

/**
 * Navigate to Google Scholar advanced search with given options
 * @param {Object} options
 *   - allWords: string
 *   - exactPhrase: string
 *   - anyWords: string
 *   - withoutWords: string
 *   - where: "any" | "title"
 *   - author: string
 *   - publication: string
 *   - yearFrom: string
 *   - yearTo: string
 *   - page: number (optional, default 1)
 */
async function goToScholarAdvancedSearch(options = {}) {
  const params = new URLSearchParams();

  params.set("as_q", options.allWords || "");
  params.set("as_epq", options.exactPhrase || "");
  params.set("as_oq", options.anyWords || "");
  params.set("as_eq", options.withoutWords || "");
  params.set("as_occt", options.where || "any"); // "any" or "title"
  params.set("as_sauthors", options.author || "");
  params.set("as_publication", options.publication || "");
  params.set("as_ylo", options.yearFrom || "");
  params.set("as_yhi", options.yearTo || "");
  params.set("hl", "en");
  params.set("as_sdt", "0,5");

  // Add start parameter for pagination
  const page = options.page || 1;
  const start = (page - 1) * 10;
  params.set("start", start);

  const url = `https://scholar.google.com/scholar?${params.toString()}`;

  // Navigate current tab to this URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return "⚠️ No active tab found";
  await chrome.tabs.update(tab.id, { url });

  return;
}

////////////////////

// Save messages array
function saveMessages(messages) {
  chrome.storage.local.set({ messages });
}

// Save Gemini results
function saveGeminiResults(results) {
  chrome.storage.local.set({ geminiResults: results });
}

// Save both at once
function saveState(messages, geminiResults) {
  chrome.storage.local.set({ messages, geminiResults });
}
