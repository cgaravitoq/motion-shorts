import type { PublishLedger, PublishRecord } from "@cgaravitoq/spec";

export type { PublishLedger, PublishRecord };

export const upsertPublishRecord = ({
  ledger,
  slug,
  platform,
  record,
  now,
}: {
  ledger: PublishLedger | null;
  slug: string;
  platform: string;
  record: PublishRecord;
  now: Date;
}): PublishLedger => ({
  slug,
  updatedAt: now.toISOString(),
  platforms: { ...(ledger?.platforms ?? {}), [platform]: record },
});
