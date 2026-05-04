import {
  initSDK,
  createInstance,
  SepoliaConfig,
} from "@zama-fhe/relayer-sdk/web";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
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

/// Encrypts a bid/contribution amount targeting a specific SaleVault clone.
/// The vault address determines which contract's ACL the ciphertext is bound
/// to — sale tokens (and any FHE handles) live inside the clone, not the
/// factory.
export async function encryptBidAmount(
  vaultAddress: string,
  userAddress: string,
  amount: number | bigint,
): Promise<{ handle: `0x${string}`; inputProof: `0x${string}` }> {
  const inst = await getFhevmInstance();
  const input = inst.createEncryptedInput(vaultAddress, userAddress);
  input.add64(BigInt(amount));
  const encrypted = await input.encrypt();

  return {
    handle: toHex(encrypted.handles[0]),
    inputProof: toHex(encrypted.inputProof),
  };
}

/**
 * Sign an EIP-712 message and ask the KMS to decrypt a single ciphertext
 * handle that the caller already has ACL access to (e.g. their own
 * contribution / bid). The plaintext is returned directly to the caller —
 * this is the "user-decryption" flow, in contrast with publicDecryptHandles
 * which goes through `FHE.makePubliclyDecryptable` and exposes values to
 * everyone.
 *
 * Caller passes a `signTypedDataAsync` callback (from wagmi's
 * `useSignTypedData`) so this helper stays UI-agnostic.
 */
/// Shape we expose to the caller for signing — mutable version of the SDK's
/// readonly EIP-712 type bundle. wagmi's signTypedData expects this shape.
export type UserDecryptSignTypedDataArgs = {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: { [key: string]: { name: string; type: string }[] };
  primaryType: "UserDecryptRequestVerification";
  message: Record<string, unknown>;
};

export async function userDecryptOwnHandle(params: {
  vaultAddress: `0x${string}`;
  userAddress: `0x${string}`;
  handle: `0x${string}`;
  signTypedDataAsync: (
    args: UserDecryptSignTypedDataArgs,
  ) => Promise<`0x${string}`>;
}): Promise<bigint> {
  const inst = await getFhevmInstance();
  // Ephemeral keypair — never reused. The relayer wraps the cleartext to this
  // public key and only the matching private key (held in this browser tab)
  // can unwrap it.
  const keypair = inst.generateKeypair();

  // SDK takes seconds + days as numbers (not strings, despite some docs).
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 1;
  const contractAddresses = [params.vaultAddress];

  const eip712 = inst.createEIP712(
    keypair.publicKey,
    contractAddresses,
    startTimestamp,
    durationDays,
  );

  // The SDK returns readonly tuples; clone into mutable arrays before handing
  // off to wagmi/viem (their signature types reject readonly).
  const types: UserDecryptSignTypedDataArgs["types"] = {
    UserDecryptRequestVerification:
      eip712.types.UserDecryptRequestVerification.map((f) => ({
        name: f.name,
        type: f.type,
      })),
  };

  const signature = await params.signTypedDataAsync({
    domain: {
      name: eip712.domain.name,
      version: eip712.domain.version,
      chainId: Number(eip712.domain.chainId),
      verifyingContract: eip712.domain.verifyingContract as `0x${string}`,
    },
    types,
    primaryType: "UserDecryptRequestVerification",
    message: eip712.message as Record<string, unknown>,
  });

  const result = await inst.userDecrypt(
    [{ handle: params.handle, contractAddress: params.vaultAddress }],
    keypair.privateKey,
    keypair.publicKey,
    signature.replace(/^0x/, ""),
    contractAddresses,
    params.userAddress,
    startTimestamp,
    durationDays,
  );

  // Result is keyed by handle (case-insensitive in some SDK builds).
  const lookup = new Map<string, unknown>();
  for (const [k, v] of Object.entries(result)) {
    lookup.set(k.toLowerCase(), v);
  }
  const value = lookup.get(params.handle.toLowerCase());
  if (value === undefined) {
    throw new Error(`No decrypted value returned for handle ${params.handle}`);
  }
  if (typeof value === "boolean") return value ? 1n : 0n;
  return BigInt(value as string | number | bigint);
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
