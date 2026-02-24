const QUESTION_COUNT = 20;
const TIME_LIMIT = 10;

// --- 상태 변수 ---
let currentTheme = null;
let currentQuestions = [];
let currentIndex = 0;
let wrongCount = 0;
let timerInterval = null;
let selectedThemeId = null;

// --- 오디오 객체 생성 ---
const timerAudio = new Audio('assets/timer.mp3');
timerAudio.loop = false;

const correctAudio = new Audio('assets/correct.mp3');
const wrongAudio = new Audio('assets/wrong.mp3');
const clearAudio = new Audio('assets/clear.mp3');
// --- DOM 요소 ---
const themeList = document.getElementById('theme-list');
const timerFill = document.getElementById('timer-fill');
const flashCard = document.querySelector('.flash-card');
const exitModal = document.getElementById('exit-modal');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const startGuideModal = document.getElementById('start-guide-modal');
const guideStartBtn = document.getElementById('guide-start-btn');
const guideCloseBtn = document.getElementById('guide-close-btn');

// --- 모바일 실제 가시 영역(vh) 계산 ---
function setScreenSize() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

setScreenSize();
window.addEventListener('resize', setScreenSize);

// --- 초기화 ---
init();

function init() {
  renderLobby();

  const openingScreen = document.getElementById('opening-screen');
  const securityModal = document.getElementById('security-modal');
  const securityConfirmBtn = document.getElementById('security-confirm-btn');

  if (openingScreen) {
    openingScreen.onclick = () => {
      const video = document.getElementById('opening-video');
      if (video) video.pause();
      securityModal.style.display = 'flex';
    };
  }

  if (securityConfirmBtn) {
    securityConfirmBtn.onclick = () => {
      securityModal.style.display = 'none';
      showScreen('lobby-screen');
    };
  }

  if (flashCard) {
    flashCard.onclick = () => {
      document.getElementById('q-pinyin').classList.add('visible');
    };
  }

  guideStartBtn.onclick = () => {
    startGuideModal.style.display = 'none';
    startGame(selectedThemeId);
  };

  guideCloseBtn.onclick = () => {
    startGuideModal.style.display = 'none';
  };

  document.getElementById('close-game').onclick = () => {
    resetTimer();
    exitModal.style.display = 'flex';
  };

  modalCancelBtn.onclick = () => {
    exitModal.style.display = 'none';
    startTimer();
  };

  modalConfirmBtn.onclick = () => {
    exitModal.style.display = 'none';
    showScreen('lobby-screen');
  };

  const lockedModal = document.getElementById('locked-modal');
  const lockedCloseBtn = document.getElementById('locked-close-btn');

  if (lockedCloseBtn) {
    lockedCloseBtn.onclick = () => {
      lockedModal.style.display = 'none';
    };
  }
}

function renderLobby() {
  themeList.innerHTML = '';
  const clearedData = JSON.parse(
    localStorage.getItem('jindam_cleared_hsk') || '[]',
  );
  const total = themesData.length;
  const cleared = clearedData.length;

  document.getElementById('total-cleared').innerText = `${cleared}/${total}`;
  document.getElementById('total-progress').style.width =
    `${(cleared / total) * 100}%`;

  themesData.forEach((theme) => {
    const isCleared = clearedData.includes(theme.id);
    const isLocked = false; // 10번 초과 잠금 로직 유지

    const card = document.createElement('div');
    card.className = `theme-card ${isCleared ? 'cleared' : ''} ${isLocked ? 'locked' : ''}`;

    card.onclick = () => {
      if (isLocked) {
        document.getElementById('locked-modal').style.display = 'flex';
      } else {
        selectedThemeId = theme.id;
        startGuideModal.style.display = 'flex';
      }
    };

    card.innerHTML = `
      ${
        isLocked
          ? '<div class="lock-badge">🔒</div>'
          : isCleared
            ? '<div class="stamp">👑</div>'
            : ''
      }
      <div class="theme-icon">${theme.icon}</div>
      <div class="theme-title">${theme.title}</div>
    `;
    themeList.appendChild(card);
  });
}

function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  const targetScreen = document.getElementById(screenId);

  targetScreen.classList.add('active');
  screens.forEach((s) => {
    if (s.id !== screenId) {
      s.classList.remove('active');
    }
  });
  targetScreen.scrollTop = 0;
}

function startGame(themeId) {
  currentTheme = themesData.find((t) => t.id === themeId);
  if (!currentTheme) return;
  currentQuestions = [...currentTheme.words]
    .sort(() => Math.random() - 0.5)
    .slice(0, QUESTION_COUNT);
  currentIndex = 0;
  wrongCount = 0;
  document.getElementById('current-stage-name').innerText = currentTheme.title;
  showScreen('game-screen');
  renderQuestion();
}

