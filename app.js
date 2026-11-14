// DỮ LIỆU NGUỒN: Word 1.000 câu và PDF 256 câu do người dùng cung cấp.
// Mỗi câu giữ nguyên STT, nội dung, bốn lựa chọn và đáp án đánh dấu trong tài liệu.



const PROGRESS_STORAGE_KEY = 'quanYQuizTienDo_v1';
const CUSTOM_EXAMS_STORAGE_KEY = 'quanYQuizBoDeExcel_v1';
const CUSTOM_EXAMS_DB_NAME = 'quanYQuizBoDeExcel';
const CUSTOM_EXAMS_DB_STORE = 'questionSets';
const THEME_STORAGE_KEY = 'quanYQuizTheme_v1';
const SETTINGS_STORAGE_KEY = 'quanYQuizSettings_v1';
const QUESTION_LETTERS = ['A', 'B', 'C', 'D'];
const EXAM_CATEGORIES = window.EXAM_CATALOG.categories;
const BUILTIN_EXAMS = window.EXAM_CATALOG.exams;
const THEORY_SUBJECTS = window.THEORY_CATALOG.subjects;
const DEFAULT_CATEGORY_ID = EXAM_CATEGORIES[0].id;
const customExamCatalog = loadCustomExamCatalog();
const loadedQuestionPools = new Map();
const questionIndexes = new Map();
const loadedTheorySources = new Map();
const THEORY_PAGE_SIZE = 30;
let activeQuestions = [];
let sessionQuestions = [];
let wrongQuestions = [];
let nextWrongQuestions = [];
let wrongQuestionStts = new Set();
let currentIndex = 0;
let firstAttemptResults = {};
let isRetryMode = false;
let retryRound = 0;
let currentAnswered = false;
let currentOptionOrder = null;
let selectedSourceLetter = null;
let autoAdvanceAt = null;
let autoAdvanceTimer = null;
let selectedExamName = '';
let pendingWorkbook = null;
let validExcelSheets = [];
let filteredTheoryEntries = [];
let theoryRenderedCount = 0;
let theoryLoadRequest = 0;

const subjectFilter = document.getElementById('subject-filter');
const examSelect = document.getElementById('exam-select');
const numQuestionsInput = document.getElementById('num-questions');
const countError = document.getElementById('count-error');
const startBtn = document.getElementById('start-btn');
const resumeBtn = document.getElementById('resume-btn');
const progressSaveNote = document.getElementById('progress-save-note');
const themeToggle = document.getElementById('theme-toggle');
const settingsButton = document.getElementById('settings-button');
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsButton = document.getElementById('close-settings-button');
const fontScaleSelect = document.getElementById('font-scale-select');
const correctDelayInput = document.getElementById('correct-delay-input');
const primaryTabs = document.querySelector('.primary-tabs');
const refreshCacheButton = document.getElementById('refresh-cache-btn');
const refreshCacheStatus = document.getElementById('refresh-cache-status');
const importToggleButton = document.getElementById('import-toggle');
const importPanel = document.getElementById('import-panel');
const pauseBtn = document.getElementById('pause-btn');
const pauseModal = document.getElementById('pause-modal');
const continueBtn = document.getElementById('continue-btn');
const exitQuizBtn = document.getElementById('exit-quiz-btn');
const setupScreen = document.getElementById('setup-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');
const quizTabButton = document.getElementById('quiz-tab-button');
const theoryTabButton = document.getElementById('theory-tab-button');
const quizTabPanel = document.getElementById('quiz-tab-panel');
const theoryTabPanel = document.getElementById('theory-tab-panel');
const theorySubjectFilter = document.getElementById('theory-subject-filter');
const theorySearch = document.getElementById('theory-search');
const theorySummary = document.getElementById('theory-summary');
const theoryResults = document.getElementById('theory-results');
const theoryLoadMoreButton = document.getElementById('theory-load-more');
const progressText = document.getElementById('progress-text');
const wrongCount = document.getElementById('wrong-count');
const modeIndicator = document.getElementById('mode-indicator');
const progressFill = document.getElementById('progress-fill');
const questionMeta = document.getElementById('question-meta');
const questionText = document.getElementById('question-text');
const optionsList = document.getElementById('options-list');
const feedbackBox = document.getElementById('feedback-box');
const retrySection = document.getElementById('retry-section');
let pausedForBackground = false;

const excelFileInput = document.getElementById('excel-file');
const excelSheetGroup = document.getElementById('excel-sheet-group');
const excelSheetSelect = document.getElementById('excel-sheet');
const excelNameGroup = document.getElementById('excel-name-group');
const excelExamNameInput = document.getElementById('excel-exam-name');
const excelCategoryGroup = document.getElementById('excel-category-group');
const excelCategorySelect = document.getElementById('excel-category');
const importExamButton = document.getElementById('import-exam-btn');
const deleteExamButton = document.getElementById('delete-exam-btn');
const excelImportStatus = document.getElementById('excel-import-status');

const DEFAULT_SETTINGS = {
  fontScale: 1,
  correctDelaySeconds: 1
};

function getQuizSettings() {
  const fallback = { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      fontScale: Number(parsed.fontScale) > 0 ? Number(parsed.fontScale) : DEFAULT_SETTINGS.fontScale,
      correctDelaySeconds: Number(parsed.correctDelaySeconds) > 0 ? Number(parsed.correctDelaySeconds) : DEFAULT_SETTINGS.correctDelaySeconds
    };
  } catch (error) {
    console.warn('Could not read saved app settings.', error);
    return fallback;
  }
}

function saveQuizSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      fontScale: Number(settings.fontScale) || DEFAULT_SETTINGS.fontScale,
      correctDelaySeconds: Number(settings.correctDelaySeconds) || DEFAULT_SETTINGS.correctDelaySeconds
    }));
  } catch (error) {
    console.warn('Could not save app settings.', error);
  }
}

function applyTheme(theme, persist = false) {
  const selectedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = selectedTheme;
  themeToggle.checked = selectedTheme === 'dark';
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
    } catch (error) {
      console.warn('Could not save the selected color theme.', error);
    }
  }
}

