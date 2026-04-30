import { http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

export const config = getDefaultConfig({
  appName: "SealPad",
  projectId: "00000000000000000000000000000000", // placeholder WalletConnect project ID
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC_URL),
  },
});
