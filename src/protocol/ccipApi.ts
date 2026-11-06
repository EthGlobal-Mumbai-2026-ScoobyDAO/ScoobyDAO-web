import type { Hex } from 'viem';

// Chainlink's public message API: GET {NEXT_PUBLIC_CCIP_API}/v2/messages/{messageId}.
// Display only. On 6 Nov 2026 it answered with `access-control-allow-origin` echoing the caller's
// origin; if a browser still blocks it, the tracker falls back to the CCIP Explorer link and
// onchain reads (NOTES.md). Unknown fields are ignored; nothing here decides a vote.

export interface CcipApiMessage {
  status: string;
  sendTransactionHash?: Hex;
  receiptTransactionHash?: Hex;
  receiptBlockNumber?: number;
  readyForManualExecution?: boolean;
  sendTimestamp?: string;
}

export type CcipApiResult =
  | { ok: true; message?: CcipApiMessage } // message undefined: not indexed yet (404)
  | { ok: false; error: string };

const isHash = (v: unknown): v is Hex => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v);

export function parseCcipMessage(v: unknown): CcipApiMessage | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.status !== 'string' || !/^[A-Z_]{2,40}$/.test(o.status)) return undefined;
  return {
    status: o.status,
    sendTransactionHash: isHash(o.sendTransactionHash) ? o.sendTransactionHash : undefined,
    receiptTransactionHash: isHash(o.receiptTransactionHash) ? o.receiptTransactionHash : undefined,
    receiptBlockNumber: typeof o.receiptBlockNumber === 'number' && Number.isSafeInteger(o.receiptBlockNumber) ? o.receiptBlockNumber : undefined,
    readyForManualExecution: o.readyForManualExecution === true,
    sendTimestamp: typeof o.sendTimestamp === 'string' ? o.sendTimestamp : undefined,
  };
}

export async function fetchCcipMessage(
  messageId: Hex,
  opts: { base: string; fetchFn?: typeof fetch; timeoutMs?: number },
): Promise<CcipApiResult> {
  const f = opts.fetchFn ?? fetch;
  try {
    const res = await f(`${opts.base}/v2/messages/${messageId}`, {
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
      cache: 'no-store',
      credentials: 'omit',
    });
    if (res.status === 404) return { ok: true };
    if (!res.ok) return { ok: false, error: `CCIP API answered ${res.status}` };
    const message = parseCcipMessage(await res.json());
    return message ? { ok: true, message } : { ok: false, error: 'Unexpected CCIP API response' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