function applyQuizSettings(persist = false) {
  const settings = getQuizSettings();
  const safeScale = Number(settings.fontScale) > 0 ? Number(settings.fontScale) : DEFAULT_SETTINGS.fontScale;
  const safeDelay = Number(settings.correctDelaySeconds) > 0 ? Number(settings.correctDelaySeconds) : DEFAULT_SETTINGS.correctDelaySeconds;
  document.documentElement.style.setProperty('--app-font-scale', String(safeScale));
  document.documentElement.style.setProperty('--correct-delay-seconds', String(safeDelay));
  if (fontScaleSelect) fontScaleSelect.value = String(safeScale);
  if (correctDelayInput) correctDelayInput.value = String(safeDelay);
  if (persist) saveQuizSettings({ fontScale: safeScale, correctDelaySeconds: safeDelay });
}

function getInitialTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  } catch (error) {
    console.warn('Could not read the selected color theme.', error);
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

applyTheme(getInitialTheme());
applyQuizSettings(false);
themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'dark' : 'light', true));

settingsButton?.addEventListener('click', () => {
  if (!settingsPanel) return;
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsButton.setAttribute('aria-expanded', String(!settingsPanel.hidden));
});

closeSettingsButton?.addEventListener('click', () => {
  if (!settingsPanel) return;
  settingsPanel.hidden = true;
  settingsButton?.setAttribute('aria-expanded', 'false');
});

fontScaleSelect?.addEventListener('change', () => {
  const nextScale = Number(fontScaleSelect.value) || DEFAULT_SETTINGS.fontScale;
  saveQuizSettings({ fontScale: nextScale, correctDelaySeconds: Number(correctDelayInput?.value) || DEFAULT_SETTINGS.correctDelaySeconds });
  applyQuizSettings(false);
});

correctDelayInput?.addEventListener('change', () => {
  const nextDelay = Number(correctDelayInput.value) || DEFAULT_SETTINGS.correctDelaySeconds;
  saveQuizSettings({ fontScale: Number(fontScaleSelect?.value) || DEFAULT_SETTINGS.fontScale, correctDelaySeconds: nextDelay });
  applyQuizSettings(false);
});

function setActiveTab(tab) {
  const showTheory = tab === 'theory';
  const wasShowingTheory = !theoryTabPanel.hidden;
  if (showTheory && (quizScreen.classList.contains('active') || resultScreen.classList.contains('active'))) {
    stopAutoAdvance();
    saveProgress();
    showScreen(setupScreen);
    resumeBtn.style.display = 'block';
    progressSaveNote.textContent = 'Bài làm đã tạm lưu. Bạn có thể tiếp tục từ câu đang làm bất cứ lúc nào.';
  }

  quizTabPanel.hidden = showTheory;
  theoryTabPanel.hidden = !showTheory;
  quizTabButton.classList.toggle('active', !showTheory);
  theoryTabButton.classList.toggle('active', showTheory);
  quizTabButton.setAttribute('aria-selected', String(!showTheory));
  theoryTabButton.setAttribute('aria-selected', String(showTheory));
  quizTabButton.tabIndex = showTheory ? -1 : 0;
  theoryTabButton.tabIndex = showTheory ? 0 : -1;
  if (showTheory && !wasShowingTheory) loadTheoryEntries();
  updatePrimaryTabsVisibility();
}

function updatePrimaryTabsVisibility() {
  if (!primaryTabs) return;
  const shouldHideTabs = quizScreen.classList.contains('active') || resultScreen.classList.contains('active');
  primaryTabs.hidden = shouldHideTabs;
}

quizTabButton.addEventListener('click', () => setActiveTab('quiz'));
theoryTabButton.addEventListener('click', () => setActiveTab('theory'));

function normalizeTheoryText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
}

function normalizeTheoryQuestion(question, format, subject, index, section) {
  if (!question || typeof question !== 'object') {
    throw new Error(`Dữ liệu lý thuyết môn ${subject.name} có câu hỏi không hợp lệ.`);
  }
  const prompt = format === 'multiple-choice' ? question.q : question.question ?? question.q;
  let answer = question.answer;
  if (format === 'multiple-choice') {
    if (typeof prompt !== 'string' || !Array.isArray(question.options)) {
      throw new Error(`Câu ${index + 1} của môn ${subject.name} không đúng định dạng trắc nghiệm.`);
    }
    const correctOption = question.options.find(option => option?.letter === answer);
    if (!correctOption || typeof correctOption.text !== 'string') {
      throw new Error(`Không tìm thấy đáp án đúng ở câu ${question.stt ?? index + 1} môn ${subject.name}.`);
    }
    answer = correctOption.text;
  }
  if ((format !== 'multiple-choice' && format !== 'essay')
    || typeof prompt !== 'string' || !prompt.trim()
    || typeof answer !== 'string' || !answer.trim()) {
    throw new Error(`Câu ${index + 1} của môn ${subject.name} thiếu câu hỏi hoặc đáp án.`);
  }
  return {
    subjectId: subject.id,
    subjectName: subject.name,
    section,
    stt: Number.isInteger(question.stt) ? question.stt : index + 1,
    question: prompt,
    answer
  };
}

async function loadTheorySource(subject, source) {
  const cacheKey = `${subject.id}:${source.file}`;
  if (loadedTheorySources.has(cacheKey)) return loadedTheorySources.get(cacheKey);
  const response = await fetch(new URL(source.file, window.location.href));
  if (!response.ok) throw new Error(`Không tải được dữ liệu lý thuyết môn ${subject.name} (${response.status}).`);
  const questions = await response.json();
  if (!Array.isArray(questions)) {
    throw new Error(`Dữ liệu lý thuyết môn ${subject.name} không phải danh sách câu hỏi.`);
  }
  const entries = questions.map((question, index) =>
    normalizeTheoryQuestion(question, source.format, subject, index, source.section));
  loadedTheorySources.set(cacheKey, entries);
  return entries;
}

async function loadTheoryEntries() {
  const requestId = ++theoryLoadRequest;
  const selectedSubjectId = theorySubjectFilter.value;
  const subjects = selectedSubjectId === 'all'
    ? THEORY_SUBJECTS
    : THEORY_SUBJECTS.filter(subject => subject.id === selectedSubjectId);
  theorySummary.textContent = 'Đang tải câu hỏi và đáp án...';
  theoryResults.replaceChildren();
  theoryLoadMoreButton.hidden = true;
  try {
    const subjectEntries = await Promise.all(subjects.map(async subject => {
      const entries = await Promise.all(subject.sources.map(source => loadTheorySource(subject, source)));
      return entries.flat();
    }));
    if (requestId !== theoryLoadRequest) return;
    filteredTheoryEntries = subjectEntries.flat();
    renderTheoryEntries();
  } catch (error) {
    if (requestId !== theoryLoadRequest) return;
    console.error('Could not load theory content.', error);
    filteredTheoryEntries = [];
    theorySummary.textContent = `${error.message} Vui lòng kiểm tra kết nối rồi thử lại.`;
  }
}

