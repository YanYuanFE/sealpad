import type { Address, Hex } from "viem";

export type WhitelistData = {
  vault: string;
  root: string;
  addresses: Address[];
};

export async function publishWhitelist(payload: {
  vault: Address;
  root: Hex;
  addresses: Address[];
}): Promise<void> {
  const r = await fetch("/api/whitelist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    let msg = `publishWhitelist failed (${r.status})`;
    try {
      const err = (await r.json()) as { error?: string };
      if (err.error) msg += `: ${err.error}`;
    } catch {
      // ignore — keep generic message
    }
    throw new Error(msg);
  }
}

export async function fetchWhitelist(
  vault: Address,
  root: Hex,
): Promise<WhitelistData | null> {
  const url = `/api/whitelist?vault=${vault.toLowerCase()}&root=${root.toLowerCase()}`;
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`fetchWhitelist failed (${r.status})`);
  return (await r.json()) as WhitelistData;
}
