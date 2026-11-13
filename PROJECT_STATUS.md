# Trạng thái dự án cho AI/dev

## Mục tiêu

Website tĩnh bằng HTML/CSS/JavaScript cho ôn thi, giao diện mobile-first với hai tab Trắc nghiệm và Lý thuyết. Triển khai GitHub Pages dưới `/TracNghiem/`; mọi URL nội bộ dùng đường dẫn tương đối. Không có backend, đăng nhập hoặc đồng bộ dữ liệu giữa thiết bị.

## Cấu trúc và trách nhiệm

- `data/questions/<môn>/`: toàn bộ ngân hàng JSON; mỗi môn có thư mục riêng.
- `data/templates/`: file Excel mẫu và workbook mẫu.
- `index.html`: shell Ôn Thi, hai tab, các màn hình cấu hình/quiz/kết quả, bộ lọc Lý thuyết và điều khiển theme/import/cache.
- `style.css`: giao diện mobile-first sáng/tối, thanh tab thuận tiện thao tác trên điện thoại, thẻ lý thuyết và trạng thái quiz.
- `app.js`: dựng bộ lọc/danh sách đề từ catalog, tải/kiểm tra câu hỏi, trộn lựa chọn, làm bài, ôn câu sai, lưu tiến độ, nhập Excel, tải/tìm/lọc dữ liệu Lý thuyết và đăng ký service worker.
- `exam-catalog.js`: danh mục môn/nhóm đề và metadata bộ đề tĩnh.
- `theory-catalog.js`: danh mục Lý thuyết tách riêng khỏi mã đề; nguồn hiện tại là Tổ chức quân y 1.000 câu, Nội khoa 315 câu và Ngoại khoa 400 câu.
- `data/questions/to-chuc-quan-y/`: dữ liệu nguồn 1.000/256 câu và các tập con 744/5 × 200 câu.
- `scripts/generate-level-exams.py`: sinh lại năm pool độ khó, không sửa nguồn.
- `data/questions/noi-khoa/`: năm pool Nội khoa, mỗi pool 63 câu, phủ đủ 315 câu, cộng file Toàn bộ.
- `data/questions/noi-khoa/questions-noi-khoa-all.json`: ngân hàng đủ 315 câu Nội khoa.
- `data/questions/ngoai-khoa/`: năm pool Ngoại khoa, mỗi pool 80 câu, phủ đủ 400 câu, cộng file Toàn bộ.
- `scripts/generate-subject-exams.py`: đọc DOCX, lấy đáp án từ lựa chọn in đậm, kiểm tra dữ liệu và tạo năm pool cùng file tổng cho mỗi môn.
- `service-worker.js`, `manifest.json`, `icons/`: PWA và hoạt động offline.
- `vendor/xlsx.full.min.js`, `vendor/XLSX-LICENSE.txt`: parser SheetJS nội bộ và giấy phép; không dùng CDN.
- `data/templates/mau-nhap-cau-hoi.xlsx`: workbook trống dùng để nhập đề.
- `data/templates/bo-de-trac-nghiem-mau.xlsx`: workbook chứa hai bộ dữ liệu đã chuẩn hóa và sheet mẫu.
- `README.md`: hướng dẫn tổng quan; luôn cập nhật cùng file này sau mỗi tính năng.

## Danh mục bộ đề

`exam-catalog.js` là nguồn chuẩn về môn/nhóm đề và metadata bộ đề. Nội khoa và Ngoại khoa mỗi môn có lựa chọn Toàn bộ cùng năm mức (Cơ bản, Cơ bản nâng cao, Trung bình, Khá, Nâng cao):

