export interface PublishRecord {
  status: "published" | "failed";
  id?: string;
  url?: string;
  publishedAt?: string;
  renderSha256: string;
  lang: string;
  privacy?: string;
  error?: string;
}

export interface PublishLedger {
  slug: string;
  updatedAt: string;
  platforms: Record<string, PublishRecord>;
}

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
