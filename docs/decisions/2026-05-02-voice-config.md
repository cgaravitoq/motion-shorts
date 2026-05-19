# Voice config defaults + TTS tooling

**Date**: 2026-05-02

## Voice IDs

> Superseded for new shorts. See `docs/voice-config.md` for current voice selection.

The original validation used public ElevenLabs Voice Library narrators (one peninsular Castilian for ES, one tech-narration voice for EN). New shorts pick voices via `.env` (`ELEVENLABS_VOICE_ID_ES`, `ELEVENLABS_VOICE_ID_EN`) — no hardcoded IDs in the repo.

## Audio settings

```bash
--speed=1.0 --pause-sentence=300 --pause-clause=0
```

`pause-clause=0` eliminates unnatural mid-sentence gaps the model inserts at `:;--`. Flagged in user testing as the single biggest pacing issue.

## TTS pronunciation rules

Encoded in the canonical-short skill. Key rules for ES narration with `eleven_multilingual_v2`:
- Short acronyms with periods (`A.C.E.`) for letter-by-letter spelling
- English tech terms with Spanish cognates -> Spanish equivalents
- Numbers in words for ES (`diez por ciento`, not `10%`)
- **Always `afplay public/voice/<slug>/voice.mp3` BEFORE building HTML**

## Tooling

- **Audio duration probing**: Centralised in `packages/audio/src/ffprobe.ts` (`getAudioDurationSeconds(path)`)
- **Migration Remotion -> Hyperframes**: Completed 2026-05-02
