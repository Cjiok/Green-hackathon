# Sentinel — Browser Extension Install Guide

## What it does
Sentinel intercepts everything you type into ChatGPT, Claude, Gemini, Copilot, and Perplexity **before** you hit send.

- 🔴 **RESTRICTED** content (API keys, credentials, SSNs, M&A terms) → Hard blocked
- 🟠 **CONFIDENTIAL** content (emails, financials, HR data) → Warned + option to redact
- 🟡 **INTERNAL** content → Warning shown if on an external site

---

## How to Install (Chrome / Edge / Brave)

1. Open your browser and go to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`

2. Toggle **"Developer mode"** ON (top right corner)

3. Click **"Load unpacked"**

4. Select the `sentinel-extension` folder

5. The Sentinel shield icon appears in your toolbar ✅

---

## How to Use

### Automatic interception
Just type normally in ChatGPT, Claude, Gemini etc. If Sentinel detects sensitive data:

- A **banner slides up** from the bottom of the screen showing what was detected
- You get 3 choices:
  - **Send Redacted** — strips the sensitive parts and lets the rest through
  - **Block** — clears the input entirely
  - **Allow Anyway** — lets it through but logs it for the admin

### Popup (click the shield icon)
- **Summary tab** — today's block/redact/warn counts
- **Log tab** — full event history with timestamps and sites
- **Rules tab** — add custom company rules (e.g. project codenames)

### Adding custom rules
1. Click the Sentinel icon in the toolbar
2. Go to ⚙️ Rules tab
3. Enter: Rule Name + Regex Pattern + Sensitivity Level
4. Click **+ Add Custom Rule**

Example rules:
| Rule Name       | Pattern             | Level        |
|----------------|---------------------|--------------|
| Project Phoenix | `\bPhoenix\b`       | RESTRICTED   |
| Our CRM name   | `\bSalesforce\b`    | CONFIDENTIAL |
| Runway mention  | `\brunway\b`        | CONFIDENTIAL |

---

## Sites Covered
- chatgpt.com / chat.openai.com
- claude.ai
- gemini.google.com
- copilot.microsoft.com
- perplexity.ai
- bing.com (Copilot)

---

## Detection Layers
1. **Regex patterns** — API keys, emails, phones, credit cards, SSNs, revenue figures
2. **Keyword matching** — financial terms, M&A terms, HR terms, strategic secrets
3. **Semantic heuristics** — implied sensitive context ("between us", "term sheet closing")
4. **Custom rules** — your company-specific codenames and keywords
