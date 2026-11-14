window.THEORY_CATALOG = {
  subjects: [
    {
      id: 'to-chuc-quan-y',
      name: 'Tổ chức quân y',
      sources: [
        {
          file: './data/questions/to-chuc-quan-y/questions-easy.json',
          format: 'multiple-choice'
        }
      ]
    },
    {
      id: 'noi-khoa',
      name: 'Nội khoa',
      sources: [
        {
          file: './data/questions/noi-khoa/questions-noi-khoa-all.json',
          format: 'multiple-choice'
        }
      ]
    },
    {
      id: 'ngoai-khoa',
      name: 'Ngoại khoa',
      sources: [
        {
          file: './data/questions/ngoai-khoa/questions-ngoai-khoa-all.json',
          format: 'multiple-choice'
        }
      ]
    },
    {
      id: 'dieu-duong-co-ban',
      name: 'Điều dưỡng cơ bản',
      sources: [
        {
          file: './data/theory/dieu-duong-co-ban-ly-thuyet.json',
          format: 'essay',
          section: 'Lý thuyết'
        },
        {
          file: './data/theory/dieu-duong-co-ban-thuc-hanh.json',
          format: 'essay',
          section: 'Thực hành'
        }
      ]
    }
  ]
};
