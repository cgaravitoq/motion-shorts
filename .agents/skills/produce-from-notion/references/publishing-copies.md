# Publishing copies — tone & format

Load this file at **Stage 6 — Push to Notion** when writing publishing copies for YouTube, Instagram, and LinkedIn.

## Tone

Educational, data-backed, no clickbait. Same voice as the script.

## YouTube Shorts

**ES Titulo**: 60-90 chars, descriptive, includes the angle/proof (e.g. "+14% en Terminal Bench"). No emoji prefix.

**ES Descripcion**: 150-300 words, structured with emoji bullets, source link at the end, hashtags at the very end.
Example emoji bullets: 🔌 🔧 📊 🏛️ 📦

**EN Title/Description**: Direct translation of ES, same structure, identical hashtags.

## Instagram Reels

**ES Caption**: Punchier, 100-180 words, 📌 bullets for data points, leads with headline stat, hashtags at end.

**EN Caption**: Direct translation.

## TikTok

**ES Caption**: Very short, 1-2 sentences (under ~150 chars before hashtags), hook-first, no bullets. Hashtags inline at the end (TikTok has a single caption field; max 2200 UTF-16 chars total).

**EN Caption**: Direct translation.

## LinkedIn

**Personal voice, not channel style** — LinkedIn posts publish on the author's own profile, so the concrete voice rules (emoji use, punctuation, register, hedging) come from the author's compiled humanizer voice profile (`communication_style`, `anti_patterns`), not from this file. `bun run copy:gate <slug>` enforces them. Structural defaults the tool expects: running prose (no bullet lists, no data tables), 250-400 words, open with the problem, close on a concrete observation or open edge — no CTA, no engagement bait. Hashtags: at most 2-3, at the end.

**ES Post / EN Post**: Direct translation, same structure.

## Hashtags

5-7 per copy on channel platforms (YouTube, Instagram, TikTok). LinkedIn: at most 2-3 (voice profile rule). Mix of broad (#AIEngineering) + topic-specific (#PromptCaching). Same set across ES/EN within a platform.

## Code-block language

Always `javascript` for publishing-copies code blocks (matches the existing Notion entries (`short-03..08`) — Notion's monospaced rendering looks best in that lexer, not because they contain JS).

## Verifiability

If a stat can't be verified, leave `[TODO: verify source]` rather than inventing a URL.
