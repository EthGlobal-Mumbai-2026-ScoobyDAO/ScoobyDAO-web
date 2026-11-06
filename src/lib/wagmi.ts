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
// Without a WalletConnect project id, only browser-extension wallets are offered:
// initialising WalletConnect with a fake id logs 403/400 errors on every page.
const hasWalletConnect = env.walletConnectProjectId !== '';
const connectors = connectorsForWallets(
  hasWalletConnect
    ? [
        { groupName: 'Recommended', wallets: [metaMaskWallet, rabbyWallet] },
        { groupName: 'Others', wallets: [walletConnectWallet, injectedWallet] },
      ]
    : [{ groupName: 'Browser wallets', wallets: [injectedWallet] }],
  { appName: 'Unmasked', projectId: env.walletConnectProjectId || 'unset' },
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [sepolia],
  transports: { [sepolia.id]: http(env.sepoliaRpcUrl) },
  ssr: true,
});
