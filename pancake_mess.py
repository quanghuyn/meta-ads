#!/usr/bin/env python3
"""Đếm hội thoại mới trên Pancake theo giờ Việt Nam và so với số mess Meta Ads.

Token đọc từ file (mặc định ~/.config/pancake/token), không bao giờ in ra màn hình.

Ví dụ:
    python3 pancake_mess.py --date 2026-10-27 --meta 66
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone

PAGE_ID = "196059750263125"  # Bác Sĩ Nam Khoa - Đức Mạnh
API = "https://pages.fm/api/public_api/v2/pages/{page_id}/conversations"
TOKEN_FILE = os.path.expanduser("~/.config/pancake/token")
VN = timezone(timedelta(hours=7))


def read_token(path):
    try:
        with open(path, encoding="utf-8") as f:
            token = f.read().strip()
    except FileNotFoundError:
        sys.exit(f"Không thấy file token: {path}\nXem hướng dẫn lưu token trong chat.")
    if not token:
        sys.exit(f"File token rỗng: {path}")
    return token


def fetch_page(page_id, token, since, until, page_number):
    params = {
        "page_access_token": token,
        "since": since,
        "until": until,
        "page_number": page_number,
        "order_by": "inserted_at",
        "type[]": "INBOX",
    }
    url = API.format(page_id=page_id) + "?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        # Không in URL vì URL chứa token
        sys.exit(f"Pancake trả lỗi HTTP {e.code}: {body}")


def parse_time(value):
    """Pancake trả giờ dạng ISO không kèm múi giờ, coi là UTC."""
    dt = datetime.fromisoformat(value.replace("Z", ""))
    return dt.replace(tzinfo=timezone.utc).astimezone(VN)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", required=True, help="Ngày theo giờ VN, dạng YYYY-MM-DD")
    ap.add_argument("--meta", type=int, help="Số mess Meta Ads cùng ngày để so sánh")
    ap.add_argument("--page-id", default=PAGE_ID)
    ap.add_argument("--token-file", default=TOKEN_FILE)
    ap.add_argument("--max-pages", type=int, default=50)
    args = ap.parse_args()

    token = read_token(args.token_file)
    day_start = datetime.strptime(args.date, "%Y-%m-%d").replace(tzinfo=VN)
    day_end = day_start + timedelta(days=1)
    since, until = int(day_start.timestamp()), int(day_end.timestamp()) - 1

    convs, seen = [], set()
    for page_number in range(1, args.max_pages + 1):
        data = fetch_page(args.page_id, token, since, until, page_number)
        batch = data.get("conversations") or []
        new = [c for c in batch if c.get("id") not in seen]
        if not new:
            break
        for c in new:
            seen.add(c.get("id"))
        convs.extend(new)
    else:
        print(f"Cảnh báo: đã chạm giới hạn {args.max_pages} trang, có thể còn thiếu dữ liệu.")

    # Since/until của API lọc theo lần cập nhật, nên lọc lại theo thời điểm tạo hội thoại
    by_hour, from_ad, ad_counter = Counter(), 0, Counter()
    created = []
    for c in convs:
        if not c.get("inserted_at"):
            continue
        t = parse_time(c["inserted_at"])
        if not (day_start <= t < day_end):
            continue
        created.append(t)
        by_hour[t.hour] += 1
        ad_ids = c.get("ad_ids") or []
        if ad_ids:
            from_ad += 1
            ad_counter[ad_ids[-1]] += 1

    total = len(created)
    print(f"\nPANCAKE — page {args.page_id} — ngày {args.date} (giờ VN)")
    print(f"Hội thoại lấy về: {len(convs)} | Tạo mới trong ngày: {total}")
    print(f"  Từ quảng cáo (có ad_id): {from_ad}")
    print(f"  Tự nhiên / không rõ:     {total - from_ad}")
    if created:
        print(f"  Sớm nhất: {min(created):%H:%M} | Muộn nhất: {max(created):%H:%M}")

    print("\nTheo giờ:")
    for h in range(24):
        n = by_hour.get(h, 0)
        print(f"  {h:02d}h  {n:4d}  {'█' * n}")

    if ad_counter:
        print("\nTop quảng cáo (ad_id → số hội thoại):")
        for ad_id, n in ad_counter.most_common(15):
            print(f"  {ad_id}  {n}")

    if args.meta is not None:
        diff = from_ad - args.meta
        print(f"\nSO SÁNH: Meta {args.meta} mess | Pancake từ quảng cáo {from_ad} | lệch {diff:+d}")


if __name__ == "__main__":
    main()
