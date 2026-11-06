import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ReferenceCaseCard,
  ReferenceCaseList,
  selectReferenceCases,
} from '@/components/reference/ReferenceCases';
import { caseItemFor } from '@/test/referenceFixtures';
import {
  REFERENCE_PAIRS,
  allowedCaseActions,
  referenceReaderHref,
  snapshotExpired,
  toReferenceCase,
  type PublicCaseItem,
} from './reference';

// Written out literally from the contract table, independent of REFERENCE_PAIRS, so a typo in either fails here.
const CONTRACT: [string, string, string, string, string][] = [
  [
    'SHIB',
    'ac40e79f2e6e1cc2d011d487d8a9d259700591f0f1f85f46bfa22fcd171b25ea',
    'case-shib_reference_research',
    'run-shib_reference_replay_20261107',
    '13cfdb303407895cb1c9cf1913a138ac0191c694517606e3f2a3fa5c00bbea99',
  ],
  [
    'FET',
    '7b460f8e9e93aa02d7c6425b1450ec6e30c97c0beab9539a94261c4ce4daa0b8',
    'case-reference_fet',
    'run-reference_fet_20261107',
    'a697d2932eb2b9628229cc4283f1c1d28058953fcfdc20b37f6481ca2d0d923e',
  ],
  [
    'SPX',
    'bbe3daeeccbe5273e4a1f742a6a872dea08e7d8313e99de4ac3ccb6203d04800',
    'case-reference_spx',
    'run-reference_spx_20261107',
    '3f6bea48fd347c4ed8477b12ca10f53d8e06e2714ac4600f96808f78acabc854',
  ],
  [
    'YFI',
    'a7b75ac2adac7deb04fb9b11dacd165eb32a03f49c192b76ae654f6a8ee49e92',
    'case-reference_yfi',
    'run-reference_yfi_20261107',
    '27e70de305585ebac702bcd3c041fe8d952455bbc3d3555de2bad33473d32ef9',
  ],
  [
    'GRT',
    '2f156e0056d0629c85967e90b8023ba8f7cbc827462f93a00fb021125ce16b89',
    'case-reference_grt',
    'run-reference_grt_20261107',
    '70de2083725d70dae6874e803667527bf84d4ac303ffb97110ab5530aada7a01',
  ],
  [
    'METIS',
    '72557d92517b2a7e6ac0cea716bc3ca5006c78c8bfc27e3b8eb89fa5ff82b5ab',
    'case-reference_metis',
    'run-reference_metis_20261107',
    '8bdbe633a92fdaebb57b7bd68af0dbb9f4f048b844a91f05f28f7fbd1f8541bd',
  ],
];
const CANDIDATES: Record<string, string> = {
  SHIB: '1:0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
  FET: '1:0xaea46a60368a7bd060eec7df8cba43b7ef41ad85',
  SPX: '1:0xe0f63a424a4439cbe457d80e4f4b51ad25b2c56c',
  YFI: '1:0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
  GRT: '1:0xc944e90c64b2c07662a292be6244bdf05cda44a7',
  METIS: '1:0x9e32b13ce7f2e80a01932b42553652e053d6ed8e',
};

