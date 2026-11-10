# Trạng thái dự án cho AI/dev

## Mục tiêu

Website tĩnh bằng HTML/CSS/JavaScript cho bài trắc nghiệm Quân y. Triển khai GitHub Pages dưới `/TracNghiem/`; mọi URL nội bộ dùng đường dẫn tương đối. Không có backend, đăng nhập hoặc đồng bộ dữ liệu giữa thiết bị.

## Cấu trúc và trách nhiệm

- `index.html`: các màn hình cấu hình, quiz, kết quả; danh sách bộ đề và điều khiển theme/import/cache.
- `style.css`: giao diện sáng/tối, responsive và trạng thái quiz.
- `app.js`: tải/kiểm tra câu hỏi, trộn lựa chọn, làm bài, ôn câu sai, lưu tiến độ, nhập Excel và đăng ký service worker.
- `questions-easy.json`: dữ liệu nguồn 1.000 câu.
- `questions-hard.json`: dữ liệu nguồn PDF 256 câu.
- `questions-third.json`: 744 câu của Bộ 1 sau khi bỏ các bản ghi trùng hoàn toàn với Bộ 2.
- `questions-level-1.json` … `questions-level-5.json`: năm pool 200 câu, không giao nhau, chia từ toàn bộ Bộ 1 theo mức độ ước lượng.
- `scripts/generate-level-exams.py`: sinh lại năm pool độ khó, không sửa nguồn.
- `service-worker.js`, `manifest.json`, `icons/`: PWA và hoạt động offline.
- `vendor/xlsx.full.min.js`, `vendor/XLSX-LICENSE.txt`: parser SheetJS nội bộ và giấy phép; không dùng CDN.
- `mau-nhap-cau-hoi.xlsx`: workbook trống dùng để nhập đề.
- `bo-de-trac-nghiem-mau.xlsx`: workbook chứa hai bộ dữ liệu đã chuẩn hóa và sheet mẫu.
- `README.md`: hướng dẫn tổng quan; luôn cập nhật cùng file này sau mỗi tính năng.

## Danh mục bộ đề

`QUESTION_SETS` trong `app.js` là nguồn chuẩn về khóa, số câu, đường dẫn và tên hiển thị:

| Khóa | File | Số câu |
| --- | --- | ---: |
| `easy` | `questions-easy.json` | 1.000 |
| `hard` | `questions-hard.json` | 256 |
| `third` | `questions-third.json` | 744 |
| `level1` … `level5` | `questions-level-1.json` … `questions-level-5.json` | 200 mỗi bộ |

Bộ 4–8 hiển thị lần lượt là Cơ bản, Cơ bản nâng cao, Trung bình, Khá, Nâng cao. Nhãn này là ước lượng, không phải metadata từ Word/PDF. Bộ 1 được xếp ổn định theo điểm nhận thức (tính toán, tình huống, áp dụng, phân tích/phủ định), sau đó theo độ dài câu hỏi/lựa chọn và STT. Mỗi pool giữ nguyên bản ghi, STT, đáp án; năm pool chia đủ 1.000 STT, không chồng lặp.

Sinh lại bằng:

```sh
python3 scripts/generate-level-exams.py
```

Script yêu cầu đúng 1.000 câu nguồn, STT duy nhất và số lượng chia đều cho 5. Sau khi đổi logic xếp loại, xác minh median rank của từng pool tăng dần và các pool vẫn rời nhau.

## Schema dữ liệu

```json
{
  "stt": 1,
  "q": "Câu hỏi",
  "options": [
    { "letter": "A", "text": "..." },
    { "letter": "B", "text": "..." },
    { "letter": "C", "text": "..." },
    { "letter": "D", "text": "..." }
  ],
  "answer": "A"
}
```

`loadQuestionData()` kiểm tra số lượng, STT duy nhất, đủ A–D và đáp án hợp lệ. Không renumber STT khi tạo tập con; tiến độ lưu ID câu bằng STT.

## Luồng quiz và lưu trữ

- Chọn đề -> `loadQuestionData(key)` -> kiểm tra -> chọn số câu -> random không lặp -> quiz.
- Thứ tự lựa chọn bị xáo trộn khi hiển thị; `data-source-letter` giữ liên kết tới đáp án gốc.
- Đúng tự chuyển sau 1 giây, sai sau 2 giây; sai có thể ôn lại cho tới khi đúng.
- Tạm dừng/đổi tab lưu trạng thái và có thể khôi phục bài.
- `localStorage`: `quanYQuizTienDo_v1` (tiến độ), `quanYQuizBoDeExcel_v1` (danh mục đề nhập), `quanYQuizTheme_v1` (theme).
- `IndexedDB`: database `quanYQuizBoDeExcel`, object store `questionSets`, lưu câu hỏi của đề Excel theo thiết bị.
- Xóa đề Excel xóa bản ghi IndexedDB và mục danh mục tương ứng; không xóa nguồn JSON.

## Nhập Excel

Sheet dùng hàng tiêu đề `STT`, `Tên câu hỏi`, `Đáp án A`, `Đáp án B`, `Đáp án C`, `Đáp án D`, `Đáp án đúng`. `parseQuestionSheet()` chuẩn hóa tên cột, tìm header trong 20 dòng đầu, yêu cầu STT nguyên dương không trùng, đủ nội dung A–D và đáp án A/B/C/D. Chỉ sheet hợp lệ được import; sheet mẫu được bỏ qua.

File được đọc trên trình duyệt, không upload. `vendor/xlsx.full.min.js` phải được giữ trong app shell để import hoạt động offline.

## PWA và cập nhật cache

- Manifest có `scope`/`start_url` tương đối, phù hợp `/TracNghiem/`.
- `service-worker.js` đang dùng cache `trac-nghiem-pwa-v9`; `APP_SHELL` phải gồm HTML/CSS/JS, cả 8 JSON đề, manifest, icon, parser và file mẫu Excel.
- Điều hướng là network-first để nhận giao diện mới, fallback về cache khi offline; asset là cache-first.
- Nút `Xóa cache PWA và tải bản mới` gửi `REFRESH_APP`. Worker tải app shell vào cache staging; chỉ thay cache hoạt động sau khi tải đủ. Lỗi mạng giữ cache cũ. Không xóa localStorage hoặc IndexedDB.
- Khi sửa app shell, tăng `CACHE_NAME` để worker cài mới và dọn cache PWA đời trước.

## Kiểm tra trước khi hoàn tất

1. `node --check app.js && node --check service-worker.js`.
2. `python3 -m json.tool manifest.json`.
3. Kiểm tra số lượng: 1000, 256, 744 và 5 × 200; xác minh schema, STT, đáp án và overlap theo mục tiêu.
4. Khi thêm đề, thử chọn từng khóa, xác nhận giới hạn, tải JSON và vào được quiz.
5. Khi đổi worker, kiểm tra APP_SHELL và online/offline fallback; khi đổi nút refresh, kiểm tra staging thành công và thất bại.
6. `git diff --check`; sau khi push, xem GitHub Pages Actions và xác nhận asset live trước khi nói deploy hoàn tất.

## Quy tắc thay đổi

- Giữ nguyên `questions-easy.json` và `questions-hard.json` trừ khi có yêu cầu sửa nội dung nguồn.
- Thêm bộ built-in phải cập nhật `QUESTION_SETS`, `<select id="exam-select">`, JSON tương ứng và `APP_SHELL`.
- Cập nhật `README.md` và file này sau mỗi tính năng; ghi rõ giả định/heuristic và kiểm tra đã chạy.
- Không xóa dữ liệu localStorage/IndexedDB trong thao tác cache refresh.