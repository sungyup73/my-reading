# My Reading v0.1

A private, magazine-style English reading PWA.

## Features
- Today / Library / Words / Saved Sentences
- Paste full ChatGPT article and auto-parse metadata/body/vocabulary
- LocalStorage only: no API, no account, no database
- Mark articles read/unread
- Select a word and tap the article to save it
- Select a sentence and use “Save selected sentence”
- Installable PWA when served over HTTPS

## Article import format

DATE: 2026-08-10
CATEGORY: Forest & Ecology
TITLE: How Forests Create Their Own Rain
DEK: Optional short introduction.

ARTICLE:
Paragraph 1...

Paragraph 2...

VOCABULARY:
1. word | Korean meaning | English example sentence
2. expression | Korean meaning | English example sentence

## Run locally
You can open index.html directly for basic use, but PWA installation/service worker requires HTTPS or localhost.

Easy deployment options: GitHub Pages, Netlify, Vercel, Cloudflare Pages.
