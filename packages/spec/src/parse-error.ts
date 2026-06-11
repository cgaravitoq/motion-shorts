import { Cause, Exit, Option, Result, type Schema, SchemaIssue } from "effect";

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

const formatPath = (path: ReadonlyArray<PropertyKey>): string => {
  let out = "";
  for (const segment of path) {
    out +=
      typeof segment === "number" ? `[${segment}]` : out ? `.${String(segment)}` : String(segment);
  }
  return out;
};

export const formatParseError = (error: Schema.SchemaError, root = "spec"): string[] =>
  formatter(error.issue).issues.map((issue) => {
    const path = formatPath((issue.path ?? []) as ReadonlyArray<PropertyKey>);
    return path ? `${root}.${path}: ${issue.message}` : `${root}: ${issue.message}`;
  });

/**
 * Adapt a v4 decode Exit to a Result so boundary call sites keep a simple
 * isFailure/failure contract (the v3 decodeUnknownEither shape).
 */
export const exitToResult = <A>(
  exit: Exit.Exit<A, Schema.SchemaError>,
): Result.Result<A, Schema.SchemaError> => {
  if (Exit.isSuccess(exit)) return Result.succeed(exit.value);
  const failure = Cause.findErrorOption(exit.cause);
  if (Option.isSome(failure)) return Result.fail(failure.value);
  throw new Error(Cause.pretty(exit.cause));
};
