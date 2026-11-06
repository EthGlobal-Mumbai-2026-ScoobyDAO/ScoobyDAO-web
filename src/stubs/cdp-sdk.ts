// Stand-in for @coinbase/cdp-sdk. @base-org/account (via wagmi's baseAccount connector)
// imports CdpClient only for Base subscription payments, which this app never uses.
// The real SDK drags in optional x402 packages that don't resolve in the Next build.
export class CdpClient {
  constructor() {
    throw new Error('CdpClient is not available in this app');
  }
}
