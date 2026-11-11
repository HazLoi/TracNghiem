import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUESTION_DIR = ROOT / 'data' / 'questions' / 'to-chuc-quan-y'
SOURCE_PATH = QUESTION_DIR / 'questions-easy.json'
EXPECTED_QUESTIONS = 1000
LEVEL_COUNT = 5

PATTERNS = {
    'calculation': re.compile(
        r'công thức|tính (?:theo|bằng|bao nhiêu)|tỷ lệ|tỉ lệ|phần trăm|mmhg|parkland|'
        r'bao nhiêu.*(?:ngày|giờ|phút|giường|%|lần)', re.IGNORECASE
    ),
    'scenario': re.compile(
        r'trong trường hợp|tình huống|nếu |khi |sau khi|trong khi|người bệnh .*?(?:cần|nên|phải)',
        re.IGNORECASE
    ),
    'application': re.compile(
        r'xử trí|xử lý|cần làm|nên làm|ưu tiên|biện pháp|điều trị|chẩn đoán|phòng chống|'
        r'phòng ngừa|thực hiện|quy trình|nguyên tắc|lựa chọn|theo dõi|chuyển .*?đâu',
        re.IGNORECASE
    ),
    'analysis': re.compile(
        r'nguyên nhân|mục đích|ý nghĩa|tác dụng|hậu quả|vì sao|đặc điểm|triệu chứng|'
        r'biểu hiện|dấu hiệu|vai trò|chức năng|nhiệm vụ|so sánh', re.IGNORECASE
    ),
    'negative': re.compile(r'không|trừ|ngoại trừ|sai', re.IGNORECASE),
}


def difficulty_key(question):
    stem = question['q']
    cognitive_score = (
        5 * bool(PATTERNS['calculation'].search(stem))
        + 3 * bool(PATTERNS['scenario'].search(stem))
        + 2 * bool(PATTERNS['application'].search(stem))
        + bool(PATTERNS['analysis'].search(stem))
        + bool(PATTERNS['negative'].search(stem))
    )
    text_detail = len(stem.split()) * 100 + sum(
        len(option['text'].split()) for option in question['options']
    )
    return cognitive_score, text_detail, question['stt']


def main():
    questions = json.loads(SOURCE_PATH.read_text(encoding='utf-8'))
    if len(questions) != EXPECTED_QUESTIONS:
        raise ValueError(f'Expected {EXPECTED_QUESTIONS} source questions, got {len(questions)}.')
    if len({question['stt'] for question in questions}) != EXPECTED_QUESTIONS:
        raise ValueError('Source question STT values must be unique.')

    ranked_questions = sorted(questions, key=difficulty_key)
    if len(ranked_questions) % LEVEL_COUNT:
        raise ValueError('The source question count must divide evenly into five exam levels.')

    questions_per_level = len(ranked_questions) // LEVEL_COUNT
    for level in range(LEVEL_COUNT):
        start = level * questions_per_level
        end = start + questions_per_level
        output_path = QUESTION_DIR / f'questions-level-{level + 1}.json'
        output_path.write_text(
            json.dumps(ranked_questions[start:end], ensure_ascii=False, separators=(',', ':')) + '\n',
            encoding='utf-8'
        )
        print(f'{output_path.name}: {questions_per_level} questions')


if __name__ == '__main__':
    main()