function renderTheoryEntries(resetCount = true) {
  if (resetCount) {
    theoryRenderedCount = 0;
    theoryResults.replaceChildren();
  }
  const searchTerm = normalizeTheoryText(theorySearch.value.trim());
  const matchingEntries = searchTerm
    ? filteredTheoryEntries.filter(entry => normalizeTheoryText(`${entry.question} ${entry.answer}`).includes(searchTerm))
    : filteredTheoryEntries;
  const nextEntries = matchingEntries.slice(theoryRenderedCount, theoryRenderedCount + THEORY_PAGE_SIZE);
  const cards = nextEntries.map(entry => {
    const card = document.createElement('article');
    card.className = 'theory-card';
    const heading = document.createElement('div');
    heading.className = 'theory-card-heading';
    const number = document.createElement('h3');
    number.textContent = entry.section ? `${entry.section} · Câu ${entry.stt}` : `Câu ${entry.stt}`;
    const subject = document.createElement('span');
    subject.className = 'theory-subject-tag';
    subject.textContent = entry.subjectName;
    heading.append(number, subject);

    const prompt = document.createElement('p');
    prompt.className = 'theory-question';
    prompt.textContent = entry.question;
    const answer = document.createElement('div');
    answer.className = 'theory-answer';
    const answerLabel = document.createElement('span');
    answerLabel.className = 'theory-answer-label';
    answerLabel.textContent = 'Đáp án';
    const answerText = document.createElement('p');
    answerText.textContent = entry.answer;
    answer.append(answerLabel, answerText);
    card.append(heading, prompt, answer);
    return card;
  });
  theoryResults.append(...cards);
  theoryRenderedCount += nextEntries.length;
  const shownCount = Math.min(theoryRenderedCount, matchingEntries.length);
  theorySummary.textContent = searchTerm
    ? `Tìm thấy ${matchingEntries.length.toLocaleString('vi-VN')} câu · Đang hiển thị ${shownCount.toLocaleString('vi-VN')}.`
    : `Tổng cộng ${matchingEntries.length.toLocaleString('vi-VN')} câu · Đang hiển thị ${shownCount.toLocaleString('vi-VN')}.`;
  if (!matchingEntries.length) {
    theorySummary.textContent = searchTerm ? 'Không tìm thấy câu hỏi phù hợp.' : 'Môn này chưa có nội dung lý thuyết.';
  }
  theoryLoadMoreButton.hidden = shownCount >= matchingEntries.length;
  theoryLoadMoreButton.textContent = `Xem thêm ${Math.min(THEORY_PAGE_SIZE, matchingEntries.length - shownCount)} câu`;
}

function renderTheorySubjectOptions() {
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'Tất cả môn';
  theorySubjectFilter.replaceChildren(allOption, ...THEORY_SUBJECTS.map(subject => {
    const option = document.createElement('option');
    option.value = subject.id;
    option.textContent = subject.name;
    return option;
  }));
}

theorySubjectFilter.addEventListener('change', loadTheoryEntries);
theorySearch.addEventListener('input', () => renderTheoryEntries());
theoryLoadMoreButton.addEventListener('click', () => renderTheoryEntries(false));

refreshCacheButton.addEventListener('click', async () => {
  refreshCacheButton.disabled = true;
  refreshCacheButton.textContent = 'Đang tải bản mới...';
  refreshCacheStatus.textContent = 'Đang cập nhật giao diện và dữ liệu offline. Tiến độ, đề Excel và cài đặt sẽ được giữ nguyên.';
  try {
    const registration = await navigator.serviceWorker?.ready;
    const worker = navigator.serviceWorker?.controller || registration?.active;
    if (!worker) throw new Error('Chưa có service worker hoạt động. Hãy tải lại trang khi có mạng rồi thử lại.');

    const channel = new MessageChannel();
    const result = await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Cập nhật quá thời gian. Hãy thử lại khi kết nối mạng ổn định.')), 30000);
      channel.port1.onmessage = event => {
        window.clearTimeout(timeout);
        resolve(event.data);
      };
      worker.postMessage({ type: 'REFRESH_APP' }, [channel.port2]);
    });
    if (!result?.ok) throw new Error(result?.message || 'Không thể cập nhật cache PWA.');

    const refreshUrl = new URL(window.location.href);
    refreshUrl.searchParams.set('refresh', String(Date.now()));
    window.location.replace(refreshUrl.href);
  } catch (error) {
    refreshCacheButton.disabled = false;
    refreshCacheButton.textContent = 'Thử xóa cache và tải lại';
    refreshCacheStatus.textContent = `${error.message} Dữ liệu bài làm và bộ đề vẫn được giữ nguyên.`;
  }
});

importToggleButton.addEventListener('click', () => {
  const isOpening = importPanel.hidden;
  importPanel.hidden = !isOpening;
  importToggleButton.setAttribute('aria-expanded', String(isOpening));
});

function loadCustomExamCatalog() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_EXAMS_STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.id === 'string'
      && typeof item.name === 'string' && Number.isInteger(item.count) && item.count > 0)
      .map(item => ({
        ...item,
        categoryId: EXAM_CATEGORIES.some(category => category.id === item.categoryId)
          ? item.categoryId
          : DEFAULT_CATEGORY_ID
      })) : [];
  } catch (error) {
    console.warn('Could not read the imported exam list.', error);
    return [];
  }
}

function getExamSet(examKey) {
  return BUILTIN_EXAMS.find(item => item.id === examKey)
    || customExamCatalog.find(item => item.id === examKey)
    || null;
}

function openCustomExamDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Trình duyệt này không hỗ trợ lưu bộ đề Excel.'));
      return;
    }
    const request = indexedDB.open(CUSTOM_EXAMS_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CUSTOM_EXAMS_DB_STORE)) {
        request.result.createObjectStore(CUSTOM_EXAMS_DB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Không mở được kho lưu bộ đề trên thiết bị.'));
  });
}

async function storeCustomExam(id, questions) {
  const db = await openCustomExamDB();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(CUSTOM_EXAMS_DB_STORE, 'readwrite');
    transaction.objectStore(CUSTOM_EXAMS_DB_STORE).put({ id, questions });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(new Error('Không lưu được bộ đề Excel trên thiết bị.'));
    transaction.onabort = () => reject(new Error('Việc lưu bộ đề Excel đã bị hủy.'));
  });
  db.close();
}

