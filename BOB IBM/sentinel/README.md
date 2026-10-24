# Sentinel — Startup Data Protection Platform

A lightweight, browser-native data protection engine for startups. No server, no npm, no build step — just open `index.html`.

---

## Quick Start

```bash
# Clone / download the project, then:
open sentinel/index.html        # macOS
# or double-click sentinel/index.html in your file manager
# or serve locally for full ES module support:
npx serve sentinel
# then visit http://localhost:3000
```

> **Note:** Because Sentinel uses ES Modules (`import`/`export`), most modern browsers require files to be served over HTTP (not `file://`). Use `npx serve sentinel`, Python's `python -m http.server`, or any static file server. Chrome and Edge also work fine with `file://` for local modules in recent versions.

---

## What Sentinel Does

Sentinel is a **client-side data loss prevention (DLP)** engine that:

1. **Parses** free-form text into sentence-level chunks  
2. **Detects** sensitive patterns using 4 independent layers  
3. **Classifies** each chunk and the whole document with a sensitivity label  
4. **Enforces** policy actions (ALLOW / WARN / REDACT / BLOCK) based on context  
5. **Guards** LLM inputs by tokenising sensitive data before it leaves your system  

All processing happens entirely in the browser — no data is ever sent anywhere.

---

## File Structure

```
sentinel/
├── index.html          # Admin dashboard (single-page app)
├── style.css           # Styles
├── app.js              # UI wiring + tab logic
├── engine/
│   ├── parser.js       # Text → chunks
│   ├── detector.js     # 4-layer detection
│   ├── classifier.js   # Sensitivity labelling
│   ├── enforcer.js     # Enforcement actions
│   └── llm-guard.js    # Full pipeline for LLM inputs
└── data/
    └── rules.js        # Regex patterns, keyword lists, custom rules
```

---

## How Each Engine Layer Works

### Layer 1 — Regex Patterns (`detector.js`)
Scans each chunk against a library of compiled regular expressions:

| Pattern         | Level        |
|-----------------|--------------|
| API Keys        | RESTRICTED   |
| Passwords/Tokens| RESTRICTED   |
| Credit Cards    | RESTRICTED   |
| Private Keys    | RESTRICTED   |
| SSN             | RESTRICTED   |
| Email Addresses | CONFIDENTIAL |
| Phone Numbers   | CONFIDENTIAL |
| Revenue Figures | CONFIDENTIAL |
| IP Addresses    | INTERNAL     |

### Layer 2 — Entity Keywords (`detector.js`)
Matches keyword lists for domain-specific terms:

- **Financial**: runway, burn rate, cap table, ARR, MRR, EBITDA, dilution…
- **Legal**: NDA, term sheet, LOI, due diligence, indemnification…
- **M&A**: acquisition, merger, acquihire, closing, LBO, exclusivity…
- **HR**: salary, equity grant, vesting, severance, headcount, offer letter…

### Layer 3 — Heuristic Semantics (`detector.js`)
Rule-based intent analysis. Flags phrases like:
- `"never tell"`, `"between us"`, `"off the record"` → **RESTRICTED**
- `"acquire"`, `"burn rate"`, `"term sheet"`, `"runway"` → **CONFIDENTIAL**

### Layer 4 — Custom Rules (`detector.js` + `data/rules.js`)
User-defined regex rules with a name, pattern, label, and sensitivity level. Toggleable at runtime via the Policy Config tab.

---

## Sensitivity Levels

| Level        | Value | Meaning                                        |
|--------------|-------|------------------------------------------------|
| PUBLIC       | 0     | No restrictions                                |
| INTERNAL     | 1     | Internal use only — warn if shared externally  |
| CONFIDENTIAL | 2     | Handle with care — redact for LLM, warn for share/email |
| RESTRICTED   | 3     | Never allowed — always blocked in any context  |

---

## Enforcement Rules

| Label        | Context          | Action |
|--------------|------------------|--------|
| PUBLIC       | any              | ALLOW  |
| INTERNAL     | view / llm       | ALLOW  |
| INTERNAL     | share / email    | WARN   |
| CONFIDENTIAL | llm              | REDACT |
| CONFIDENTIAL | share / email    | WARN + flag |
| CONFIDENTIAL | view             | WARN   |
| RESTRICTED   | any              | BLOCK  |

---

## Adding Custom Rules

### Via UI (Policy Config tab)
1. Open the **Policy Config** tab  
2. Fill in **Rule Name**, **Regex Pattern**, and **Sensitivity Level**  
3. Click **+ Add Rule**  
4. The rule is immediately active in all subsequent scans  

### Via Code (`data/rules.js`)
Add an entry to the `customRules` array:

```js
{ 
  name:    'Project Aurora',   // Display name
  pattern: '\\bAurora\\b',    // JS regex string (escape backslashes)
  label:   'Project Codename', // Type label shown in results
  level:   LEVELS.RESTRICTED,  // LEVELS.PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED
  enabled: true 
}
```

---

## Dashboard Tabs

| Tab            | Purpose |
|----------------|---------|
| 🔍 Scanner      | Paste any text, pick a context, get chunk-by-chunk analysis and enforced output |
| 🤖 LLM Guard    | Check a prompt before it reaches an LLM — see original vs sanitised side-by-side |
| 📋 Audit Log    | Time-stamped log of all enforcement actions, filterable by action type |
| ⚙️ Policy Config | Browse active rules, toggle custom rules on/off, add new rules |

---

## Browser Compatibility

- Chrome 80+ ✅  
- Edge 80+ ✅  
- Firefox 80+ ✅  
- Safari 14+ ✅  

No polyfills, no transpilation, no dependencies.
