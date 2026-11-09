// DỮ LIỆU NGUỒN: Word 1.000 câu và PDF 256 câu do người dùng cung cấp.
// Mỗi câu giữ nguyên STT, nội dung, bốn lựa chọn và đáp án đánh dấu trong tài liệu.



const PROGRESS_STORAGE_KEY = 'quanYQuizTienDo_v1';
const QUESTION_LETTERS = ['A', 'B', 'C', 'D'];
const QUESTION_SETS = {
  easy: { count: 1000, file: './questions-easy.json' },
  hard: { count: 256, file: './questions-hard.json' }
};
const loadedQuestionPools = new Map();
const questionIndexes = new Map();
let activeQuestions = [];
let sessionQuestions = [];
let wrongQuestions = [];
let nextWrongQuestions = [];
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

const examSelect = document.getElementById('exam-select');
const numQuestionsInput = document.getElementById('num-questions');
const countError = document.getElementById('count-error');
const startBtn = document.getElementById('start-btn');
const resumeBtn = document.getElementById('resume-btn');
const progressSaveNote = document.getElementById('progress-save-note');
const pauseBtn = document.getElementById('pause-btn');
const pauseModal = document.getElementById('pause-modal');
const continueBtn = document.getElementById('continue-btn');
const exitQuizBtn = document.getElementById('exit-quiz-btn');
const nextBtn = document.getElementById('next-btn');
const setupScreen = document.getElementById('setup-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');
const progressText = document.getElementById('progress-text');
const modeIndicator = document.getElementById('mode-indicator');
const progressFill = document.getElementById('progress-fill');
const questionMeta = document.getElementById('question-meta');
const questionText = document.getElementById('question-text');
const optionsList = document.getElementById('options-list');
const feedbackBox = document.getElementById('feedback-box');
const retrySection = document.getElementById('retry-section');
let pausedForBackground = false;

async function loadQuestionData(examKey) {
  if (loadedQuestionPools.has(examKey)) return loadedQuestionPools.get(examKey);
  const set = QUESTION_SETS[examKey];
  if (!set) throw new Error('Bộ câu hỏi không hợp lệ.');

  const response = await fetch(new URL(set.file, window.location.href));
  if (!response.ok) throw new Error(`Không tải được dữ liệu câu hỏi (${response.status}).`);
  const questions = await response.json();
  if (!Array.isArray(questions) || questions.length !== set.count) {
    throw new Error(`Dữ liệu câu hỏi không hợp lệ: cần ${set.count} câu.`);
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
  const max = QUESTION_SETS[examSelect.value].count;
  numQuestionsInput.max = String(max);
  const current = Number.parseInt(numQuestionsInput.value, 10);
  if (!Number.isFinite(current) || current < 1) numQuestionsInput.value = '20';
  else if (current > max) numQuestionsInput.value = String(max);
  countError.style.display = 'none';
  countError.textContent = '';
}
examSelect.addEventListener('change', updateQuestionLimit);

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
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

startBtn.addEventListener('click', async () => {
  const max = QUESTION_SETS[examSelect.value].count;
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
    selectedExamName = examSelect.value === 'easy'
      ? 'Tổ chức chiến thuật quân y - 1.000 câu'
      : 'Đề cương ôn tập Quân y - 256 câu';
    sessionQuestions = shuffleAndTake(pool, rawCount);
    activeQuestions = sessionQuestions.slice();
    wrongQuestions = [];
    nextWrongQuestions = [];
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
  if (currentAnswered) autoAdvanceAt = Date.now() + 2000;
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
  if (!QUESTION_SETS[saved.examKey]) {
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
  const valid = (questions, expectedLength) => questions
    && questions.length === expectedLength
    && questions.every(Boolean);

  if (!valid(restoredSession, saved.sessionQuestionStts?.length)
    || !valid(restoredActive, saved.activeQuestionStts?.length)
    || !valid(restoredWrong, saved.wrongQuestionStts?.length)
    || !valid(restoredNextWrong, saved.nextWrongQuestionStts?.length)
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
    examName: saved.examKey === 'easy'
      ? 'Tổ chức chiến thuật quân y - 1.000 câu'
      : 'Đề cương ôn tập Quân y - 256 câu'
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

  examSelect.value = saved.examKey;
  updateQuestionLimit();
  sessionQuestions = saved.sessionQuestions;
  activeQuestions = saved.activeQuestions;
  wrongQuestions = saved.wrongQuestions;
  nextWrongQuestions = saved.nextWrongQuestions;
  firstAttemptResults = saved.firstAttemptResults || {};
  currentIndex = saved.currentIndex;
  retryRound = saved.retryRound;
  isRetryMode = saved.isRetryMode;
  currentAnswered = saved.currentAnswered;
  currentOptionOrder = saved.currentOptionOrder;
  selectedSourceLetter = saved.selectedSourceLetter;
  autoAdvanceAt = currentAnswered ? Date.now() + 2000 : saved.autoAdvanceAt;
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
  nextBtn.style.display = 'none';
  nextBtn.textContent = currentIndex === activeQuestions.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo';

  const q = activeQuestions[currentIndex];
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
  const selectedOption = displayedOptions.find(option => option.sourceLetter === selectedSourceLetter);
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
  nextBtn.style.display = 'block';
  nextBtn.textContent = selectedOption ? `Tiếp tục (${Math.max(0, Math.ceil((autoAdvanceAt - Date.now()) / 1000))}s)` : 'Tiếp tục';
  scheduleAutoAdvance();
}

function scheduleAutoAdvance() {
  if (!currentAnswered || !Number.isFinite(autoAdvanceAt)) return;
  const delay = Math.max(0, autoAdvanceAt - Date.now());
  autoAdvanceTimer = window.setTimeout(advanceQuestion, delay);
}

function selectOption(selectedSource) {
  if (currentAnswered) return;
  currentAnswered = true;
  selectedSourceLetter = selectedSource;
  autoAdvanceAt = Date.now() + 2000;
  const question = activeQuestions[currentIndex];
  const correctOption = question.options.find(option => option.letter === question.answer);
  const buttons = optionsList.querySelectorAll('.option-item');
  buttons.forEach(button => {
    button.disabled = true;
    if (button.dataset.sourceLetter === question.answer) button.classList.add('correct');
  });

  const isCorrect = selectedSource === question.answer;
  if (!isCorrect) {
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
  nextBtn.style.display = 'block';
  nextBtn.textContent = `Câu tiếp theo (2s)`;
  saveProgress();
  scheduleAutoAdvance();
}

nextBtn.addEventListener('click', () => {
  if (!currentAnswered) return;
  if (autoAdvanceTimer !== null) {
    window.clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
  advanceQuestion();
});

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

updateQuestionLimit();
if (readSavedProgress()) {
  resumeBtn.style.display = 'block';
  progressSaveNote.textContent = 'Có bài làm đang lưu trên thiết bị này. Bạn có thể tiếp tục hoặc bắt đầu bài mới.';
}

if ('serviceWorker' in navigator) {
  const swUrl = new URL('./service-worker.js', window.location.href).href;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl, { scope: './' })
      .then(() => {
        console.info('Service worker registered for offline quiz support.');
      })
      .catch(() => {
        console.warn('Service worker registration failed. App still works online only.');
      });
  });
}
