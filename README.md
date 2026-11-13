# Nhật Báo Thế Giới · The World Daily

Web báo tổng hợp song ngữ Việt – Anh: tin mỗi ngày từ 12 nước (Việt Nam, Mỹ, Trung Quốc, Nhật, Hàn, Úc, Anh, Đức, Pháp, Nga, Ấn Độ, Singapore), chia theo quốc gia và chủ đề, có tìm kiếm và xem lại các số báo cũ.

**Trang web:** https://thongpham180604.github.io/Newspaper/

## Cách hoạt động
- `sources.json`: danh sách nước, chủ đề và nguồn RSS của từng báo.
- `node build.js`: lấy tin RSS, lưu vào `data/days/<ngày>.json` (giờ Việt Nam; ngày cũ được giữ làm kho lưu trữ), dịch nếu có khóa API, dựng `dist/index.html` (một file, có sẵn 7 ngày gần nhất).
- `node split/split.js`: tách thành web nhiều file trong `public/` (đây là bản đưa lên GitHub Pages).
- GitHub Actions (`.github/workflows/daily.yml`) chạy 4 lần mỗi ngày (6h, 12h, 18h, 0h giờ VN), lưu dữ liệu vào repo và cập nhật trang.

## Dịch tự động (tuỳ chọn)
Thêm secret `ANTHROPIC_API_KEY` trong *Settings → Secrets and variables → Actions*. Không có khóa thì trang hiển thị tiêu đề gốc kèm nhãn ngôn ngữ. Có thể đổi model bằng biến `CLAUDE_MODEL` (mặc định `claude-opus-5-5`).

## Chạy thử trên máy
```
npm ci
node build.js && node split/split.js
npx serve public
```

---

A bilingual (Vietnamese/English) daily news digest built from official RSS feeds of outlets in 12 countries. Headlines and summaries link to the original articles; translations are machine-made.
