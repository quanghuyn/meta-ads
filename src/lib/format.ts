// Hằng số và định dạng dùng chung cho báo cáo (VND, tiếng Việt).
export const CIR_TARGET = 0.45;

export const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
export const num = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));
export const pct = (n: number, d = 2) => (n * 100).toFixed(d).replace(".", ",") + "%";
export const compact = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(3).replace(".", ",") + " Tr" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n);
