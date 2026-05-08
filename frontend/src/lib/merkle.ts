import { SimpleMerkleTree } from "@openzeppelin/merkle-tree";
import {
  encodePacked,
  getAddress,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from "viem";

export const EMPTY_ROOT =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export function isEmptyRoot(root: string | undefined | null): boolean {
  if (!root) return true;
  return root.toLowerCase() === EMPTY_ROOT;
}

// Matches SaleVault._checkWhitelist: keccak256(abi.encodePacked(user))
export function leafOf(addr: Address): Hex {
  return keccak256(encodePacked(["address"], [addr]));
}

export type MerkleBundle = {
  root: Hex;
  proofs: Record<Address, Hex[]>;
  count: number;
};

export function buildMerkleTree(addresses: Address[]): MerkleBundle {
  if (addresses.length === 0) {
    return { root: EMPTY_ROOT, proofs: {}, count: 0 };
  }
  const leafToAddress = new Map<Hex, Address>();
  const leaves = addresses.map((addr) => {
    const leaf = leafOf(addr);
    leafToAddress.set(leaf, addr);
    return leaf;
  });

  // SimpleMerkleTree uses sorted-pair keccak256 internally, which is exactly
  // what OZ MerkleProof.verify expects on-chain. Leaves are passed in
  // pre-hashed so they match the contract's single-hash leaf format.
  const tree = SimpleMerkleTree.of(leaves);

  const proofs: Record<Address, Hex[]> = {};
  for (const [i, leaf] of tree.entries()) {
    const addr = leafToAddress.get(leaf as Hex);
    if (!addr) continue;
    proofs[addr] = tree.getProof(i) as Hex[];
  }

  return { root: tree.root as Hex, proofs, count: addresses.length };
}

export type ParseResult = {
  addresses: Address[];
  invalid: string[];
};

export function parseAddressList(text: string): ParseResult {
  const tokens = text
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const addresses: Address[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (!isAddress(t)) {
      invalid.push(t);
      continue;
    }
    const checksummed = getAddress(t);
    const key = checksummed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push(checksummed);
  }
  return { addresses, invalid };
}

// Accept any of:
//   ["0x...", "0x..."]            — bare proof array
//   { "proof": [...] }             — wrapped form
//   { "proofs": { "0xUSER": [...] } }  — full bundle, looked up by `forAddress`
//   { "0xUSER": [...] }            — flat map, looked up by `forAddress`
export function tryParseProofJson(
  text: string,
  forAddress?: Address,
): Hex[] | null {
  const trimmed = text.trim();
  if (!trimmed) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (Array.isArray(parsed)) {
    return validateProofArray(parsed);
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.proof)) return validateProofArray(obj.proof);
    if (obj.proofs && typeof obj.proofs === "object" && forAddress) {
      const map = obj.proofs as Record<string, unknown>;
      const candidate =
        map[forAddress] ??
        map[forAddress.toLowerCase()] ??
        map[getAddress(forAddress)];
      if (Array.isArray(candidate)) return validateProofArray(candidate);
    }
    if (forAddress) {
      const candidate =
        obj[forAddress] ??
        obj[forAddress.toLowerCase()] ??
        obj[getAddress(forAddress)];
      if (Array.isArray(candidate)) return validateProofArray(candidate);
    }
  }
  return null;
}

function validateProofArray(arr: unknown[]): Hex[] | null {
  const result: Hex[] = [];
  for (const item of arr) {
    if (typeof item !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(item)) {
      return null;
    }
    result.push(item as Hex);
  }
  return result;
}

// Given a list of whitelisted addresses and a target wallet, returns the
// Merkle proof for that wallet, or null if the wallet isn't on the list.
// Lookup is case-insensitive. The returned proof is suitable for the
// SaleVault.contribute / .bid `merkleProof` argument.
export function getProofForAddress(
  addresses: Address[],
  target: Address,
): Hex[] | null {
  const lower = target.toLowerCase();
  const found = addresses.find((a) => a.toLowerCase() === lower);
  if (!found) return null;
  const checksummed = addresses.map((a) => getAddress(a));
  const bundle = buildMerkleTree(checksummed);
  return bundle.proofs[getAddress(found)] ?? null;
}
