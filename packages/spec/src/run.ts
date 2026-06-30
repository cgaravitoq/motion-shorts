import { Cause, Effect, Exit, Option } from "effect";

export const runPromiseOrThrow = async <A, E>(effect: Effect.Effect<A, E>): Promise<A> => {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) return exit.value;
  const failure = Cause.findErrorOption(exit.cause);
  throw Option.isSome(failure) ? failure.value : new Error(Cause.pretty(exit.cause));
};
