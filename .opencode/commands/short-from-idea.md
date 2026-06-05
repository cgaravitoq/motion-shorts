---
description: Produce a motion-short from a raw idea or source URL
agent: short-producer
---

Run the motion-shorts production pipeline for this input:

```text
$ARGUMENTS
```

Use the repo-local `short-producer` flow:

1. Classify whether this is a raw idea, source URL, existing script, or existing episode.
2. Route through the required strategy, research, visual direction, audio, composition, QA, distribution-copy, and publishing stages.
3. Stop at the script, audio, and render approval gates.
4. Do not commit, push, upload, update Notion, or open a PR unless explicitly authorized in the conversation.