describe('six reference pairs', () => {
  it('pins exactly the contract table', () => {
    expect(
      REFERENCE_PAIRS.map((p) => [
        p.symbol,
        p.case_id,
        p.report_id,
        p.report_version,
        p.report_sha256,
      ]),
    ).toEqual(CONTRACT);
    for (const p of REFERENCE_PAIRS) expect(p.candidate_id).toBe(CANDIDATES[p.symbol]);
  });

  it.each(CONTRACT)(
    '%s case card links to exactly its report version',
    (symbol, caseId, reportId, version) => {
      const pair = REFERENCE_PAIRS.find((p) => p.symbol === symbol)!;
      const c = toReferenceCase(caseItemFor(pair) as PublicCaseItem)!;
      expect(c.pair.case_id).toBe(caseId);
      expect(c.reports).toHaveLength(1);
      const href = referenceReaderHref(c.reports[0]);
      expect(href).toBe(`/admin/reviews/${reportId}/${version}/reference`);
      const html = renderToStaticMarkup(
        <ReferenceCaseCard c={c} now={Date.parse('2026-11-07T00:00:00Z')} />,
      );
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain('Historical reference — unreviewed');
      expect(html).toContain('Synthetic summary for');
      expect(html).toContain('Synthetic routing text.');
      expect(html).toContain('Snapshot expired');
      expect(html).toContain('Read report');
    },
  );

  it('withholds the link when the listed report does not match the pinned pair', () => {
    const pair = REFERENCE_PAIRS[0];
    const item = caseItemFor(pair);
    item.reference.reports[0].report_sha256 = '0'.repeat(64);
    const c = toReferenceCase(item as PublicCaseItem)!;
    expect(c.reports).toEqual([]);
    expect(c.mismatched).toHaveLength(1);
    const html = renderToStaticMarkup(<ReferenceCaseCard c={c} />);
    expect(html).not.toContain('Read report');
    expect(html).toContain('Report link withheld');
  });

  it('never treats an unpinned or rebound item as one of the six', () => {
    const pair = REFERENCE_PAIRS[1];
    expect(
      toReferenceCase(
        caseItemFor(pair, { candidate_id: '1:0x' + '1'.repeat(40) }) as PublicCaseItem,
      ),
    ).toBeNull();
    expect(
      toReferenceCase(caseItemFor(pair, { case_id: 'f'.repeat(64) }) as PublicCaseItem),
    ).toBeNull();
    expect(toReferenceCase(caseItemFor(pair, { reference: null }) as PublicCaseItem)).toBeNull();
    const { refs, unpinned } = selectReferenceCases([
      caseItemFor(pair, { case_id: 'f'.repeat(64) }) as PublicCaseItem,
      caseItemFor(REFERENCE_PAIRS[5]) as PublicCaseItem,
      caseItemFor(REFERENCE_PAIRS[0]) as PublicCaseItem,
      { case_id: 'x', candidate_id: 'y', reference: null },
    ]);
    expect(refs.map((r) => r.pair.symbol)).toEqual(['SHIB', 'METIS']);
    expect(unpinned).toBe(1);
  });

  it('offers no agent, World-attempt, investigation, refresh or onchain action on reference cases', () => {
    for (const pair of REFERENCE_PAIRS) {
      // Even if the backend wrongly sent an action URL, nothing is offered.
      const item = caseItemFor(pair, {
        continuation: {
          availability: 'available',
          action_url: `/scouting/cases/${pair.case_id}/challenge`,
        },
      }) as PublicCaseItem;
      expect(allowedCaseActions(item)).toEqual([]);
      const c = toReferenceCase(item)!;
      const html = renderToStaticMarkup(<ReferenceCaseList refs={[c]} unpinned={0} />);
      expect(html).not.toMatch(/<button|<form/);
      expect(html).not.toContain('/challenge');
      expect(html).not.toMatch(
        /challenge|investigat|continue|world attempt|scan|stake|refresh|onchain/i,
      );
      // The only link is the reader.
      expect(html.match(/href="([^"]+)"/g)).toEqual([
        `href="${referenceReaderHref(c.reports[0])}"`,
      ]);
    }
  });

  it('treats a missing, invalid or past expiry as expired', () => {
    const now = Date.parse('2026-11-07T00:00:00Z');
    expect(snapshotExpired(null, now)).toBe(true);
    expect(snapshotExpired('nonsense', now)).toBe(true);
    expect(snapshotExpired('2026-11-07T00:00:00Z', now)).toBe(true);
    expect(snapshotExpired('2026-11-08T00:00:00Z', now)).toBe(false);
  });
});
