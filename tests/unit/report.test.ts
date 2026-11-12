import { describe, expect, it } from 'vitest';
import { knownTotal, monthStart, reportRange, type SnapshotRow } from '../../src/lib/report';
describe('DB report helpers', () => {
  it('validates real dates and bounded ranges', () => {
    expect(reportRange('2026-02-30', '2026-03-01')).toBeNull();
    expect(reportRange(['2026-01-01'], '2026-01-02')).toBeNull();
    expect(reportRange('2026-02-01', '2026-01-01')).toBeNull();
    expect(reportRange('2024-01-01', '2026-01-01')).toBeNull();
    expect(reportRange(undefined, undefined, new Date('2026-01-02T18:00:00Z'))).toEqual({
      from: '2025-12-28',
      to: '2026-01-03',
    });
  });
  it('widens the default start to the first of the month when asked', () => {
    const noon = (d: string) => new Date(`${d}T05:00:00Z`);
    expect(reportRange(undefined, undefined, noon('2026-11-12'), true)).toEqual({
      from: '2026-11-01',
      to: '2026-11-12',
    });
    // Early in the month the 7-day window already reaches further back.
    expect(reportRange(undefined, undefined, noon('2026-11-03'), true)).toEqual({
      from: '2026-10-28',
      to: '2026-11-03',
    });
    // An explicit range is never widened.
    expect(reportRange('2026-11-10', '2026-11-12', noon('2026-11-12'), true)).toEqual({
      from: '2026-11-10',
      to: '2026-11-12',
    });
    // Month start follows Vietnam time: 18:00 UTC on 31 Oct is already 1 Nov in Vietnam.
    expect(reportRange(undefined, undefined, new Date('2026-10-31T18:00:00Z'), true)?.to).toBe('2026-11-01');
    expect(monthStart('2026-02-28')).toBe('2026-02-01');
  });
  it('keeps missing distinct from zero', () => {
    const r = (spend: number | string | null) => ({ spend }) as SnapshotRow;
    expect(knownTotal([], 'spend')).toBeNull();
    expect(knownTotal([r(null), r(5)], 'spend')).toBeNull();
    expect(knownTotal([r(0)], 'spend')).toBe(0);
    expect(knownTotal([r('1.5'), r(2)], 'spend')).toBe(3.5);
  });
});
