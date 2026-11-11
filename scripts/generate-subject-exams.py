import argparse
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
LEVEL_COUNT = 5
NAMESPACES = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
QUESTION_PATTERN = re.compile(r'^Câu\s*(\d+)[.:)]\s*(.*)$', re.IGNORECASE)
OPTION_PATTERN = re.compile(r'^([A-D])[.)]\s*(.*)$', re.IGNORECASE)
PATTERNS = {
    'calculation': re.compile(
        r'công thức|tính(?: toán)?|liều|tỷ lệ|tỉ lệ|phần trăm|mmhg|'
        r'bao nhiêu.*(?:ngày|giờ|phút|ml|mg|lần)', re.IGNORECASE
    ),
    'scenario': re.compile(
        r'trong trường hợp|tình huống|nếu |khi |sau khi|trong khi|'
        r'người bệnh|bệnh nhân|cấp cứu', re.IGNORECASE
    ),
    'application': re.compile(
        r'xử trí|xử lý|cần làm|nên làm|ưu tiên|biện pháp|điều trị|chẩn đoán|'
        r'phòng chống|phòng ngừa|thực hiện|quy trình|nguyên tắc|lựa chọn|'
        r'theo dõi|chăm sóc|sơ cứu|chỉ định|chống chỉ định|'
        r'được xử trí|cần xử trí', re.IGNORECASE
    ),
    'analysis': re.compile(
        r'nguyên nhân|mục đích|ý nghĩa|tác dụng|hậu quả|vì sao|đặc điểm|'
        r'triệu chứng|biểu hiện|dấu hiệu|vai trò|chức năng|nhiệm vụ|'
        r'phân biệt|so sánh|biến chứng', re.IGNORECASE
    ),
    'negative': re.compile(r'không|trừ|ngoại trừ|sai', re.IGNORECASE),
}
SUBJECTS = (
    ('noi-khoa', 'internal_docx', 'Nội khoa'),
    ('ngoai-khoa', 'surgery_docx', 'Ngoại khoa'),
)
LEVEL_NAMES = ('Cơ bản', 'Cơ bản nâng cao', 'Trung bình', 'Khá', 'Nâng cao')


def paragraph_text(paragraph):
    return ''.join(node.text or '' for node in paragraph.findall('.//w:t', NAMESPACES)).strip()


def paragraph_is_bold(paragraph):
    for run in paragraph.findall('.//w:r', NAMESPACES):
        run_text = ''.join(node.text or '' for node in run.findall('.//w:t', NAMESPACES)).strip()
        bold = run.find('w:rPr/w:b', NAMESPACES)
        if run_text and bold is not None and bold.get(f'{{{NAMESPACES["w"]}}}val', '1') not in ('0', 'false', 'off'):
            return True
    return False


def read_questions(docx_path):
    try:
        with zipfile.ZipFile(docx_path) as document:
            root = ElementTree.fromstring(document.read('word/document.xml'))
    except (OSError, KeyError, zipfile.BadZipFile, ElementTree.ParseError) as error:
        raise ValueError(f'Could not read a valid DOCX file: {docx_path}') from error

    body = root.find('w:body', NAMESPACES)
    if body is None:
        raise ValueError(f'DOCX has no document body: {docx_path}')

    questions = []
    current = None
    for paragraph in body.findall('w:p', NAMESPACES):
        text = paragraph_text(paragraph)
        if not text:
            continue

        question_match = QUESTION_PATTERN.match(text)
        if question_match:
            if current is not None:
                questions.append(current)
            current = {
                'stt': int(question_match.group(1)),
                'q': question_match.group(2).strip(),
                'options': [],
                'marked_answers': [],
            }
            continue

        option_match = OPTION_PATTERN.match(text)
        if current is None:
            continue
        if option_match is None:
            raise ValueError(f'Unexpected paragraph in {docx_path}: {text[:120]}')

        letter, option_text = option_match.groups()
        letter = letter.upper()
        current['options'].append({'letter': letter, 'text': option_text.strip()})
        if paragraph_is_bold(paragraph):
            current['marked_answers'].append(letter)

    if current is not None:
        questions.append(current)
    if not questions:
        raise ValueError(f'No numbered questions found in {docx_path}.')

    for expected_stt, question in enumerate(questions, start=1):
        if question['stt'] != expected_stt:
            raise ValueError(
                f'{docx_path}: expected question number {expected_stt}, got {question["stt"]}.'
            )
        if not question['q']:
            raise ValueError(f'{docx_path}: question {question["stt"]} has no question text.')
        if [option['letter'] for option in question['options']] != list('ABCD'):
            raise ValueError(f'{docx_path}: question {question["stt"]} must have options A-D in order.')
        if any(not option['text'] for option in question['options']):
            raise ValueError(f'{docx_path}: question {question["stt"]} has an empty option.')
        if len(question['marked_answers']) != 1:
            raise ValueError(
                f'{docx_path}: question {question["stt"]} must have exactly one bold answer.'
            )
        question['answer'] = question.pop('marked_answers')[0]

    return questions


def difficulty_key(question):
    stem = question['q']
    difficulty_score = (
        5 * bool(PATTERNS['calculation'].search(stem))
        + 3 * bool(PATTERNS['scenario'].search(stem))
        + 2 * bool(PATTERNS['application'].search(stem))
        + bool(PATTERNS['analysis'].search(stem))
        + bool(PATTERNS['negative'].search(stem))
    )
    text_detail = len(stem.split()) * 100 + sum(
        len(option['text'].split()) for option in question['options']
    )
    return difficulty_score, text_detail, question['stt']


def write_level_files(subject_id, questions, output_dir):
    if len(questions) % LEVEL_COUNT:
        raise ValueError(
            f'{subject_id} has {len(questions)} questions, which cannot be split evenly '
            f'into {LEVEL_COUNT} levels.'
        )

    ranked_questions = sorted(questions, key=difficulty_key)
    questions_per_level = len(ranked_questions) // LEVEL_COUNT
    for level in range(LEVEL_COUNT):
        start = level * questions_per_level
        end = start + questions_per_level
        subject_dir = output_dir / subject_id
        subject_dir.mkdir(parents=True, exist_ok=True)
        output_path = subject_dir / f'questions-{subject_id}-level-{level + 1}.json'
        output_path.write_text(
            json.dumps(ranked_questions[start:end], ensure_ascii=False, separators=(',', ':')) + '\n',
            encoding='utf-8'
        )
        print(f'{output_path.name}: {questions_per_level} questions ({LEVEL_NAMES[level]})')


def main():
    parser = argparse.ArgumentParser(
        description='Create five ordered difficulty pools from the internal and surgery DOCX question banks.'
    )
    parser.add_argument('--internal-docx', required=True, type=Path, help='Internal medicine DOCX source.')
    parser.add_argument('--surgery-docx', required=True, type=Path, help='Surgery DOCX source.')
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=ROOT / 'data' / 'questions',
        help='Base directory for subject folders and generated JSON files.'
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for subject_id, argument, name in SUBJECTS:
        questions = read_questions(getattr(args, argument))
        write_level_files(subject_id, questions, args.output_dir)
        print(f'{name}: {len(questions)} source questions validated.')


if __name__ == '__main__':
    main()
