import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

const VAULT = /^0x[0-9a-f]{40}$/;
const ROOT = /^0x[0-9a-f]{64}$/;
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
const MAX_ADDRS = 1000;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const vault = String(req.query.vault ?? "").toLowerCase();
    const root = String(req.query.root ?? "").toLowerCase();
    if (!VAULT.test(vault)) return res.status(400).json({ error: "vault" });
    if (!ROOT.test(root)) return res.status(400).json({ error: "root" });
    const data = await kv.get(`wl:${vault}:${root}`);
    if (!data) return res.status(404).json({ error: "not_found" });
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const vault = String(body.vault ?? "").toLowerCase();
    const root = String(body.root ?? "").toLowerCase();
    const addresses = Array.isArray(body.addresses) ? body.addresses : null;

    if (!VAULT.test(vault)) return res.status(400).json({ error: "vault" });
    if (!ROOT.test(root)) return res.status(400).json({ error: "root" });
    if (!addresses || addresses.length === 0 || addresses.length > MAX_ADDRS)
      return res.status(400).json({ error: "addresses" });
    for (const a of addresses) {
      if (typeof a !== "string" || !ADDR.test(a))
        return res.status(400).json({ error: "addr_format" });
    }

    await kv.set(
      `wl:${vault}:${root}`,
      { vault, root, addresses },
      { ex: TTL_SECONDS },
    );
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "method" });
}
