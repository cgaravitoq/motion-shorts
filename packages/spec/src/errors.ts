import { Data } from "effect";

export class SceneSpecInvalid extends Data.TaggedError("SceneSpecInvalid")<{
  readonly issues: ReadonlyArray<string>;
}> {
  override get message(): string {
    return `scene-spec invalid:\n${this.issues.map((issue) => `  - ${issue}`).join("\n")}`;
  }
}

export class ManifestInvalid extends Data.TaggedError("ManifestInvalid")<{
  readonly type: string;
  readonly version: number;
  readonly issues: ReadonlyArray<string>;
}> {
  override get message(): string {
    return `scene-type "${this.type}@${this.version}" manifest invalid:\n${this.issues
      .map((issue) => `  - ${issue}`)
      .join("\n")}`;
  }
}

export class UnknownSceneType extends Data.TaggedError("UnknownSceneType")<{
  readonly type: string;
  readonly version: number;
  readonly dir: string;
}> {
  override get message(): string {
    return `unknown scene-type "${this.type}@${this.version}" (looked in ${this.dir})`;
  }
}
