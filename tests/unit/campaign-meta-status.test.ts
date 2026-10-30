import{describe,it,expect}from'vitest';
import{readCampaignMetaStatus,campaignStatusView,type CampaignMetaStatus}from'../../src/lib/campaign-meta-status';
const now=Date.parse('2026-10-30T10:00:00Z');
const snapshot=(p:Partial<CampaignMetaStatus>={}):CampaignMetaStatus=>({meta_status:'ACTIVE',meta_effective_status:null,meta_status_at:'2026-10-30T09:00:00Z',meta_status_source:'legacy_metadata',...p});
describe('honest campaign metadata status',()=>{
 it('does not infer activity from metrics or fill missing metadata with ACTIVE',()=>{
  const empty=readCampaignMetaStatus({spend:999,conversations:30})!;expect(empty.meta_status).toBeNull();expect(campaignStatusView(empty,now).label).toBe('Chưa có dữ liệu');
 });
 it('marks old ACTIVE as an old snapshot, never a fresh green delivery claim',()=>{
  const v=campaignStatusView(snapshot({meta_status_at:'2026-10-28T14:59:48Z'}),now);expect(v.label).toBe('Đã bật (cấu hình)');expect(v.note).toContain('Ảnh cũ');expect(v.tone).toContain('amber');expect(v.title).toContain('không bảo đảm đang phân phối');
 });
 it('uses effective state from the same snapshot and keeps configured-only semantics explicit',()=>{
  const v=campaignStatusView(snapshot({meta_status:'ACTIVE',meta_effective_status:'PAUSED',meta_status_source:'webhook_snapshot'}),now);expect(v.label).toBe('Tạm dừng');expect(v.code).toBe('PAUSED');
  expect(campaignStatusView(snapshot(),now).label).toContain('cấu hình');expect(campaignStatusView(snapshot(),now).tone).not.toContain('emerald');
 });
 it('rejects malformed/partial provenance and does not translate unknown codes as ACTIVE',()=>{
  expect(readCampaignMetaStatus({meta_status:'ACTIVE'})).toBeNull();expect(readCampaignMetaStatus(snapshot({meta_status_at:'invalid'}))).toBeNull();expect(readCampaignMetaStatus(snapshot({meta_status:'active'}))).toBeNull();
  expect(campaignStatusView(snapshot({meta_status:'FUTURE_CODE'}),now).label).toContain('Mã Meta: FUTURE_CODE');
 });
 it('flags future timestamps and only treats the age threshold as an age label',()=>{
  expect(campaignStatusView(snapshot({meta_status_at:'2026-10-31T09:00:00Z'}),now).note).toContain('Thời điểm cần kiểm tra');
  const fresh=campaignStatusView(snapshot({meta_effective_status:'ACTIVE',meta_status_source:'webhook_snapshot'}),now);expect(fresh.tone).toContain('emerald');expect(fresh.note).toBe('Ảnh nguồn đã nhận');
 });
});
