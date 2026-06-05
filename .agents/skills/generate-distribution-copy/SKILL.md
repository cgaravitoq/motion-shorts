---
name: generate-distribution-copy
description: >
  Use when the user wants publishing copy for an episode -- YouTube Shorts title/description,
  TikTok caption, Instagram Reels caption, or a LinkedIn post matched to a rendered (or
  in-progress) short. Defer to this skill whenever the user says "write the copy", "dame la
  descripción", "prepare the LinkedIn post", or "copy de publicación" for an episode slug.
  Produces a validated src/episodes/<slug>/distribution.json with per-platform approval.
  Skip for drafting the narration script itself (that is canonical-short / produce-from-source).
---

# Generate distribution copy

> **CWD**: all bash commands assume `cd apps/hyperframe` first.

Turn an episode into paste-ready, per-platform publishing copy persisted as a typed sidecar: `src/episodes/<slug>/distribution.json`. The text fields ARE the final paste-ready copy — hashtags inline, nothing to assemble later. Manual publish (copy-paste into each platform) is the supported flow today; automated publish consumes the same file later.

## 1. Resolve episode context

```bash
bun run scripts/episode-context.mjs <slug>
```

Returns narration (break tags stripped), `meta.json`, the scene-spec (titles, stats, quotes, sources live in the slots), captions duration, and `renderRef` (the rendered mp4's R2 key + sha256), plus warnings for anything missing. Draft from THIS context — the copy must match what the video actually says. If a stat or source is not in the context, do not invent it (`[TODO: verify source]` per the copy contract).

## 2. Draft per-platform copy

Load `references/publishing-copies.md` for tone and format per platform. **Hybrid voice contract**: YouTube/Instagram/TikTok are channel style (emoji bullets, 5-7 hashtags); LinkedIn is the user's personal voice (prose, zero emojis, no em dashes, ≤3 hashtags — gated in step 5). ES + EN for every platform, same hashtag set across languages within a platform.

Hard limits (enforced by `copy:check`):

| Platform | Field | Hard limit |
|---|---|---|
| youtube | `title` | 100 chars, no `<` `>` |
| youtube | `description` | 5000 UTF-8 **bytes**, no `<` `>`, ≤15 hashtags |
| instagram | `caption` | 2200 chars, ≤30 hashtags |
| tiktok | `caption` | 2200 UTF-16 chars (single field, hashtags inline) |
| linkedin | `post` | 3000 chars (hashtags count; hook in first ~140 chars) |

House style (warning, not error): 5-7 hashtags on channel platforms, 0-3 on LinkedIn, same set across ES/EN.

## 3. Write distribution.json

`src/episodes/<slug>/distribution.json`:

```json
{
  "slug": "<slug>",
  "renderRef": { "sha256": "<from context>", "key": "<R2 key>", "runId": "<runId>" },
  "platforms": {
    "youtube":   { "status": "draft", "es": { "title": "…", "description": "…" }, "en": { "…": "…" } },
    "instagram": { "status": "draft", "es": { "caption": "…" }, "en": { "…": "…" } },
    "tiktok":    { "status": "draft", "es": { "caption": "…" }, "en": { "…": "…" } },
    "linkedin":  { "status": "draft", "es": { "post": "…" }, "en": { "…": "…" } }
  }
}
```

- `renderRef` comes from the context output; omit it (`null`) if the episode is not rendered yet.
- Every platform starts as `"draft"`. Only include platforms the user wants.

## 4. Validate

```bash
bun run copy:check src/episodes/<slug>/distribution.json
```

Fix every error; resolve or consciously accept warnings. Re-run until clean.

## 5. Voice-gate the LinkedIn copy

LinkedIn copy must pass the humanizer critic rubric against the user's voice profile:

```bash
bun run copy:gate <slug>                                  # partial: 5 deterministic signals
bun run copy:gate <slug> --llm-signals=/tmp/critic.json   # full: 8 signals, mean ≥ 7.5
```

For the full verdict, act as the critic yourself: read the LinkedIn draft and the compiled voice profile (`<personal-vault>/.humanizer-cache/voice-profile.compiled.json`; the vault path comes from `~/.config/humanizer/config.toml` or `HUMANIZER_PERSONAL_VAULT_PATH` — focus on `communication_style` and `anti_patterns`), score the 3 LLM signals honestly, and write the JSON before running the gate:

```json
{
  "llm_signals": {
    "thematic_burstiness": { "score": 0, "detail": "…", "suggested_fix": "…" },
    "hook_quality": { "score": 0, "detail": "…" },
    "structure": { "score": 0, "detail": "…" }
  }
}
```

Iterate the draft until both ES and EN pass. The humanizer repo location defaults to `~/Developer/humanizer` (override with `--humanizer` or `HUMANIZER_REPO_PATH`).

## 6. HITL approval (Gate 1 — copy)

Present each platform's copy to the user **per platform** (not as one blob). Iterate on rejected platforms only — same contract as per-scene QA. On explicit approval of a platform, set its `status` to `"approved"` and re-run `copy:check`.

Approval rules enforced by the validator:
- `approved` requires `renderRef.sha256` matching the episode's current `render.remote.json` — you cannot approve copy against an unrendered or re-rendered episode.
- A re-render changes the mp4 sha256: `copy:check` then fails every `approved` platform. Reset them to `draft`, refresh `renderRef` from the new context, and re-review.

Approving copy does NOT authorize publishing (Gate 2 lives with the publish step of the roadmap).

## 7. Persist and mirror

After any change to distribution.json (new draft, edits, approvals):

```bash
bun run copy:sync <slug>   # push the sidecar to R2 + patch source.remote.json
```

Then archive/mirror to the Notion **🎞️ Shorts Archive** following `references/notion-archive-page.md`: upsert the episode's page by `Asset Slug` (create on zero matches, update on one, abort on multiple) and replace the managed "📣 Publishing copies" section with per-platform status + the render sha pin. **One-way only**: Notion is the archive/visualization surface; edits go to distribution.json and re-mirror, never the reverse.

If Notion MCP is unavailable, skip the archive with a warning — the sidecar + R2 remain the source of truth either way.

## Notes

- distribution.json follows the episode's commit policy: demos may be committed; personal episodes stay out of git like the rest of their content.
