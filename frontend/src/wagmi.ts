import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  arbitrumSepolia
} from 'wagmi/chains';
import {
  metaMaskWallet,
} from "@rainbow-me/rainbowkit/wallets";

export const config = getDefaultConfig({
  appName: 'Crowdfunds',
  projectId: 'YOUR_PROJECT_ID',
  chains: [
    arbitrumSepolia,
  ],
  ssr: true,
  wallets: [
    {
      groupName: "Recommended",
      wallets: [
        metaMaskWallet,
      ],
    },
  ],
});
