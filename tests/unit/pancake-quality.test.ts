import{describe,it,expect}from'vitest';
import{qualityData,qualitySummary}from'../../src/lib/pancake-quality';
const base=()=>({page_id:'196059750263125',timezone:'Asia/Ho_Chi_Minh',source_configured:true,synced_at:'2026-01-02T03:00:00Z',observed_at:null,definition_version:1,days:[{day:'2026-01-01',conversations:10,with_phone:6,qualified:4,unlabelled:2,with_ad:7,excluded:1,unknown_eligibility:0}],tags:[{tag:'XTS',conversations:4},{tag:'Trùng khách',conversations:3}]});
describe('quality page contract',()=>{
 it('computes rates from received conversations, not an invented engaged denominator',()=>{const q=qualityData(base())!;expect(qualitySummary(q)).toMatchObject({total:10,phones:6,qualified:4,phoneRate:0.6,qualifiedRate:0.4,qualifiedPhoneRate:4/6});});
 it('does not manufacture zero for empty unobserved days',()=>{const b=base();b.days=[];b.tags=[];const q=qualityData(b)!;expect(qualitySummary(q).total).toBeNull();expect(qualitySummary(q).phoneRate).toBeNull();});
 it('rejects inconsistent qualification, missing fields, unsafe numbers and raw-phone tag labels',()=>{
  const a=base();a.days[0].qualified=7;expect(qualityData(a)).toBeNull();
  const b=base();b.days[0].conversations=Number.MAX_SAFE_INTEGER+1;expect(qualityData(b)).toBeNull();
  const c=base();c.tags[0].tag='Phone 0900000000';expect(qualityData(c)).toBeNull();
  const d=base();d.days[0].day='2026-02-30';expect(qualityData(d)).toBeNull();
 });
 it('preserves overlapping tag counts and prevents divide-by-zero',()=>{const b=base();b.tags=[{tag:'one',conversations:8},{tag:'two',conversations:7}];expect(qualityData(b)?.tags).toHaveLength(2);b.tags=[];b.days[0]={...b.days[0],conversations:0,with_phone:0,qualified:0,with_ad:0,unlabelled:0};const q=qualityData(b)!;expect(qualitySummary(q).qualifiedPhoneRate).toBeNull();});
});
