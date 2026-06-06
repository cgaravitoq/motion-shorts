import { Cause, Effect, Exit, Option } from "effect";

/**
 * Run an Effect as a Promise, rethrowing the ORIGINAL failure instead of a
 * FiberFailure wrapper — the imperative .mjs pipeline and its tests match on
 * error messages and instanceof.
 */
export const runPromiseOrThrow = async <A, E>(effect: Effect.Effect<A, E>): Promise<A> => {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) return exit.value;
  const failure = Cause.findErrorOption(exit.cause);
  throw Option.isSome(failure) ? failure.value : new Error(Cause.pretty(exit.cause));
};
