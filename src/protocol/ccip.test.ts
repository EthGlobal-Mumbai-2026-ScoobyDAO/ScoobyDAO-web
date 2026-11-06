import { concatHex, decodeAbiParameters, getAddress, toHex } from 'viem';
import { describe, expect, it } from 'vitest';
import { basicExtraArgsV3, buildIntentV1, buildIntentV2, ccipStatus, encodeIntentV1, isSlow, CCIP_GAS_LIMIT, CCIP_SLOW_MINUTES } from './ccip';

const A = getAddress('0x00000000000000000000000000000000000000a1');

describe('extraArgs (ExtraArgsCodec._getBasicEncodedExtraArgsV3(1_500_000, bytes4(0)))', () => {
  it('uses the 1,500,000 callback gas limit (500,000 failed the live delivery)', () => expect(CCIP_GAS_LIMIT).toBe(1_500_000));
  it('matches the bundle snippet byte for byte: tag ‖ uint32 gas ‖ bytes4 finality ‖ bytes7(0)', () => {
    // FRONTEND_INTEGRATION_PLAN.md: concatHex(['0xa69dd4aa', toHex(1_500_000, { size: 4 }), '0x00000000', '0x00000000000000'])
    const bundle = concatHex(['0xa69dd4aa', toHex(1_500_000, { size: 4 }), '0x00000000', '0x00000000000000']);
    expect(basicExtraArgsV3()).toBe(bundle);
    expect(basicExtraArgsV3()).toBe('0xa69dd4aa0016e3600000000000000000000000');
    expect((basicExtraArgsV3().length - 2) / 2).toBe(19);
  });
});

describe('stake intents', () => {
  it('V1 has exactly the StakeIntent.sol fields and round-trips through abi.encode', () => {
    const i = buildIntentV1({ reportId: 7n, yes: true, recipient: A, amount: 5_000_000n, lockTime: 2_000, nonce: 9n });
    expect(Object.keys(i)).toEqual(['protocolVersion', 'reportId', 'yes', 'recipient', 'nonce', 'deadline', 'minAmount']);
    expect(i).toMatchObject({ protocolVersion: 1n, deadline: 1_999n, minAmount: 5_000_000n });
    const [decoded] = decodeAbiParameters(
      [{ type: 'tuple', components: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }, { type: 'address' }, { type: 'uint256' }, { type: 'uint64' }, { type: 'uint256' }] }],
      encodeIntentV1(i),
    );
    expect(decoded).toEqual([1n, 7n, true, A, 9n, 1_999n, 5_000_000n]);
  });
  it('V2 has exactly the StakeIntentV2.sol fields, with sourceAccount = sender', () => {
    const i = buildIntentV2({ reportId: 1n, yes: false, sourceAccount: A, recipient: A, nonce: 3n, deadline: 99n, amount: 1n });
    expect(Object.keys(i)).toEqual(['protocolVersion', 'reportId', 'yes', 'sourceAccount', 'recipient', 'nonce', 'deadline', 'minAmount']);
    expect(i.protocolVersion).toBe(2);
    expect(i.sourceAccount).toBe(A);
  });
});

describe('tracker state from mocked logs', () => {
  const sent = { tx: '0x01' as const, at: 1_000 };
  it('credited', () => expect(ccipStatus({ sent, credited: { tx: '0x02' } })).toBe('credited'));
  it('held', () => expect(ccipStatus({ sent, held: { tx: '0x02' } })).toBe('held'));
  it('held then recovered', () => expect(ccipStatus({ sent, held: { tx: '0x02' }, recovered: { tx: '0x03' } })).toBe('recovered'));
  it('still in transit after N minutes is flagged slow', () => {
    expect(ccipStatus({ sent })).toBe('in_transit');
    expect(isSlow({ sent }, 1_000 + CCIP_SLOW_MINUTES * 60)).toBe(false);
    expect(isSlow({ sent }, 1_000 + CCIP_SLOW_MINUTES * 60 + 1)).toBe(true);
    expect(isSlow({ sent, credited: { tx: '0x02' } }, 1_000_000)).toBe(false);
  });
});
