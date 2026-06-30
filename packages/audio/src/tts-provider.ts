import { type Lang, MAX_TTS_CHARS, type SynthesizeOptions, type TTSProvider } from "./types";

/**
 * Shared scaffold for every TTS provider. The boilerplate that all providers
 * repeat — client construction, default resolution, the synthesize guards
 * (empty text + char cap), and the empty-buffer check — lives here once.
 *
 * The per-provider delta is supplied as a small {@link TTSProviderConfig}:
 * how to build the client, how to resolve defaults, and how to turn the
 * resolved request into audio bytes.
 */
export interface ResolvedDefaults {
  voiceId: string;
  modelId: string;
}

export interface SynthesizeContext<TClient> {
  client: TClient;
  text: string;
  voiceId: string;
  modelId: string;
  opts: SynthesizeOptions;
}

export interface TTSProviderConfig<TClient> {
  /** Stable provider id surfaced on `provider.name` (e.g. "elevenlabs"). */
  name: string;
  /** Human-facing provider name used in credit/dashboard error copy (e.g. "ElevenLabs"). */
  displayName: string;
  /** Noun for the empty-audio guard — ElevenLabs streams, Inworld buffers. */
  emptyBufferNoun: "stream" | "buffer";
  /** Build the SDK client from an API key. */
  createClient(apiKey: string): TClient;
  /** Env var name surfaced in the missing-key error (e.g. ELEVENLABS_API_KEY). */
  apiKeyEnvName: string;
  /** Read the API key from env (returns undefined when unset). */
  readApiKey(): string | undefined;
  /** Resolve the voice + model for a synthesize call, throwing when unconfigured. */
  resolveDefaults(opts: { lang: Lang; voice?: string; model?: string }): ResolvedDefaults;
  /** Turn the resolved request into audio bytes via the provider SDK. */
  synthesize(ctx: SynthesizeContext<TClient>): Promise<Buffer>;
}

export interface ProviderConstructorOptions<TClient> {
  apiKey?: string;
  client?: TClient;
}

export abstract class BaseTTSProvider<TClient> implements TTSProvider {
  readonly name: string;
  protected readonly client: TClient;
  private readonly config: TTSProviderConfig<TClient>;

  constructor(config: TTSProviderConfig<TClient>, opts: ProviderConstructorOptions<TClient> = {}) {
    this.config = config;
    this.name = config.name;
    if (opts.client) {
      this.client = opts.client;
      return;
    }
    const apiKey = opts.apiKey ?? config.readApiKey();
    if (!apiKey) {
      throw new Error(
        `${config.apiKeyEnvName} missing — set it in .env or pass opts.apiKey to ${this.constructor.name}`,
      );
    }
    this.client = config.createClient(apiKey);
  }

  resolveDefaults(opts: { lang: Lang; voice?: string; model?: string }): ResolvedDefaults {
    return this.config.resolveDefaults(opts);
  }

  async synthesize(text: string, opts: SynthesizeOptions): Promise<Buffer> {
    const label = this.constructor.name;
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new Error(`${label}.synthesize: text is empty`);
    }
    if (trimmed.length > MAX_TTS_CHARS) {
      throw new Error(
        `${label}.synthesize: text exceeds soft cap (${trimmed.length} > ${MAX_TTS_CHARS} chars). Refusing to burn ${this.config.displayName} credits.`,
      );
    }

    const { voiceId, modelId } = this.resolveDefaults({
      lang: opts.lang,
      voice: opts.voiceId,
      model: opts.modelId,
    });

    const buffer = await this.config.synthesize({
      client: this.client,
      text: trimmed,
      voiceId,
      modelId,
      opts,
    });

    if (buffer.length === 0) {
      throw new Error(
        `${label}.synthesize: API returned an empty audio ${this.config.emptyBufferNoun}. ` +
          "This usually means the request was silently rate-limited or the text " +
          `produced no phonemes — check the ${this.config.displayName} dashboard.`,
      );
    }
    return buffer;
  }
}
