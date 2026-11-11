window.EXAM_CATALOG = {
  categories: [
    { id: 'to-chuc-quan-y', name: 'Tổ chức quân y' },
    { id: 'noi-khoa', name: 'Nội khoa' },
    { id: 'ngoai-khoa', name: 'Ngoại khoa' }
  ],
  exams: [
    { id: 'easy', categoryId: 'to-chuc-quan-y', count: 1000, file: './questions-easy.json', name: 'Tổ chức chiến thuật quân y - 1.000 câu' },
    { id: 'hard', categoryId: 'to-chuc-quan-y', count: 256, file: './questions-hard.json', name: 'Đề cương ôn tập Quân y - 256 câu' },
    { id: 'third', categoryId: 'to-chuc-quan-y', count: 744, file: './questions-third.json', name: 'Bộ 3 - 744 câu không trùng đề 2' },
    { id: 'level1', categoryId: 'to-chuc-quan-y', count: 200, file: './questions-level-1.json', name: 'Bộ 4 - Cơ bản (200 câu)' },
    { id: 'level2', categoryId: 'to-chuc-quan-y', count: 200, file: './questions-level-2.json', name: 'Bộ 5 - Cơ bản nâng cao (200 câu)' },
    { id: 'level3', categoryId: 'to-chuc-quan-y', count: 200, file: './questions-level-3.json', name: 'Bộ 6 - Trung bình (200 câu)' },
    { id: 'level4', categoryId: 'to-chuc-quan-y', count: 200, file: './questions-level-4.json', name: 'Bộ 7 - Khá (200 câu)' },
    { id: 'level5', categoryId: 'to-chuc-quan-y', count: 200, file: './questions-level-5.json', name: 'Bộ 8 - Nâng cao (200 câu)' }
  ]
};
