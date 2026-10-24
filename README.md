# Green-hackathon
We started with an idea — stop startups leaking data to contractors and AI tools.

We built a complete product from scratch:

A 4-layer detection engine (regex → NLP → semantic → custom rules)
A working admin dashboard with Scanner, LLM Guard, Audit Log, Policy Config
A Chrome browser extension that intercepts typing on ChatGPT, Claude, Gemini, Copilot and Perplexity in real time
Two clickable demo UIs that open straight from the file
A 12-slide investor pitch deck
Three bugs hit us:

ES module imports broke the prototype on file:// — fixed by inlining everything
Inline <script> in the extension popup violated Chrome's MV3 Content Security Policy — fixed by moving JS to popup.js
IBAN and written-out currency amounts (14 thousand euros) weren't detected — fixed by adding proper patterns to the engine
We then read the IBM PDF and found the deck has real gaps — most critically an unfinished slide with literal placeholder text, no opening hook, no business model, and no close.

Where we landed: A working, demo-ready product with ~45 minutes of pitch writing left to be competition-ready.
