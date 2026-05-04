import { initSDK, createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/web";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { SEALPAD_ADDRESS } from "@/config/contracts";
import { SEPOLIA_RPC_URL } from "@/config/wagmi";

let instance: FhevmInstance | null = null;
let initPromise: Promise<FhevmInstance> | null = null;

function toHex(value: unknown): `0x${string}` {
  if (typeof value === "string" && value.startsWith("0x"))
    return value as `0x${string}`;
  if (value instanceof Uint8Array) {
    return ("0x" +
      Array.from(value)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")) as `0x${string}`;
  }
  return ("0x" + String(value)) as `0x${string}`;
}

export async function getFhevmInstance(): Promise<FhevmInstance> {
  if (instance) return instance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await initSDK();
      const inst = await createInstance({
        ...SepoliaConfig,
        network: SEPOLIA_RPC_URL,
      });
      instance = inst;
      return inst;
    } catch (err) {
      // Reset so the next caller can retry instead of being permanently
      // wedged on a rejected promise (e.g. transient relayer SDK boot failure).
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export async function encryptBidAmount(
  userAddress: string,
  amount: number | bigint,
): Promise<{ handle: `0x${string}`; inputProof: `0x${string}` }> {
  const inst = await getFhevmInstance();
  const input = inst.createEncryptedInput(SEALPAD_ADDRESS, userAddress);
  input.add64(BigInt(amount));
  const encrypted = await input.encrypt();

  return {
    handle: toHex(encrypted.handles[0]),
    inputProof: toHex(encrypted.inputProof),
  };
}

/**
 * Ask the KMS network to publicly decrypt a list of euint64 handles that
 * were marked decryptable via FHE.makePubliclyDecryptable on-chain (e.g. by
 * SealPad.finalize). Returns the cleartext values aligned with the input
 * `handles` order, plus a signature/proof bundle that the contract verifies
 * via FHE.checkSignatures during settleFixed / settleDutch.
 */
export async function publicDecryptHandles(
  handles: `0x${string}`[],
): Promise<{ values: bigint[]; proof: `0x${string}` }> {
  const inst = await getFhevmInstance();
  const result = await inst.publicDecrypt(handles);

  // clearValues is a Record<handle, bigint | boolean | hex>; case-insensitive lookup.
  const lookup = new Map<string, bigint | boolean | string>();
  for (const [k, v] of Object.entries(result.clearValues)) {
    lookup.set(k.toLowerCase(), v as bigint | boolean | string);
  }

  const values = handles.map((h) => {
    const v = lookup.get(h.toLowerCase());
    if (v === undefined) {
      throw new Error(`No decrypted value returned for handle ${h}`);
    }
    if (typeof v === "bigint") return v;
    if (typeof v === "boolean") return v ? 1n : 0n;
    return BigInt(v);
  });

  return { values, proof: result.decryptionProof };
}
