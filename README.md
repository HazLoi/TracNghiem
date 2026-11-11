# Trắc nghiệm Quân y

> Website trắc nghiệm tĩnh, chạy trên GitHub Pages tại `/TracNghiem/`, hỗ trợ cài PWA và làm bài offline.

## Bộ đề

Các bộ đề được nhóm theo môn/nhóm đề và lọc trên giao diện. Hiện các bộ có sẵn thuộc **Tổ chức quân y**; danh mục đã có sẵn nhóm **Nội khoa** và **Ngoại khoa** để bổ sung khi có dữ liệu, chưa tạo bộ đề trống.

| Mã | Nội dung | Số câu |
| --- | --- | ---: |
| Bộ 1 | Tổ chức chiến thuật quân y, nguồn Word | 1.000 |
| Bộ 2 | Đề cương ôn tập Quân y, nguồn PDF | 256 |
| Bộ 3 | Bộ 1 sau khi bỏ 256 bản ghi khớp đầy đủ Bộ 2 | 744 |
| Bộ 4 | Cơ bản, phân loại ước lượng | 200 |
| Bộ 5 | Cơ bản nâng cao, phân loại ước lượng | 200 |
| Bộ 6 | Trung bình, phân loại ước lượng | 200 |
| Bộ 7 | Khá, phân loại ước lượng | 200 |
| Bộ 8 | Nâng cao, phân loại ước lượng | 200 |

Năm bộ 4–8 là các phần rời nhau, cùng lấy từ Bộ 1 và phủ đủ 1.000 câu. Độ khó được ước lượng tự động từ dạng câu hỏi (tính toán, tình huống, áp dụng, phân tích), độ dài câu và lựa chọn; tài liệu nguồn không có nhãn độ khó chính thức.

## Dữ liệu câu hỏi

Các file `questions-*.json` dùng schema:

```json
{
	"stt": 1,
	"q": "Nội dung câu hỏi",
	"options": [
		{ "letter": "A", "text": "Lựa chọn A" },
		{ "letter": "B", "text": "Lựa chọn B" },
		{ "letter": "C", "text": "Lựa chọn C" },
		{ "letter": "D", "text": "Lựa chọn D" }
	],
	"answer": "A"
}
```

Không đánh lại STT gốc. Tạo lại năm mức bằng lệnh `python3 scripts/generate-level-exams.py`; script chỉ đọc `questions-easy.json` và ghi `questions-level-1.json` đến `questions-level-5.json`.

Có thể thêm đề từ Excel trên giao diện. Mỗi sheet cần các cột `STT`, `Tên câu hỏi`, `Đáp án A`, `Đáp án B`, `Đáp án C`, `Đáp án D`, `Đáp án đúng`. File và dữ liệu câu hỏi nhập được lưu cục bộ trên thiết bị, không tải lên server.

## Kiến trúc

- `index.html`, `style.css`, `app.js`: giao diện và logic quiz.
- `exam-catalog.js`: danh mục môn/nhóm đề và metadata các bộ đề. Thêm bộ đề tĩnh mới bằng cách thêm metadata ở đây và đưa JSON tương ứng vào app shell.
- `questions-*.json`: dữ liệu đề tĩnh.
- `service-worker.js`, `manifest.json`: cài đặt PWA, precache app/dữ liệu và làm mới cache.
- `vendor/xlsx.full.min.js`: SheetJS nội bộ để đọc Excel offline.
- `PROJECT_STATUS.md`: hướng dẫn chi tiết cho AI/dev tiếp tục làm việc trong repo.

Khi thêm môn/nhóm đề, cập nhật `categories` trong `exam-catalog.js`. Khi thêm bộ đề, thêm mục vào `exams` với `id`, `categoryId`, `count`, `file`, `name`, thêm file JSON vào `APP_SHELL`, tăng `CACHE_NAME` trong `service-worker.js`, rồi cập nhật README và `PROJECT_STATUS.md`. Không cần sửa HTML để thêm bộ đề.

Đề nhập từ Excel có thể gắn vào một môn/nhóm đề và vẫn chỉ được lưu trên thiết bị đang nhập.

## Chạy và kiểm tra

Chạy website bằng server tĩnh, ví dụ `python3 -m http.server 8000`, rồi mở `http://localhost:8000/`. Service worker cần HTTPS hoặc localhost.

Kiểm tra JavaScript: `node --check app.js && node --check exam-catalog.js && node --check service-worker.js`.

Kiểm tra JSON: `python3 -m json.tool manifest.json` và đọc các file `questions-*.json` bằng Python; các bộ phải có đúng số câu trong bảng.

## Quy ước tiến độ

Sau mỗi thay đổi tính năng, cập nhật README này và `PROJECT_STATUS.md` trong cùng lượt làm việc. Không sửa dữ liệu nguồn 1.000/256 câu khi không được yêu cầu; các bộ dẫn xuất phải kiểm tra số lượng, STT, đáp án và mức giao nhau trước khi đưa vào ứng dụng.
