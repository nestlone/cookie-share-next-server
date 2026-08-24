import type { DatabaseSync } from "node:sqlite";
import type { OAuthProviderId, ProviderAccount, ProviderAccountRow } from "../types";

function map(row: ProviderAccountRow): ProviderAccount {
  return { provider: row.provider, subject: row.subject, login: row.login, createdAt: row.created_at };
}

export class ProviderAccountStore {
  public constructor(private readonly db: DatabaseSync) {}

  public find(provider: OAuthProviderId, subject: string): ProviderAccountRow | undefined {
    return this.db.prepare("SELECT * FROM provider_accounts WHERE provider = ? AND subject = ?").get(provider, subject) as unknown as ProviderAccountRow | undefined;
  }

  public listForUser(userId: number): ProviderAccount[] {
    return (this.db.prepare("SELECT * FROM provider_accounts WHERE user_id = ? ORDER BY id ASC").all(userId) as unknown as ProviderAccountRow[]).map(map);
  }

  public create(userId: number, provider: OAuthProviderId, subject: string, login: string): ProviderAccount {
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO provider_accounts (user_id, provider, subject, login, created_at) VALUES (?, ?, ?, ?, ?)").run(userId, provider, subject, login, now);
    return { provider, subject, login, createdAt: now };
  }

  public delete(userId: number, provider: OAuthProviderId): boolean {
    return this.db.prepare("DELETE FROM provider_accounts WHERE user_id = ? AND provider = ?").run(userId, provider).changes > 0;
  }
}