async function readCustomExam(id) {
  const db = await openCustomExamDB();
  const record = await new Promise((resolve, reject) => {
    const request = db.transaction(CUSTOM_EXAMS_DB_STORE, 'readonly')
      .objectStore(CUSTOM_EXAMS_DB_STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Không đọc được bộ đề Excel đã lưu.'));
  });
  db.close();
  return record?.questions || null;
}

async function removeCustomExam(id) {
  const db = await openCustomExamDB();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(CUSTOM_EXAMS_DB_STORE, 'readwrite');
    transaction.objectStore(CUSTOM_EXAMS_DB_STORE).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(new Error('Không xóa được bộ đề khỏi thiết bị.'));
  });
  db.close();
}

async function loadQuestionData(examKey) {
  if (loadedQuestionPools.has(examKey)) return loadedQuestionPools.get(examKey);
  const set = getExamSet(examKey);
  if (!set) throw new Error('Bộ câu hỏi không hợp lệ.');

  let questions;
  if (BUILTIN_EXAMS.some(item => item.id === examKey)) {
    const response = await fetch(new URL(set.file, window.location.href));
    if (!response.ok) throw new Error(`Không tải được dữ liệu câu hỏi (${response.status}).`);
    questions = await response.json();
  } else {
    questions = await readCustomExam(examKey);
  }
  if (!Array.isArray(questions) || questions.length !== set.count) {
    throw new Error('Dữ liệu câu hỏi không hợp lệ hoặc bộ đề Excel đã bị xóa khỏi thiết bị.');
  }

  const index = new Map();
  for (const question of questions) {
    if (!question || typeof question !== 'object') {
      throw new Error('Dữ liệu câu hỏi có định dạng không hợp lệ.');
    }
    const optionLetters = Array.isArray(question.options)
      ? question.options.map(option => option?.letter)
      : [];
    if (!Number.isInteger(question.stt)
      || typeof question.q !== 'string'
      || !Array.isArray(question.options)
      || question.options.length !== QUESTION_LETTERS.length
      || !QUESTION_LETTERS.every(letter => optionLetters.includes(letter))
      || !question.options.every(option => option && typeof option.text === 'string')
      || !optionLetters.includes(question.answer)) {
      throw new Error('Dữ liệu câu hỏi có định dạng không hợp lệ.');
    }
    index.set(question.stt, question);
  }
  if (index.size !== questions.length) throw new Error('Dữ liệu có số thứ tự câu bị trùng.');

  loadedQuestionPools.set(examKey, questions);
  questionIndexes.set(examKey, index);
  return questions;
}

function updateQuestionLimit() {
  const selectedSet = getExamSet(examSelect.value);
  if (!selectedSet) {
    startBtn.disabled = true;
    deleteExamButton.hidden = true;
    return;
  }
  startBtn.disabled = false;
  const max = selectedSet.count;
  numQuestionsInput.max = String(max);
  numQuestionsInput.value = String(max);
  countError.style.display = 'none';
  countError.textContent = '';
  deleteExamButton.hidden = !customExamCatalog.some(item => item.id === examSelect.value);
}
examSelect.addEventListener('change', updateQuestionLimit);

function updateWrongCount() {
  wrongCount.textContent = `Số câu đã sai: ${wrongQuestionStts.size}`;
}

function renderCategoryOptions(selectedCategoryId = subjectFilter.value || DEFAULT_CATEGORY_ID) {
  subjectFilter.replaceChildren(...EXAM_CATEGORIES.map(category => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    return option;
  }));
  subjectFilter.value = EXAM_CATEGORIES.some(category => category.id === selectedCategoryId)
    ? selectedCategoryId
    : DEFAULT_CATEGORY_ID;
}

