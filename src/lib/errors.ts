import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem';

/** Best human-readable reason from a viem/wagmi error, preferring the onchain revert string. */
export function revertReason(err: unknown): string {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const r = reverted.reason ?? reverted.data?.errorName;
      if (r) return r;
    }
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return 'You rejected the request in your wallet.';
    return err.shortMessage || err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
