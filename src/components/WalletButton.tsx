'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export function WalletButton() {
  return (
    <span className="whitespace-nowrap [&_button]:whitespace-nowrap">
      <ConnectButton
        label="Connect"
        chainStatus="none"
        showBalance={false}
        accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
      />
    </span>
  );
}
