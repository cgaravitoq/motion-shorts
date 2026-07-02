// Pause injection is permanently removed. ElevenLabs v3 paces natively from
// punctuation + sentence structure; SSML <break> and per-sentence [pause]
// injection both caused multi-second dead air and are never used.
export const isElevenV3Model = (modelId: string): boolean => modelId.toLowerCase() === "eleven_v3";