| Khóa | File | Số câu |
| --- | --- | ---: |
| `easy` | `data/questions/to-chuc-quan-y/questions-easy.json` | 1.000 |
| `hard` | `data/questions/to-chuc-quan-y/questions-hard.json` | 256 |
| `third` | `data/questions/to-chuc-quan-y/questions-third.json` | 744 |
| `level1` … `level5` | `data/questions/to-chuc-quan-y/questions-level-1.json` … `questions-level-5.json` | 200 mỗi bộ |
| `noi1` … `noi5` | `data/questions/noi-khoa/questions-noi-khoa-level-1.json` … `questions-noi-khoa-level-5.json` | 63 mỗi bộ |
| `noi-all` | `data/questions/noi-khoa/questions-noi-khoa-all.json` | 315 |
| `ngoai1` … `ngoai5` | `data/questions/ngoai-khoa/questions-ngoai-khoa-level-1.json` … `questions-ngoai-khoa-level-5.json` | 80 mỗi bộ |
| `ngoai-all` | `data/questions/ngoai-khoa/questions-ngoai-khoa-all.json` | 400 |

Giao diện tự tạo bộ lọc và lựa chọn bộ đề từ catalog. Tên option hiển thị `name` cùng tổng số câu, định dạng `(<count> câu)`. Khi chọn mã đề, input số câu tự đặt thành `count`; người dùng vẫn được phép giảm số câu. Khi thêm một môn, thêm category `{ id, name }` và thư mục `data/questions/<categoryId>/`. Khi thêm đề, thêm metadata `{ id, categoryId, count, file, name }` trỏ đến JSON trong thư mục môn và đưa đường dẫn đó vào `APP_SHELL`. Không thêm option thủ công trong HTML. Đề Excel lưu thêm `categoryId`; các bản ghi localStorage cũ không có trường này được gán mặc định vào `to-chuc-quan-y`.

Bộ 4–8 hiển thị lần lượt là Cơ bản, Cơ bản nâng cao, Trung bình, Khá, Nâng cao. Nhãn này là ước lượng, không phải metadata từ Word/PDF. Bộ 1 được xếp ổn định theo điểm nhận thức (tính toán, tình huống, áp dụng, phân tích/phủ định), sau đó theo độ dài câu hỏi/lựa chọn và STT. Mỗi pool giữ nguyên bản ghi, STT, đáp án; năm pool chia đủ 1.000 STT, không chồng lặp.

Sinh lại bằng:

```sh
python3 scripts/generate-level-exams.py
```

Script yêu cầu đúng 1.000 câu nguồn, STT duy nhất và số lượng chia đều cho 5. Sau khi đổi logic xếp loại, xác minh median rank của từng pool tăng dần và các pool vẫn rời nhau.

Sinh lại mã đề từ bản DOCX nguồn bằng:

```sh
python3 scripts/generate-subject-exams.py \
  --internal-docx "/path/to/Đề-cương-nội-khoa.docx" \
  --surgery-docx "/path/to/Đề-cương-ngoại-khoa.docx"
```

DOCX nguồn không được lưu trong repository; cần có file nguồn khi chạy lại. Nội dung câu hỏi, đáp án và STT được giữ nguyên. Mức độ được ước lượng bằng các cụm từ về tính toán, tình huống, xử trí/áp dụng, phân tích và độ dài; không phải phân loại chuyên môn được xác nhận. Script yêu cầu số câu chia đều cho năm, số thứ tự liên tục và đúng một phương án in đậm mỗi câu.

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

Lý thuyết hiện lấy nguyên văn nội dung câu hỏi và lựa chọn đúng từ các bộ JSON đang có; không thêm diễn giải. `theory-catalog.js` hỗ trợ `format: "multiple-choice"` để chuyển lựa chọn đúng thành đáp án đọc được, hoặc `format: "essay"` cho dữ liệu độc lập có schema:

```json
[
  { "stt": 1, "question": "Câu hỏi tự luận", "answer": "Nội dung đáp án" }
]
```

`stt` là tùy chọn. Môn lý thuyết chỉ cần thêm vào `subjects` trong `theory-catalog.js`, không cần category hay mã đề trong `exam-catalog.js`. Lọc theo môn và tìm kiếm không phân biệt dấu hoạt động trên câu hỏi/đáp án; danh sách hiển thị 30 mục mỗi lần.

## Luồng quiz và lưu trữ

