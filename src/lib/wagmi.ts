import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { env } from './env';

// Explicit wallet list: RainbowKit's default list pulls in the Coinbase CDP SDK,
// whose optional x402 deps don't resolve in the Next build (see NOTES.md).
const connectors = connectorsForWallets(
  [
    { groupName: 'Recommended', wallets: [metaMaskWallet, rabbyWallet] },
    { groupName: 'Others', wallets: [walletConnectWallet, injectedWallet] },
  ],
  { appName: 'Unmasked', projectId: env.walletConnectProjectId },
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [sepolia],
  transports: { [sepolia.id]: http(env.sepoliaRpcUrl) },
  ssr: true,
});
