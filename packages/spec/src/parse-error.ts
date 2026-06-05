import type { ParseResult } from "effect";
import { ArrayFormatter } from "effect/ParseResult";

const formatPath = (path: ReadonlyArray<PropertyKey>): string => {
  let out = "";
  for (const segment of path) {
    out += typeof segment === "number" ? `[${segment}]` : out ? `.${String(segment)}` : String(segment);
  }
  return out;
};

export const formatParseError = (error: ParseResult.ParseError, root = "spec"): string[] =>
  ArrayFormatter.formatErrorSync(error).map((issue) => {
    const path = formatPath(issue.path);
    return path ? `${root}.${path}: ${issue.message}` : `${root}: ${issue.message}`;
  });