function renderExamOptions(selectedId = examSelect.value) {
  const categoryId = subjectFilter.value;
  const exams = [
    ...BUILTIN_EXAMS.filter(item => item.categoryId === categoryId),
    ...customExamCatalog.filter(item => item.categoryId === categoryId)
  ];
  examSelect.replaceChildren();
  if (!exams.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Chưa có bộ đề trong môn/nhóm này';
    option.disabled = true;
    option.selected = true;
    examSelect.appendChild(option);
  } else {
    exams.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} (${item.count.toLocaleString('vi-VN')} câu)`;
      examSelect.appendChild(option);
    });
    examSelect.value = exams.some(item => item.id === selectedId) ? selectedId : exams[0].id;
  }
  updateQuestionLimit();
}
subjectFilter.addEventListener('change', () => renderExamOptions());

function normalizeHeader(value) {
  return String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
}

function parseQuestionSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error('Không tìm thấy sheet đã chọn.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const columns = {
    stt: ['stt', 'sothutu'],
    question: ['tencauhoi', 'cauhoi', 'noidungcauhoi', 'question'],
    A: ['dapana', 'phuonga', 'optiona', 'a'],
    B: ['dapanb', 'phuongb', 'optionb', 'b'],
    C: ['dapanc', 'phuongc', 'optionc', 'c'],
    D: ['dapand', 'phuongd', 'optiond', 'd'],
    answer: ['dapandung', 'dapanchinhxac', 'dapan', 'correctanswer', 'answer']
  };
  const headerRowIndex = rows.slice(0, 20).findIndex(row => {
    const values = row.map(normalizeHeader);
    return Object.values(columns).every(aliases => aliases.some(alias => values.includes(alias)));
  });
  if (headerRowIndex < 0) {
    throw new Error('Không tìm thấy hàng tiêu đề. Cần các cột STT, Tên câu hỏi, Đáp án A-D, Đáp án đúng.');
  }

  const headerValues = rows[headerRowIndex].map(normalizeHeader);
  const indexes = Object.fromEntries(Object.entries(columns).map(([key, aliases]) => [
    key,
    headerValues.findIndex(value => aliases.includes(value))
  ]));
  const questions = [];
  const seenStts = new Set();
  rows.slice(headerRowIndex + 1).forEach((row, offset) => {
    if (row.every(value => String(value ?? '').trim() === '')) return;
    const rowNumber = headerRowIndex + offset + 2;
    const sttValue = Number(String(row[indexes.stt] ?? '').trim());
    const questionText = String(row[indexes.question] ?? '').trim();
    const options = QUESTION_LETTERS.map(letter => ({
      letter,
      text: String(row[indexes[letter]] ?? '').trim()
    }));
    const answerValue = String(row[indexes.answer] ?? '').trim().toUpperCase();
    const answerMatch = answerValue.match(/^([ABCD])(?:\b|[.)\s:-]|$)/);
    if (!Number.isInteger(sttValue) || sttValue < 1) {
      throw new Error(`Dòng ${rowNumber}: STT phải là số nguyên dương.`);
    }
    if (seenStts.has(sttValue)) throw new Error(`Dòng ${rowNumber}: STT ${sttValue} bị trùng.`);
    if (!questionText || options.some(option => !option.text)) {
      throw new Error(`Dòng ${rowNumber}: câu hỏi và đủ bốn lựa chọn A-D không được để trống.`);
    }
    if (!answerMatch) throw new Error(`Dòng ${rowNumber}: đáp án đúng phải là A, B, C hoặc D.`);
    seenStts.add(sttValue);
    questions.push({ stt: sttValue, q: questionText, options, answer: answerMatch[1] });
  });
  if (!questions.length) throw new Error('Sheet không có dòng câu hỏi nào.');
  return questions;
}

function setExcelImportStatus(message, state = '') {
  excelImportStatus.textContent = message;
  excelImportStatus.dataset.error = state === 'error' ? 'true' : 'false';
  excelImportStatus.dataset.success = state === 'success' ? 'true' : 'false';
}

excelFileInput.addEventListener('change', async () => {
  pendingWorkbook = null;
  validExcelSheets = [];
  importExamButton.disabled = true;
  excelSheetGroup.hidden = true;
  excelNameGroup.hidden = true;
  excelCategoryGroup.hidden = true;
  const file = excelFileInput.files?.[0];
  if (!file) return;
  if (!/\.xlsx?$/i.test(file.name)) {
    setExcelImportStatus('Chỉ hỗ trợ file Excel .xlsx hoặc .xls.', 'error');
    return;
  }
  try {
    const bytes = await file.arrayBuffer();
    pendingWorkbook = XLSX.read(bytes, { type: 'array' });
    validExcelSheets = pendingWorkbook.SheetNames.filter(sheetName => {
      if (/mau\s*nhap|template/i.test(normalizeHeader(sheetName))) return false;
      try {
        parseQuestionSheet(pendingWorkbook, sheetName);
        return true;
      } catch (error) {
        return false;
      }
    });
    if (!validExcelSheets.length) throw new Error('Không có sheet nào đúng định dạng mẫu.');
    excelSheetSelect.replaceChildren(...validExcelSheets.map(sheetName => {
      const option = document.createElement('option');
      option.value = sheetName;
      option.textContent = sheetName;
      return option;
    }));
    excelSheetGroup.hidden = validExcelSheets.length < 2;
    excelNameGroup.hidden = false;
    excelCategoryGroup.hidden = false;
    excelExamNameInput.value = validExcelSheets[0];
    importExamButton.disabled = false;
    const count = parseQuestionSheet(pendingWorkbook, validExcelSheets[0]).length;
    setExcelImportStatus(`Đã nhận diện ${validExcelSheets.length} sheet hợp lệ. Sheet đang chọn có ${count} câu.`);
  } catch (error) {
    pendingWorkbook = null;
    setExcelImportStatus(error.message || 'Không đọc được file Excel.', 'error');
  }
});

excelSheetSelect.addEventListener('change', () => {
  if (!pendingWorkbook) return;
  excelExamNameInput.value = excelSheetSelect.value;
  const count = parseQuestionSheet(pendingWorkbook, excelSheetSelect.value).length;
  setExcelImportStatus(`Sheet đang chọn có ${count} câu.`);
});

importExamButton.addEventListener('click', async () => {
  if (!pendingWorkbook) return;
  const name = excelExamNameInput.value.trim();
  if (!name) {
    setExcelImportStatus('Hãy nhập tên cho mã đề.', 'error');
    excelExamNameInput.focus();
    return;
  }
  importExamButton.disabled = true;
  try {
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const questions = parseQuestionSheet(pendingWorkbook, excelSheetSelect.value);
    await storeCustomExam(id, questions);
    const categoryId = excelCategorySelect.value;
    customExamCatalog.push({ id, name, count: questions.length, categoryId });
    try {
      localStorage.setItem(CUSTOM_EXAMS_STORAGE_KEY, JSON.stringify(customExamCatalog));
    } catch (error) {
      customExamCatalog.pop();
      await removeCustomExam(id);
      throw new Error('Không đủ dung lượng để lưu danh sách bộ đề trên thiết bị.');
    }
    loadedQuestionPools.set(id, questions);
    questionIndexes.set(id, new Map(questions.map(question => [question.stt, question])));
    subjectFilter.value = categoryId;
    renderExamOptions(id);
    setExcelImportStatus(`Đã thêm “${name}” gồm ${questions.length} câu. Bộ đề đã lưu trên thiết bị và dùng được offline.`, 'success');
    excelFileInput.value = '';
    pendingWorkbook = null;
    validExcelSheets = [];
    importExamButton.disabled = true;
  } catch (error) {
    setExcelImportStatus(error.message || 'Không thể lưu bộ đề Excel.', 'error');
    importExamButton.disabled = false;
  }
});

deleteExamButton.addEventListener('click', async () => {
  const exam = customExamCatalog.find(item => item.id === examSelect.value);
  if (!exam || !window.confirm(`Xóa bộ đề “${exam.name}” khỏi thiết bị?`)) return;
  try {
    await removeCustomExam(exam.id);
    const catalogIndex = customExamCatalog.findIndex(item => item.id === exam.id);
    customExamCatalog.splice(catalogIndex, 1);
    localStorage.setItem(CUSTOM_EXAMS_STORAGE_KEY, JSON.stringify(customExamCatalog));
    loadedQuestionPools.delete(exam.id);
    questionIndexes.delete(exam.id);
    if (readSavedProgress()?.examKey === exam.id) clearSavedProgress();
    subjectFilter.value = exam.categoryId;
    renderExamOptions();
    setExcelImportStatus(`Đã xóa bộ đề “${exam.name}” khỏi thiết bị.`, 'success');
  } catch (error) {
    setExcelImportStatus(error.message || 'Không thể xóa bộ đề.', 'error');
  }
});

function shuffleAndTake(array, count) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function showScreen(screenToShow) {
  [setupScreen, quizScreen, resultScreen].forEach(screen => screen.classList.remove('active'));
  screenToShow.classList.add('active');
  updatePrimaryTabsVisibility();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

startBtn.addEventListener('click', async () => {
  const selectedSet = getExamSet(examSelect.value);
  if (!selectedSet) {
    countError.textContent = 'Vui lòng chọn một bộ đề hợp lệ.';
    countError.style.display = 'block';
    return;
  }
  const max = selectedSet.count;
  const rawCount = Number.parseInt(numQuestionsInput.value, 10);
  if (!Number.isInteger(rawCount) || rawCount < 1 || rawCount > max) {
    countError.textContent = `Vui lòng nhập số từ 1 đến ${max}.`;
    countError.style.display = 'block';
    return;
  }

  startBtn.disabled = true;
  startBtn.textContent = 'Đang tải bộ câu hỏi...';
  countError.style.display = 'none';
  try {
    const pool = await loadQuestionData(examSelect.value);
    clearSavedProgress();
    selectedExamName = selectedSet.name;
    sessionQuestions = shuffleAndTake(pool, rawCount);
    activeQuestions = sessionQuestions.slice();
    wrongQuestions = [];
    nextWrongQuestions = [];
    wrongQuestionStts = new Set();
    firstAttemptResults = {};
    currentIndex = 0;
    retryRound = 0;
    isRetryMode = false;
    currentAnswered = false;
    currentOptionOrder = null;
    selectedSourceLetter = null;
    autoAdvanceAt = null;

    modeIndicator.textContent = 'Lần thi đầu tiên';
    showScreen(quizScreen);
    loadQuestion();
  } catch (error) {
    console.error('Could not start the quiz.', error);
    countError.textContent = `${error.message} Vui lòng kiểm tra kết nối rồi thử lại.`;
    countError.style.display = 'block';
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = 'Bắt đầu làm bài';
  }
});

function clearSavedProgress() {
  if (autoAdvanceTimer !== null) {
    window.clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
  try {
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
    resumeBtn.style.display = 'none';
    return true;
  } catch (error) {
    console.warn('Could not clear saved quiz progress.', error);
    progressSaveNote.textContent = 'Không thể xóa tiến độ đã lưu trên trình duyệt này.';
    return false;
  }
}

function saveProgress() {
  if (!sessionQuestions.length) return;
  const progress = {
    examKey: examSelect.value,
    sessionQuestionStts: sessionQuestions.map(question => question.stt),
    activeQuestionStts: activeQuestions.map(question => question.stt),
    wrongQuestionStts: wrongQuestions.map(question => question.stt),
    nextWrongQuestionStts: nextWrongQuestions.map(question => question.stt),
    answeredWrongQuestionStts: [...wrongQuestionStts],
    firstAttemptResults,
    currentIndex,
    retryRound,
    isRetryMode,
    currentAnswered,
    currentOptionOrder,
    selectedSourceLetter,
    autoAdvanceAt
  };
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    progressSaveNote.textContent = 'Tiến độ bài làm được tự động lưu trên thiết bị này.';
    resumeBtn.style.display = 'block';
  } catch (error) {
    console.warn('Could not save quiz progress.', error);
    progressSaveNote.textContent = 'Không thể lưu tiến độ trên trình duyệt này.';
  }
}

function stopAutoAdvance() {
  if (autoAdvanceTimer !== null) {
    window.clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
  if (currentAnswered) autoAdvanceAt = Date.now() + getAutoAdvanceDelay(activeQuestions[currentIndex], selectedSourceLetter);
}

function openPauseModal() {
  if (!sessionQuestions.length || !quizScreen.classList.contains('active')) return;
  stopAutoAdvance();
  saveProgress();
  pauseModal.hidden = false;
  continueBtn.focus();
}

function closePauseModal() {
  pauseModal.hidden = true;
  pausedForBackground = false;
}

pauseBtn.addEventListener('click', openPauseModal);

continueBtn.addEventListener('click', () => {
  closePauseModal();
  scheduleAutoAdvance();
  pauseBtn.focus();
});

exitQuizBtn.addEventListener('click', () => {
  stopAutoAdvance();
  saveProgress();
  closePauseModal();
  showScreen(setupScreen);
  resumeBtn.style.display = 'block';
  progressSaveNote.textContent = 'Bài làm đã tạm lưu. Bạn có thể tiếp tục từ câu đang làm bất cứ lúc nào.';
  resumeBtn.focus();
});

pauseModal.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    continueBtn.click();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && sessionQuestions.length) {
    pausedForBackground = quizScreen.classList.contains('active');
    stopAutoAdvance();
    saveProgress();
  } else if (document.visibilityState === 'visible' && pausedForBackground) {
    pausedForBackground = false;
    openPauseModal();
  }
});

window.addEventListener('pagehide', () => {
  if (sessionQuestions.length) {
    stopAutoAdvance();
    saveProgress();
  }
});

function readSavedProgress() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || 'null');
  } catch (error) {
    console.warn('Could not read saved quiz progress.', error);
    progressSaveNote.textContent = 'Không thể đọc tiến độ đã lưu trên trình duyệt này.';
    return null;
  }
  if (!saved) return null;
  if (!getExamSet(saved.examKey)) {
    console.warn('Saved quiz progress has an invalid exam key.');
    clearSavedProgress();
    return null;
  }
  return saved;
}

async function loadSavedProgress() {
  const saved = readSavedProgress();
  if (!saved) return null;
  let pool;
  try {
    pool = await loadQuestionData(saved.examKey);
  } catch (error) {
    console.error('Could not load question data for saved progress.', error);
    countError.textContent = `${error.message} Không thể tiếp tục bài làm khi chưa tải được dữ liệu.`;
    countError.style.display = 'block';
    return null;
  }
  const restoreQuestions = stts => Array.isArray(stts)
    ? stts.map(stt => questionIndexes.get(saved.examKey).get(stt) || pool.find(question => question.stt === stt))
    : null;
  const restoredSession = restoreQuestions(saved.sessionQuestionStts);
  const restoredActive = restoreQuestions(saved.activeQuestionStts);
  const restoredWrong = restoreQuestions(saved.wrongQuestionStts);
  const restoredNextWrong = restoreQuestions(saved.nextWrongQuestionStts);
  const previousWrongStts = [
    ...(Array.isArray(saved.wrongQuestionStts) ? saved.wrongQuestionStts : []),
    ...(Array.isArray(saved.nextWrongQuestionStts) ? saved.nextWrongQuestionStts : [])
  ];
  const answeredWrongStts = Array.isArray(saved.answeredWrongQuestionStts)
    ? saved.answeredWrongQuestionStts
    : [
      ...previousWrongStts,
      ...Object.entries(saved.firstAttemptResults || {})
        .filter(([, isCorrect]) => isCorrect === false)
        .map(([stt]) => Number(stt))
    ];
  const valid = (questions, expectedLength) => questions
    && questions.length === expectedLength
    && questions.every(Boolean);

  if (!valid(restoredSession, saved.sessionQuestionStts?.length)
    || !valid(restoredActive, saved.activeQuestionStts?.length)
    || !valid(restoredWrong, saved.wrongQuestionStts?.length)
    || !valid(restoredNextWrong, saved.nextWrongQuestionStts?.length)
    || !Array.isArray(answeredWrongStts)
    || answeredWrongStts.some(stt => !Number.isInteger(stt) || !questionIndexes.get(saved.examKey).has(stt))
    || restoredActive.length === 0
    || !Number.isInteger(saved.currentIndex)
    || saved.currentIndex < 0
    || saved.currentIndex >= restoredActive.length
    || !Number.isInteger(saved.retryRound)
    || typeof saved.isRetryMode !== 'boolean'
    || typeof saved.currentAnswered !== 'boolean'
    || !saved.firstAttemptResults
    || typeof saved.firstAttemptResults !== 'object'
    || Array.isArray(saved.firstAttemptResults)
    || (saved.currentAnswered && (!QUESTION_LETTERS.includes(saved.selectedSourceLetter)
      || !Number.isFinite(saved.autoAdvanceAt)))) {
    console.warn('Saved quiz progress is invalid and cannot be resumed.');
    progressSaveNote.textContent = 'Tiến độ đã lưu không hợp lệ, vui lòng bắt đầu bài mới.';
    clearSavedProgress();
    return null;
  }

  return {
    ...saved,
    sessionQuestions: restoredSession,
    activeQuestions: restoredActive,
    wrongQuestions: restoredWrong,
    nextWrongQuestions: restoredNextWrong,
    answeredWrongQuestionStts: [...new Set(answeredWrongStts)],
    examName: getExamSet(saved.examKey).name
  };
}

resumeBtn.addEventListener('click', async () => {
  resumeBtn.disabled = true;
  resumeBtn.textContent = 'Đang khôi phục bài làm...';
  const saved = await loadSavedProgress();
  if (!saved) {
    if (!readSavedProgress()) resumeBtn.style.display = 'none';
    resumeBtn.disabled = false;
    resumeBtn.textContent = 'Tiếp tục bài đang làm';
    return;
  }

  subjectFilter.value = getExamSet(saved.examKey).categoryId;
  renderExamOptions(saved.examKey);
  sessionQuestions = saved.sessionQuestions;
  activeQuestions = saved.activeQuestions;
  wrongQuestions = saved.wrongQuestions;
  nextWrongQuestions = saved.nextWrongQuestions;
  wrongQuestionStts = new Set(saved.answeredWrongQuestionStts);
  updateWrongCount();
  firstAttemptResults = saved.firstAttemptResults || {};
  currentIndex = saved.currentIndex;
  retryRound = saved.retryRound;
  isRetryMode = saved.isRetryMode;
  currentAnswered = saved.currentAnswered;
  currentOptionOrder = saved.currentOptionOrder;
  selectedSourceLetter = saved.selectedSourceLetter;
  autoAdvanceAt = currentAnswered
    ? Date.now() + getAutoAdvanceDelay(activeQuestions[currentIndex], selectedSourceLetter)
    : saved.autoAdvanceAt;
  selectedExamName = saved.examName;
  showScreen(quizScreen);
  loadQuestion(true);
  resumeBtn.disabled = false;
  resumeBtn.textContent = 'Tiếp tục bài đang làm';
  pauseBtn.focus();
});

function loadQuestion(resuming = false) {
  if (autoAdvanceTimer !== null) {
    window.clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
  if (!resuming) {
    currentAnswered = false;
    selectedSourceLetter = null;
    autoAdvanceAt = null;
  }
  feedbackBox.className = 'feedback';
  feedbackBox.textContent = '';
  const q = activeQuestions[currentIndex];
  updateWrongCount();
  progressText.textContent = `Câu ${currentIndex + 1} / ${activeQuestions.length}`;
  modeIndicator.textContent = isRetryMode ? `Ôn lại câu sai - vòng ${retryRound} (${activeQuestions.length} câu)` : 'Lần thi đầu tiên';
  progressFill.style.width = `${((currentIndex + 1) / activeQuestions.length) * 100}%`;
  questionMeta.textContent = `STT gốc trong tài liệu: ${q.stt}`;
  questionText.textContent = `Câu ${q.stt}. ${q.q}`;
  optionsList.innerHTML = '';

  const validOrder = Array.isArray(currentOptionOrder)
    && currentOptionOrder.length === q.options.length
    && new Set(currentOptionOrder).size === q.options.length
    && currentOptionOrder.every(letter => q.options.some(option => option.letter === letter));
  if (!validOrder) {
    currentOptionOrder = shuffleAndTake(q.options, q.options.length).map(option => option.letter);
  }

  const displayedOptions = currentOptionOrder.map((sourceLetter, index) => {
    const option = q.options.find(candidate => candidate.letter === sourceLetter);
    return { ...option, sourceLetter, letter: QUESTION_LETTERS[index] };
  });
  displayedOptions.forEach(option => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option-item';
    button.dataset.sourceLetter = option.sourceLetter;

    const letter = document.createElement('span');
    letter.className = 'option-letter';
    letter.textContent = option.letter;
    const label = document.createElement('span');
    label.textContent = option.text;
    button.append(letter, label);
    button.addEventListener('click', () => selectOption(option.sourceLetter));
    li.appendChild(button);
    optionsList.appendChild(li);
  });

  if (currentAnswered && selectedSourceLetter) {
    restoreAnsweredQuestion(q, displayedOptions);
  }
  saveProgress();
}

function restoreAnsweredQuestion(question, displayedOptions) {
  const correctOption = displayedOptions.find(option => option.sourceLetter === question.answer);
  optionsList.querySelectorAll('.option-item').forEach(button => {
    button.disabled = true;
    const sourceLetter = button.dataset.sourceLetter;
    if (sourceLetter === question.answer) button.classList.add('correct');
    if (sourceLetter === selectedSourceLetter && sourceLetter !== question.answer) {
      button.classList.add('incorrect');
    }
  });
  const isCorrect = selectedSourceLetter === question.answer;
  feedbackBox.textContent = isCorrect
    ? 'Chính xác! Bạn đã chọn đúng đáp án.'
    : `Chưa chính xác. Đáp án đúng là ${correctOption.letter}. ${correctOption.text}`;
  feedbackBox.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
  scheduleAutoAdvance();
}

function scheduleAutoAdvance() {
  if (!currentAnswered || !Number.isFinite(autoAdvanceAt)) return;
  const delay = Math.max(0, autoAdvanceAt - Date.now());
  autoAdvanceTimer = window.setTimeout(advanceQuestion, delay);
}

function getAutoAdvanceDelay(question, selectedSource) {
  const settings = getQuizSettings();
  const correctDelayMs = (Number(settings.correctDelaySeconds) || DEFAULT_SETTINGS.correctDelaySeconds) * 1000;
  return selectedSource === question?.answer ? correctDelayMs : 2000;
}

function selectOption(selectedSource) {
  if (currentAnswered) return;
  currentAnswered = true;
  selectedSourceLetter = selectedSource;
  const question = activeQuestions[currentIndex];
  autoAdvanceAt = Date.now() + getAutoAdvanceDelay(question, selectedSource);
  const correctOption = question.options.find(option => option.letter === question.answer);
  const buttons = optionsList.querySelectorAll('.option-item');
  buttons.forEach(button => {
    button.disabled = true;
    if (button.dataset.sourceLetter === question.answer) button.classList.add('correct');
  });

  const isCorrect = selectedSource === question.answer;
  if (!isCorrect) {
    wrongQuestionStts.add(question.stt);
    updateWrongCount();
    optionsList.querySelector(`[data-source-letter="${selectedSource}"]`)?.classList.add('incorrect');
  }

  if (!isRetryMode) firstAttemptResults[question.stt] = isCorrect;
  if (!isCorrect) nextWrongQuestions.push(question);

  if (isCorrect) {
    feedbackBox.textContent = 'Chính xác! Bạn đã chọn đúng đáp án.';
    feedbackBox.className = 'feedback correct';
  } else {
    const displayedCorrectLetter = currentOptionOrder
      .indexOf(correctOption.letter);
    feedbackBox.textContent = `Chưa chính xác. Đáp án đúng là ${QUESTION_LETTERS[displayedCorrectLetter]}. ${correctOption.text}`;
    feedbackBox.className = 'feedback incorrect';
  }
  saveProgress();
  scheduleAutoAdvance();
}

function advanceQuestion() {
  if (!currentAnswered) return;
  if (autoAdvanceTimer !== null) {
    window.clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
  currentIndex++;
  if (currentIndex < activeQuestions.length) {
    currentOptionOrder = null;
    loadQuestion();
  } else {
    finishCurrentRound();
  }
}

function finishCurrentRound() {
  wrongQuestions = nextWrongQuestions.slice();
  nextWrongQuestions = [];
  if (!isRetryMode) {
    showResult();
    return;
  }

  if (wrongQuestions.length > 0) {
    activeQuestions = wrongQuestions.slice();
    wrongQuestions = [];
    currentIndex = 0;
    retryRound++;
    currentOptionOrder = null;
    loadQuestion();
    return;
  }
  showResult();
}

function getFirstAttemptStats() {
  const total = sessionQuestions.length;
  const correct = sessionQuestions.reduce((sum, q) => sum + (firstAttemptResults[q.stt] === true ? 1 : 0), 0);
  return { total, correct };
}

function showResult() {
  const stats = getFirstAttemptStats();
  const progressCleared = clearSavedProgress();

  const message = document.getElementById('result-message');
  const retryDescription = document.getElementById('retry-description');
  const retryButton = document.getElementById('retry-wrong-btn');

  if (wrongQuestions.length > 0) {
    retrySection.style.display = 'block';
    retryButton.textContent = 'Làm lại các câu sai';
    if (isRetryMode) {
      message.textContent = `Kết quả lần đầu: ${stats.correct}/${stats.total} câu đúng.`;
      retryDescription.textContent = `Vòng ôn tập ${retryRound} vẫn còn câu chưa đúng. Hãy tiếp tục làm lại; kết quả lần đầu không thay đổi.`;
    } else {
      message.textContent = `Bạn đúng ${stats.correct}/${stats.total} câu.`;
      retryDescription.textContent = 'Bạn còn câu trả lời sai. Làm lại các câu này đến khi trả lời đúng hết.';
    }
  } else {
    retrySection.style.display = 'none';
    message.textContent = `${isRetryMode ? 'Kết quả lần đầu' : 'Kết quả'}: ${stats.correct}/${stats.total} câu đúng.`;
  }

  document.getElementById('storage-note').textContent = progressCleared
    ? 'Tiến độ bài làm đã hoàn tất và được xóa khỏi thiết bị.'
    : 'Không thể xóa tiến độ bài làm khỏi thiết bị.';
  showScreen(resultScreen);
}

document.getElementById('retry-wrong-btn').addEventListener('click', () => {
  if (!wrongQuestions.length) return;
  activeQuestions = wrongQuestions.slice();
  wrongQuestions = [];
  nextWrongQuestions = [];
  currentIndex = 0;
  isRetryMode = true;
  currentOptionOrder = null;
  retryRound++;
  showScreen(quizScreen);
  loadQuestion();
});

document.getElementById('restart-btn').addEventListener('click', () => {
  clearSavedProgress();
  showScreen(setupScreen);
  updateQuestionLimit();
});

renderCategoryOptions();
renderTheorySubjectOptions();
excelCategorySelect.replaceChildren(...EXAM_CATEGORIES.map(category => {
  const option = document.createElement('option');
  option.value = category.id;
  option.textContent = category.name;
  return option;
}));
renderExamOptions(BUILTIN_EXAMS[0].id);
if (readSavedProgress()) {
  resumeBtn.style.display = 'block';
  progressSaveNote.textContent = 'Có bài làm đang lưu trên thiết bị này. Bạn có thể tiếp tục hoặc bắt đầu bài mới.';
}

if ('serviceWorker' in navigator) {
  const swUrl = new URL('./service-worker.js', window.location.href).href;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl, { scope: './', updateViaCache: 'none' })
      .then(registration => {
        registration.update().catch(() => {});
      })
      .catch(error => {
        console.warn('Service worker registration failed.', error);
      });
  });
}
