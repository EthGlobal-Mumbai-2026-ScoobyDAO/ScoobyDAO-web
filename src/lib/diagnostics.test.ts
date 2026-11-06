import { describe, expect, it } from 'vitest';
import { parseDiagnostics } from './diagnostics';
const d = {
  candidate_id: '1:0x' + '1'.repeat(40),
  label: 'TEST',
  state: 'draft_pending_review',
  detail: 'Synthetic test',
  updated: 1793978327,
  provenance: 'user_requested_historical_diagnostic',
  case_admitted: false,
  world_verified: false,
  attempt: {
    candidate_id: '1:0x' + '1'.repeat(40),
    run_id: 'run1',
    report_id: 'report',
    report_version: 'v1',
    report_sha256: 'a'.repeat(64),
    model_status: 'completed_pending_review',
  },
  report: { id: 'report', version: 'v1', sha256: 'a'.repeat(64) },
};
describe('historical diagnostic status', () => {
  it('accepts a linked report but rejects a substituted identity or digest', () => {
    expect(parseDiagnostics([d])[0].report?.id).toBe('report');
    expect(() =>
      parseDiagnostics([{ ...d, report: { ...d.report, sha256: 'b'.repeat(64) } }]),
    ).toThrow('binding');
    expect(() => parseDiagnostics([{ ...d, world_verified: true }])).toThrow('Invalid diagnostic');
    expect(() => parseDiagnostics([d, d])).toThrow('Invalid diagnostic');
  });
});
