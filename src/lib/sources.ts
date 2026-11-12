// Một chỗ duy nhất khai báo các nguồn dữ liệu của báo cáo web.
// Worker Deno (supabase/functions) và các hàm SQL vẫn giữ bản khai báo riêng vì không import được từ src.
export const PANCAKE_PAGE_ID = '196059750263125';
export const POS_SHOP_ID = '1546758';

// Hai cột tài khoản cố định của dashboard gốc. Không gộp tài khoản trùng tên hay suy ra tiền tệ/múi giờ.
export const DASHBOARD_ACCOUNTS = {
  nk2: '1492352028605038',
  nk3: '1114645597047575',
} as const;

// Tên hiển thị theo ID tài khoản quảng cáo, gồm cả tài khoản trùng tên không nằm trong cột dashboard.
export const AD_ACCOUNT_NAMES: Record<string, string> = {
  [DASHBOARD_ACCOUNTS.nk2]: 'Nam Khoa 2',
  [DASHBOARD_ACCOUNTS.nk3]: 'Nam Khoa 3',
  '3275227329354665': 'Nam Khoa 3',
};
