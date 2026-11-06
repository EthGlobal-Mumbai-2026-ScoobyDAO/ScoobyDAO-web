import { BaseError, ContractFunctionRevertedError, InsufficientFundsError, UserRejectedRequestError } from 'viem';

// Revert strings and custom errors from ../SmartContracts/src (V2 vault, hook, routers, CCIP
// sender/receiver, REP, YT) mapped to plain-language reasons. The code stays visible in brackets.
const HINTS: Record<string, string> = {
  // vault
  CLOSED: 'Stakes are closed: the report’s lock time has passed',
  SERIES_OR_AMOUNT: 'This vault doesn’t serve that report, or the amount is 0',
  DEPOSIT: 'Deposit amount must be above 0',
  AMOUNT: 'Amount must be above 0',
  RECIPIENT: 'Invalid position owner or YT receiver',
  YIELD: 'Simulated yield can only be injected before maturity while something is staked',
  RESOLVER: 'Only the resolver can propose, between maturity and the result deadline',
  PROPOSAL: 'A result was already proposed, or the outcome/evidence is empty',
  CHALLENGE: 'The challenge window is closed, or the proposal was already challenged',
  EVIDENCE: 'The evidence hash must be nonzero',
  ADJUDICATOR: 'Only the adjudicator can settle a challenged report that isn’t final',
  ADJUDICATION: 'Adjudication needs an outcome, evidence, and must happen by the result deadline',
  FINAL: 'This report is already final',
  PENDING: 'Can’t finalize yet: no proposal, the challenge window is still open, or it was challenged',
  NOT_FINAL: 'Principal claims open once the report is final',
  EXPIRED: 'The 90-day claim window has closed',
  INSOLVENT: 'The vault can’t release more than its principal',
  FEE: 'Fee check failed: the CCIP fee sent was below the quote, or the protocol fee can’t be claimed now',
  TOKEN_DELTA: 'The token moved a different amount than expected',
  // REP / YT / LP shares
  REP_BALANCE: 'Not enough REP',
  TO: 'Can’t transfer to the zero address',
  UNBACKED: 'Injected yield isn’t backed by dUSD',
  // hook
  BUY_INPUT: 'Buy amount is out of range, or the market has matured',
  SELL_INPUT: 'Sell amount is out of range, or the market has matured',
  BUY_DUST: 'Too small: this amount buys no YT on the curve',
  BUY_SIZE: 'Buy size is out of range',
  YT_RESERVE: 'Not enough YT in the pool for this buy; try a smaller amount',
  USDC_RESERVE: 'Not enough dUSD in the pool for this sale; try a smaller amount',
  RATE_BOUND: 'This trade would push the implied rate past the curve’s bounds; try a smaller amount',
  SWAP_LIMIT: 'Slippage: the pool would pay less than your minimum',
  EXACT_INPUT_OR_MATURED: 'The market has matured: no more swaps',
  DEADLINE: 'The transaction deadline passed before it was mined',
  HOOK_DATA: 'Malformed swap data',
  LIQUIDITY: 'Liquidity can’t be added now (after maturity, or a zero amount)',
  RATIO: 'The deposit doesn’t match the pool’s reserve ratio exactly; recompute the paired amount',
  MIN_SHARES: 'This deposit would mint fewer LP shares than your minimum',
  MIN_OUT: 'Removing liquidity would return less than your minimum',
  SHARES: 'Not enough LP shares',
  POOL: 'Wrong pool key for this hook',
  HOOK_OWNED_LIQUIDITY: 'Liquidity is hook-owned: use the hook’s addLiquidity/removeLiquidity',
  // routers
  INPUT: 'The deadline passed or the input amount is invalid',
  INPUT_DELTA: 'The router couldn’t settle the input amount',
  OUTPUT_DELTA: 'Slippage: the swap returned less than your minimum',
  YT_APPROVE: 'The router couldn’t approve the YT sale',
  // CCIP
  INTENT: 'Invalid CCIP intent: the source account must be your wallet and the amount at least the minimum',
  REMOTE_CLOSED: 'Cross-chain stakes are closed for this report',
  EXPIRED_OR_REPLAY: 'The CCIP intent expired or its nonce was already used; try again with a fresh nonce',
  UNSUPPORTED_CHAIN: 'The CCIP router doesn’t support this lane right now',
  REFUND: 'The excess CCIP fee couldn’t be refunded to your wallet',
  NO_FUNDS: 'Nothing left to recover for this message',
  SOURCE_ACCOUNT: 'Only the source payer can recover these funds, to their own address',
  OPERATOR: 'Only the recovery operator can recover an undecodable message',
  REENTRANT: 'Reentrancy guard',
  // custom errors
  TokenCallFailed: 'A token transfer failed: check your balance and allowance',
  InvalidRouter: 'Only the Chainlink CCIP router can call this',
  InvalidRecipient: 'Invalid token recipient',
  MaxSupplyExceeded: 'dUSD max supply exceeded',
  'ERC20: insufficient allowance': 'The token allowance is too low; approve first',
  'ERC20: transfer amount exceeds balance': 'Insufficient token balance',
};

/** "Plain reason (CODE)" for known codes, the code itself otherwise. */
export function explainRevert(code: string): string {
  const hint = HINTS[code];
  return hint ? `${hint} (${code})` : code;
}

/** Best human-readable reason from a viem/wagmi error, preferring the onchain revert string. */
export function revertReason(err: unknown): string {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const r = reverted.reason ?? reverted.data?.errorName;
      if (r) return explainRevert(r);
    }
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return 'You rejected the request in your wallet.';
    if (err.walk((e) => e instanceof InsufficientFundsError)) return 'Not enough ETH in your wallet for gas (and value) on this network.';
    return err.shortMessage || err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
