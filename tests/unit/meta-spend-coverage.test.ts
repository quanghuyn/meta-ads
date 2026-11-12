import { describe, expect, it } from 'vitest';
import { metaSpendCoverage, receivedSpend } from '../../src/lib/meta-spend-coverage';

const day = (date: string, nk2: number, nk3: number) => ({
  date,
  nk2: { spend: nk2, impressions: 0, clicks: 0 },
  nk3: { spend: nk3, impressions: 0, clicks: 0 },
});

describe('receivedSpend', () => {
  it('retains received spend without claiming a complete total when a source is missing', () => {
    expect(Number.isFinite(100 + NaN)).toBe(false);
    const result = receivedSpend([100, NaN]);
    expect(result).toEqual({ received: 100, complete: null, known: 1, expected: 2, partial: true });
    expect(Number.isFinite(result.received)).toBe(true);
    // A complete-spend CIR/ROAS denominator must remain unavailable.
    expect(result.complete).toBeNull();
  });

  it('distinguishes missing, explicit zero and complete sources', () => {
    expect(receivedSpend([NaN, undefined, null])).toEqual({ received: null, complete: null, known: 0, expected: 3, partial: true });
    expect(receivedSpend([0, NaN])).toEqual({ received: 0, complete: null, known: 1, expected: 2, partial: true });
    expect(receivedSpend([0, 20])).toEqual({ received: 20, complete: 20, known: 2, expected: 2, partial: false });
    expect(receivedSpend([0, 0]).complete).toBe(0);
  });

  it.each([-1, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid value %s', (value) => {
    expect(() => receivedSpend([value])).toThrow('invalid_received_spend');
  });

  it('rejects an unsafe total even when each value is valid', () => {
    expect(() => receivedSpend([Number.MAX_SAFE_INTEGER, 1])).toThrow('unsafe_received_spend_total');
  });

  it('does not mutate its input', () => {
    const values = Object.freeze([10, NaN, 0]);
    receivedSpend(values);
    expect(values).toEqual([10, NaN, 0]);
  });
});

describe('metaSpendCoverage', () => {
  it('accounts for each source and an entirely absent calendar day', () => {
    const result = metaSpendCoverage([day('2026-02-01', 10, NaN), day('2026-02-03', 0, 30)], '2026-02-01', '2026-02-03');
    expect(result).toEqual({
      days: 3,
      nk2: { received: 10, complete: null, known: 2, expected: 3, partial: true },
      nk3: { received: 30, complete: null, known: 1, expected: 3, partial: true },
      total: { received: 40, complete: null, known: 3, expected: 6, partial: true },
    });
  });

  it('distinguishes complete per-account coverage and combined partial coverage', () => {
    const result = metaSpendCoverage([day('2026-01-01', 0, 3), day('2026-01-02', 2, NaN)], '2026-01-01', '2026-01-02');
    expect(result.nk2).toEqual({ received: 2, complete: 2, known: 2, expected: 2, partial: false });
    expect(result.nk3).toEqual({ received: 3, complete: null, known: 1, expected: 2, partial: true });
    expect(result.total.complete).toBeNull();
  });

  it('returns null rather than zero for a fully missing calendar and complete totals for complete days', () => {
    expect(metaSpendCoverage([], '2026-01-01', '2026-01-02').total).toEqual({ received: null, complete: null, known: 0, expected: 4, partial: true });
    expect(metaSpendCoverage([day('2026-01-01', 0, 4)], '2026-01-01', '2026-01-01').total).toEqual({ received: 4, complete: 4, known: 2, expected: 2, partial: false });
  });

  it('ignores out-of-range rows including invalid spend and duplicate dates', () => {
    const rows = [day('2025-12-31', -1, Infinity), day('2025-12-31', 9, 9), day('2026-01-01', 1, 2), day('2026-01-02', -1, Infinity)];
    expect(metaSpendCoverage(rows, '2026-01-01', '2026-01-01').total.complete).toBe(3);
  });

  it('rejects duplicate in-range days', () => {
    expect(() => metaSpendCoverage([day('2026-01-01', 1, 2), day('2026-01-01', 3, 4)], '2026-01-01', '2026-01-01')).toThrow('duplicate_meta_coverage_day');
  });

  it.each([['2026-02-30', '2026-03-01'], ['not-a-date', '2026-01-01'], ['2026-01-02', '2026-01-01'], ['2024-01-01', '2025-01-02']])('rejects invalid range %s through %s', (from, to) => {
    expect(() => metaSpendCoverage([], from, to)).toThrow('invalid_meta_coverage_range');
  });

  it('accepts the inclusive 367-day limit and accounts for leap days', () => {
    expect(metaSpendCoverage([], '2024-01-01', '2025-01-01').days).toBe(367);
    expect(metaSpendCoverage([day('2024-02-29', 1, 2)], '2024-02-28', '2024-03-01').total).toEqual({ received: 3, complete: null, known: 2, expected: 6, partial: true });
  });

  it('rejects bad in-range spend and unsafe combined totals', () => {
    expect(() => metaSpendCoverage([day('2026-01-01', -1, 0)], '2026-01-01', '2026-01-01')).toThrow('invalid_received_spend');
    expect(() => metaSpendCoverage([day('2026-01-01', Infinity, 0)], '2026-01-01', '2026-01-01')).toThrow('invalid_received_spend');
    expect(() => metaSpendCoverage([day('2026-01-01', Number.MAX_SAFE_INTEGER, 1)], '2026-01-01', '2026-01-01')).toThrow('unsafe_received_spend_total');
  });

  it('does not mutate rows or nested measures', () => {
    const rows = [day('2026-01-02', 2, 3), day('2026-01-01', 1, NaN)];
    const before = structuredClone(rows);
    rows.forEach((row) => { Object.freeze(row.nk2); Object.freeze(row.nk3); Object.freeze(row); });
    Object.freeze(rows);
    metaSpendCoverage(rows, '2026-01-01', '2026-01-02');
    expect(rows).toEqual(before);
  });
});
