import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { Toaster } from "sonner";
import "./index.css";
import App from "./App";
import { config } from "./config/wagmi";

const queryClient = new QueryClient();

// RainbowKit theme — Saturn Credit aesthetic (orange + obsidian + 0.69px radii)
const theme = lightTheme({
  accentColor: "#FF5100",
  accentColorForeground: "#FFFFFF",
  borderRadius: "none",
  fontStack: "system",
  overlayBlur: "small",
});

theme.colors.connectButtonBackground = "#181818";
theme.colors.connectButtonText = "#FFFFFF";
theme.colors.connectButtonInnerBackground = "#2A2A2A";
theme.colors.modalBackground = "#FFFFFF";
theme.colors.modalText = "#181818";
theme.colors.modalTextSecondary = "#686868";
theme.colors.actionButtonBorder = "rgba(24, 24, 24, 0.10)";
theme.colors.actionButtonSecondaryBackground = "#F5F5F5";
theme.colors.menuItemBackground = "#F5F5F5";
theme.colors.profileForeground = "#FFFFFF";
theme.colors.generalBorder = "rgba(24, 24, 24, 0.10)";
theme.colors.closeButton = "#181818";
theme.colors.closeButtonBackground = "#F5F5F5";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme}>
          <Toaster richColors position="top-right" />
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