function renderQuestion() {
  resetTimer();
  if (currentIndex >= currentQuestions.length) {
    endGame(true);
    return;
  }

  const q = currentQuestions[currentIndex];
  document.getElementById('q-chinese').innerText = q.ch;
  const pinyinEl = document.getElementById('q-pinyin');
  pinyinEl.innerText = q.py;
  pinyinEl.classList.remove('visible');

  document.getElementById('score-display').innerText =
    `${currentIndex + 1}/${currentQuestions.length}`;
  document.getElementById('progress-fill').style.width =
    `${(currentIndex / currentQuestions.length) * 100}%`;

  let wrongAnswer;
  let attempts = 0;

  // ★ 추가된 기능: 글자가 달라도 같은 뜻으로 간주할 '유의어 그룹'
  const synonymGroups = [
    ['예쁘', '아름답'],
    ['미안', '죄송', '사과'],
    ['감사', '고맙'],
    ['기쁘', '즐겁', '행복', '유쾌', '만족'],
    ['슬프', '괴롭', '상심', '우울', '난처'],
    ['조금', '약간'],
    ['매우', '아주', '대단히', '너무', '가장', '제일'],
    ['모두', '전부', '다', '일체'],
    ['항상', '늘', '언제나', '자주', '종종'],
    ['그러나', '하지만', '그렇지만', '그런데', '오히려'],
    ['만약', '만일', '설령'],
    ['알다', '이해', '인식'],
    ['바꾸', '교환'],
    ['크다', '많다'],
    ['작다', '적다', '어리다'],
  ];

  do {
    const randomIdx = Math.floor(Math.random() * currentTheme.words.length);
    wrongAnswer = currentTheme.words[randomIdx].mean;
    attempts++;

    // 1. 괄호 내용(예: "(가벼운 사과)")과 특수기호를 제거하고 순수 단어만 분리
    const cleanString = (str) =>
      str.replace(/\([^)]*\)/g, '').replace(/[,/~\.]/g, ' ');
    const ansWords = cleanString(q.mean)
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const wrongWords = cleanString(wrongAnswer)
      .split(/\s+/)
      .filter((w) => w.length > 0);

    let isOverlapping = false;

    // 2. 단어 간 겹침 꼼꼼하게 확인 (예: '미안합니다'와 '미안하다'도 걸러냄)
    for (let w1 of ansWords) {
      for (let w2 of wrongWords) {
        if (w1.length >= 2 && w2.length >= 2) {
          if (w1.includes(w2) || w2.includes(w1)) {
            isOverlapping = true;
            break;
          }
        } else if (w1 === w2) {
          isOverlapping = true; // 1글자는 완전히 같을 때만
          break;
        }
      }
      if (isOverlapping) break;
    }

    // 3. 유의어(동의어) 그룹 확인 (예: 정답이 '예쁘다'인데 오답이 '아름답다'인 경우 걸러냄)
    if (!isOverlapping) {
      for (let group of synonymGroups) {
        const ansHas = group.some((syn) => q.mean.includes(syn));
        const wrongHas = group.some((syn) => wrongAnswer.includes(syn));
        if (ansHas && wrongHas) {
          isOverlapping = true; // 둘 다 같은 유의어 그룹에 속하면 중복으로 간주
          break;
        }
      }
    }

    // 겹치거나 완전히 동일하면 wrongAnswer를 비워서 다시 뽑게 만듦
    if (isOverlapping || wrongAnswer === q.mean) {
      wrongAnswer = null;
    }
  } while (!wrongAnswer && attempts < 50 && currentTheme.words.length > 1);

  // 50번 시도해도 적당한 오답이 안 나오면 무작위 선택 (무한 루프 방지)
  if (!wrongAnswer) {
    const randomIdx = Math.floor(Math.random() * currentTheme.words.length);
    wrongAnswer = currentTheme.words[randomIdx].mean;
  }

  // --- 버튼에 정답/오답 텍스트 입력 및 클릭 이벤트 할당 ---
  const btn1 = document.getElementById('btn-1');
  const btn2 = document.getElementById('btn-2');
  const newBtn1 = btn1.cloneNode(true);
  const newBtn2 = btn2.cloneNode(true);

  newBtn1.className = 'option-btn';
  newBtn2.className = 'option-btn';

  btn1.parentNode.replaceChild(newBtn1, btn1);
  btn2.parentNode.replaceChild(newBtn2, btn2);

  const isAnswerLeft = Math.random() < 0.5;
  if (isAnswerLeft) {
    newBtn1.innerText = q.mean;
    newBtn2.innerText = wrongAnswer;
    newBtn1.onclick = () => handleAnswer(true, newBtn1);
    newBtn2.onclick = () => handleAnswer(false, newBtn2);
  } else {
    newBtn1.innerText = wrongAnswer;
    newBtn2.innerText = q.mean;
    newBtn1.onclick = () => handleAnswer(false, newBtn1);
    newBtn2.onclick = () => handleAnswer(true, newBtn2);
  }
  startTimer();
}