- Chọn đề -> `loadQuestionData(key)` -> kiểm tra -> chọn số câu -> random không lặp -> quiz.
- Thứ tự lựa chọn bị xáo trộn khi hiển thị; `data-source-letter` giữ liên kết tới đáp án gốc.
- Đúng tự chuyển sau 1 giây, sai sau 2 giây; sai có thể ôn lại cho tới khi đúng.
- Tạm dừng/đổi tab lưu trạng thái và có thể khôi phục bài.
- `answeredWrongQuestionStts` trong tiến độ lưu các câu đã trả lời sai duy nhất; bộ đếm không tăng thêm khi trả lời sai lại cùng câu trong vòng ôn tập. Bản ghi tiến độ cũ được nâng cấp từ kết quả lần đầu và hàng đợi câu sai.
- `localStorage`: `quanYQuizTienDo_v1` (tiến độ), `quanYQuizBoDeExcel_v1` (danh mục đề nhập và category), `quanYQuizTheme_v1` (theme).
- `IndexedDB`: database `quanYQuizBoDeExcel`, object store `questionSets`, lưu câu hỏi của đề Excel theo thiết bị.
- Xóa đề Excel xóa bản ghi IndexedDB và mục danh mục tương ứng; không xóa nguồn JSON.

## Nhập Excel

Sheet dùng hàng tiêu đề `STT`, `Tên câu hỏi`, `Đáp án A`, `Đáp án B`, `Đáp án C`, `Đáp án D`, `Đáp án đúng`. `parseQuestionSheet()` chuẩn hóa tên cột, tìm header trong 20 dòng đầu, yêu cầu STT nguyên dương không trùng, đủ nội dung A–D và đáp án A/B/C/D. Chỉ sheet hợp lệ được import; sheet mẫu được bỏ qua.

File được đọc trên trình duyệt, không upload. `vendor/xlsx.full.min.js` phải được giữ trong app shell để import hoạt động offline.

## PWA và cập nhật cache

- Manifest có `scope`/`start_url` tương đối, phù hợp `/TracNghiem/`.
- `service-worker.js` đang dùng cache `trac-nghiem-pwa-v15`; `APP_SHELL` phải gồm HTML/CSS/JS, `exam-catalog.js`, `theory-catalog.js`, 20 JSON đề dưới `data/questions/`, manifest, icon, parser và template ở `data/templates/`.
- Điều hướng là network-first để nhận giao diện mới, fallback về cache khi offline; asset là cache-first.
- Nút `Xóa cache PWA và tải bản mới` gửi `REFRESH_APP`. Worker tải app shell vào cache staging; chỉ thay cache hoạt động sau khi tải đủ. Lỗi mạng giữ cache cũ. Không xóa localStorage hoặc IndexedDB.
- Khi sửa app shell, tăng `CACHE_NAME` để worker cài mới và dọn cache PWA đời trước.

## Kiểm tra trước khi hoàn tất

1. `node --check app.js && node --check exam-catalog.js && node --check theory-catalog.js && node --check service-worker.js`; parse `scripts/generate-subject-exams.py`.
2. `python3 -m json.tool manifest.json`.
3. Kiểm tra số lượng: 1000, 256, 744, 5 × 200, Nội khoa 315 tổng + 5 × 63, Ngoại khoa 400 tổng + 5 × 80; xác minh schema, STT, đáp án và overlap theo mục tiêu.
4. Khi thêm đề, thử chọn từng khóa, xác nhận giới hạn, tải JSON và vào được quiz.
5. Khi đổi worker, kiểm tra APP_SHELL và online/offline fallback; khi đổi nút refresh, kiểm tra staging thành công và thất bại.
6. `git diff --check`; sau khi push, xem GitHub Pages Actions và xác nhận asset live trước khi nói deploy hoàn tất.

## Quy tắc thay đổi

- Giữ nguyên nội dung nguồn `data/questions/to-chuc-quan-y/questions-easy.json` và `questions-hard.json` trừ khi có yêu cầu sửa dữ liệu.
- Thêm bộ built-in phải cập nhật `exam-catalog.js`, JSON tương ứng và `APP_SHELL`; giao diện lọc và lựa chọn được sinh từ catalog.
- Cập nhật `README.md` và file này sau mỗi tính năng; ghi rõ giả định/heuristic và kiểm tra đã chạy.
- Không xóa dữ liệu localStorage/IndexedDB trong thao tác cache refresh.