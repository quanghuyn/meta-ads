import { describe, expect, it } from 'vitest';
import {
  metaMetricCoverage,
  metaSpendCoverage,
  receivedSpend,
  financeFromReceived,
} from '../../src/lib/meta-spend-coverage';

describe('received Meta count metrics', () => {
  it('retains impressions/clicks independently instead of confusing them with spend', () => {
    const rows = [
      {
        date: '2026-01-01',
        nk2: { spend: 10, impressions: 200, clicks: 5 },
        nk3: { spend: NaN, impressions: NaN, clicks: NaN },
      },
    ];
    expect(metaSpendCoverage(rows, '2026-01-01', '2026-01-01').total.received).toBe(10);
    const impressions = metaMetricCoverage(rows, '2026-01-01', '2026-01-01', 'impressions').total;
    const clicks = metaMetricCoverage(rows, '2026-01-01', '2026-01-01', 'clicks').total;
    expect(impressions).toMatchObject({ received: 200, complete: null, partial: true });
    expect(clicks).toMatchObject({ received: 5, complete: null, partial: true });
  });
  it('does not make count completeness follow spend completeness or replace an absent count with zero', () => {
    const rows = [
      {
        date: '2026-01-01',
        nk2: { spend: 10, impressions: 0, clicks: 0 },
        nk3: { spend: 20, impressions: NaN, clicks: NaN },
      },
    ];
    expect(metaSpendCoverage(rows, '2026-01-01', '2026-01-01').total.complete).toBe(30);
    expect(metaMetricCoverage(rows, '2026-01-01', '2026-01-01', 'impressions').total).toMatchObject({
      received: 0,
      complete: null,
    });
    expect(metaMetricCoverage(rows, '2026-01-01', '2026-01-01', 'clicks').total).toMatchObject({
      received: 0,
      complete: null,
    });
  });
});

describe('provisional received-data financial ratios', () => {
  it('shows CIR/CPA/ROAS from received expense without pretending the full total is known', () => {
    const f = financeFromReceived(receivedSpend([100, NaN]), 500, 2);
    expect(f.full).toEqual({ cir: null, roas: null, cpa: null });
    expect(f.received).toEqual({ cir: 0.2, roas: 5, cpa: 50 });
    expect(f.display).toEqual(f.received);
    expect(f.provisional).toBe(true);
  });
  it('uses full metrics unchanged when all configured source values are present', () => {
    const f = financeFromReceived(receivedSpend([40, 60]), 500, 2);
    expect(f.provisional).toBe(false);
    expect(f.full).toEqual({ cir: 0.2, roas: 5, cpa: 50 });
    expect(f.display).toEqual(f.full);
  });
  it('does not create expense or ratios when no source was received', () => {
    const f = financeFromReceived(receivedSpend([NaN, undefined]), 500, 2);
    expect(f.display).toEqual({ cir: null, roas: null, cpa: null });
  });
  it('keeps genuine received zero but never divides by zero revenue/orders/expense', () => {
    const zero = financeFromReceived(receivedSpend([0, NaN]), 500, 2);
    expect(zero.display).toEqual({ cir: 0, roas: null, cpa: 0 });
    expect(zero.full.cir).toBeNull();
    const noSale = financeFromReceived(receivedSpend([100, NaN]), 0, 0);
    expect(noSale.display).toEqual({ cir: null, roas: 0, cpa: null });
  });
  it('does not turn unknown POS data into zero', () => {
    const f = financeFromReceived(receivedSpend([100, NaN]), NaN, NaN);
    expect(f.display).toEqual({ cir: null, roas: null, cpa: null });
  });
});