function startTimer() {
  // 시각적 초기화
  timerFill.style.transition = 'none';
  timerFill.style.width = '100%';

  // 오디오 재생 (처음부터)
  timerAudio.currentTime = 0;
  timerAudio.play().catch((e) => console.warn('오디오 재생 차단됨:', e));

  setTimeout(() => {
    timerFill.style.transition = `width ${TIME_LIMIT}s linear`;
    timerFill.style.width = '0%';
  }, 50);

  timerInterval = setTimeout(
    () => endGame(false, '시간 초과! ⏱️'),
    TIME_LIMIT * 1000,
  );
}

function resetTimer() {
  clearTimeout(timerInterval);

  // 오디오 정지 및 리셋
  timerAudio.pause();
  timerAudio.currentTime = 0;

  timerFill.style.transition = 'none';
  timerFill.style.width = '100%';
}

function handleAnswer(isCorrect, btnElement) {
  resetTimer();

  // 1. 중복 클릭 방지를 위해 잠시 모든 버튼 클릭 막기
  const allBtns = document.querySelectorAll('.option-btn');
  allBtns.forEach((btn) => (btn.style.pointerEvents = 'none'));

  // 2. 선택 직후 병음 자동 노출 (학습 효과 극대화)
  document.getElementById('q-pinyin').classList.add('visible');

  if (isCorrect) {
    // 3. 정답 사운드 재생
    correctAudio.currentTime = 0;
    correctAudio.play().catch((e) => console.warn('오디오 재생 차단됨:', e));

    // 4. 정답 시각적 피드백 (초록색 버튼 효과)
    btnElement.classList.add('correct-anim');

    // 5. 1.5초 대기 후 다음 문제로 이동
    setTimeout(() => {
      currentIndex++;
      // ★수정됨: 버튼 복제(renderQuestion) 전에 미리 클릭 잠금 해제!
      allBtns.forEach((btn) => (btn.style.pointerEvents = 'auto'));
      renderQuestion();
    }, 1500);
  } else {
    // 오답 사운드 재생
    wrongAudio.currentTime = 0;
    wrongAudio.play().catch((e) => console.warn('오디오 재생 차단됨:', e));

    // 오답 시각적 피드백 (빨간색 흔들림 효과)
    btnElement.classList.add('wrong-anim');

    // 1.5초 대기 후 결과 화면으로 이동
    setTimeout(() => {
      // 결과 화면으로 가기 전에도 안전하게 잠금 해제
      allBtns.forEach((btn) => (btn.style.pointerEvents = 'auto'));
      endGame(false);
    }, 1500);
  }
}

function endGame(isSuccess, reason = '') {
  resetTimer(); // 오디오 정지 포함
  showScreen('result-screen');
  const icon = document.getElementById('res-icon');
  const title = document.getElementById('res-title');
  const msg = document.getElementById('res-msg');

  if (isSuccess) {
    // ★ 20문제 올클리어 사운드 재생
    clearAudio.currentTime = 0;
    clearAudio.play().catch((e) => console.warn('오디오 재생 차단됨:', e));

    icon.innerText = '👑';
    title.innerText = '테마 정복 완료!';
    title.style.color = 'var(--primary)';
    msg.innerText = `${QUESTION_COUNT}문제를 모두 맞추셨어요!`;
    const clearedData = JSON.parse(
      localStorage.getItem('jindam_cleared_hsk') || '[]',
    );
    if (!clearedData.includes(currentTheme.id)) {
      clearedData.push(currentTheme.id);
      localStorage.setItem('jindam_cleared_hsk', JSON.stringify(clearedData));
    }
  } else {
    icon.innerText = '😢';
    title.innerText = reason ? reason : '아쉽게 실패...';
    title.style.color = 'var(--error)';
    msg.innerText = reason
      ? '10초 안에 답해야 해요!'
      : `${currentIndex + 1}번째 문제에서 틀렸어요.`;
  }

  document.getElementById('next-btn').onclick = () => {
    renderLobby();
    showScreen('lobby-screen');
  };
  document.getElementById('retry-btn').onclick = () =>
    startGame(currentTheme.id);
}
