import { describe,expect,it } from 'vitest';
import { knownTotal,reportRange,type SnapshotRow } from '../../src/lib/report';
describe('DB report helpers',()=>{
 it('validates real dates and bounded ranges',()=>{
  expect(reportRange('2026-02-30','2026-03-01')).toBeNull();
  expect(reportRange(['2026-01-01'],'2026-01-02')).toBeNull();
  expect(reportRange('2026-02-01','2026-01-01')).toBeNull();
  expect(reportRange('2024-01-01','2026-01-01')).toBeNull();
  expect(reportRange(undefined,undefined,new Date('2026-01-02T18:00:00Z'))).toEqual({from:'2025-12-28',to:'2026-01-03'});
 });
 it('keeps missing distinct from zero',()=>{
  const r=(spend:number|string|null)=>({spend} as SnapshotRow);
  expect(knownTotal([],'spend')).toBeNull();
  expect(knownTotal([r(null),r(5)],'spend')).toBeNull();
  expect(knownTotal([r(0)],'spend')).toBe(0);
  expect(knownTotal([r('1.5'),r(2)],'spend')).toBe(3.5);
 });
});
