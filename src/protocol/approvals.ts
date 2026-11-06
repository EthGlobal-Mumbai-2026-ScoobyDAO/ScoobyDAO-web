import { formatUnits, maxUint256, type Abi, type Address, type PublicClient } from 'viem';
import type { ApproveOpts, TxStep } from './types';

// ERC-20 approvals for V2 plans. The default approves exactly the amount the next step spends;
// an unlimited (maxUint256) approval only happens when the user turns the toggle on.

export interface Token {
  address: Address;
  abi: Abi | readonly unknown[];
  symbol: string;
  decimals: number;
}

export async function allowanceOf(client: PublicClient, token: Token, owner: Address, spender: Address): Promise<bigint> {
  return (await client.readContract({ address: token.address, abi: token.abi as Abi, functionName: 'allowance', args: [owner, spender] })) as bigint;
}

/** An approve step when the current allowance is below `amount`, else nothing. */
export async function approvalStep(p: {
  client: PublicClient;
  chainId: number;
  token: Token;
  owner: Address;
  spender: Address;
  spenderLabel: string;
  amount: bigint;
  opts?: ApproveOpts;
}): Promise<TxStep[]> {
  if ((await allowanceOf(p.client, p.token, p.owner, p.spender)) >= p.amount) return [];
  const unlimited = !!p.opts?.unlimited;
  return [
    {
      label: `Approve ${unlimited ? 'unlimited' : formatUnits(p.amount, p.token.decimals)} ${p.token.symbol} for ${p.spenderLabel}`,
      chainId: p.chainId,
      request: { address: p.token.address, abi: p.token.abi as Abi, functionName: 'approve', args: [p.spender, unlimited ? maxUint256 : p.amount] },
    },
  ];
}
