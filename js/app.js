import {
  THEMES,
  clampName,
  getLevelConfig,
  pickRandomHole,
  now
} from './game-settings.js';
import { Sound } from './sounds.js';
import {
  isFirebaseConfigured,
  createRoom,
  joinRoom,
  leaveRoom,
  startRoomGame,
  endRoomGame,
  publishMole,
  incrementMyScore,
  subscribeRoom,
  getUid
} from './firebase-game.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

const els = {
  startPanel: $('#startPanel'),
  singleQuickStart: $('#singleQuickStart'),
  scrollToMultiplayer: $('#scrollToMultiplayer'),
  playerName: $('#playerName'),
  levelRange: $('#levelRange'),
  levelText: $('#levelText'),
  levelHint: $('#levelHint'),
  durationSelect: $('#durationSelect'),
  themeSelect: $('#themeSelect'),
  soundToggle: $('#soundToggle'),
  createRoomBtn: $('#createRoomBtn'),
  roomCodeInput: $('#roomCodeInput'),
  joinRoomBtn: $('#joinRoomBtn'),
  firebaseNotice: $('#firebaseNotice'),
  modeLabel: $('#modeLabel'),
  roomCodeLabel: $('#roomCodeLabel'),
  scoreLabel: $('#scoreLabel'),
  timeLabel: $('#timeLabel'),
  statusStrip: $('#statusStrip'),
  gameBoard: $('#gameBoard'),
  startGameBtn: $('#startGameBtn'),
  leaveRoomBtn: $('#leaveRoomBtn'),
  roomLeaderboard: $('#roomLeaderboard'),
  localLeaderboard: $('#localLeaderboard'),
  resultDialog: $('#resultDialog'),
  resultText: $('#resultText'),
  closeResultBtn: $('#closeResultBtn'),
  holeTemplate: $('#holeTemplate')
};

const state = {
  mode: 'single',
  roomCode: '',
  uid: '',
  isHost: false,
  room: null,
  roomUnsubscribe: null,
  hostTimer: null,
  singleTimer: null,
  clockTimer: null,
  activeMoleTimer: null,
  boardSize: 9,
  currentMole: -1,
  currentMoleKey: '',
  lastHitMoleKey: '',
  score: 0,
  playing: false,
  endsAt: 0,
  endedDialogKey: '',
  localPlayerName: ''
};

init();

function init() {
  fillThemes();
  restorePreferences();
  bindEvents();
  updateLevelUi();
  buildBoard(getLevelConfig(els.levelRange.value).boardSize);
  updateLocalLeaderboard();
  renderRoomLeaderboard([]);
  updateFirebaseNotice();
  updateTopbar();
}

function fillThemes() {
  els.themeSelect.innerHTML = THEMES
    .map(theme => `<option value="${theme.id}">${theme.emoji} ${theme.label}</option>`)
    .join('');
}

function restorePreferences() {
  els.playerName.value = localStorage.getItem('wam.playerName') || '';
  els.levelRange.value = localStorage.getItem('wam.level') || '1';
  els.durationSelect.value = localStorage.getItem('wam.duration') || '45';
  els.themeSelect.value = localStorage.getItem('wam.theme') || 'ocean';
  els.soundToggle.checked = localStorage.getItem('wam.sound') !== 'off';
  Sound.setEnabled(els.soundToggle.checked);
  document.body.dataset.theme = els.themeSelect.value;
}

function bindEvents() {
  els.singleQuickStart.addEventListener('click', () => startSingleGame());
  els.scrollToMultiplayer.addEventListener('click', () => $('#multiplayerPanel').scrollIntoView({ behavior: 'smooth', block: 'center' }));

  els.playerName.addEventListener('input', () => localStorage.setItem('wam.playerName', els.playerName.value));
  els.levelRange.addEventListener('input', () => {
    localStorage.setItem('wam.level', els.levelRange.value);
    updateLevelUi();
    if (!state.playing && state.mode === 'single') buildBoard(getLevelConfig(els.levelRange.value).boardSize);
  });
  els.durationSelect.addEventListener('change', () => {
    localStorage.setItem('wam.duration', els.durationSelect.value);
    if (!state.playing) updateTopbar();
  });
  els.themeSelect.addEventListener('change', () => {
    localStorage.setItem('wam.theme', els.themeSelect.value);
    document.body.dataset.theme = els.themeSelect.value;
  });
  els.soundToggle.addEventListener('change', () => {
    localStorage.setItem('wam.sound', els.soundToggle.checked ? 'on' : 'off');
    Sound.setEnabled(els.soundToggle.checked);
    Sound.click();
  });

  els.createRoomBtn.addEventListener('click', handleCreateRoom);
  els.joinRoomBtn.addEventListener('click', handleJoinRoom);
  els.roomCodeInput.addEventListener('input', () => {
    els.roomCodeInput.value = els.roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  });
  els.roomCodeInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') handleJoinRoom();
  });

  els.startGameBtn.addEventListener('click', () => {
    if (state.mode === 'online') handleOnlineStart();
    else startSingleGame();
  });
  els.leaveRoomBtn.addEventListener('click', handleLeaveRoom);
  els.closeResultBtn.addEventListener('click', () => els.resultDialog.close());

  els.gameBoard.addEventListener('pointerdown', handleHolePress);

  $$('.tab').forEach(button => {
    button.addEventListener('click', () => switchLeaderboardTab(button.dataset.tab));
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.mode === 'online' && state.room) {
      updateOnlineClock(state.room);
    }
  });
}

function updateFirebaseNotice() {
  if (isFirebaseConfigured()) {
    els.firebaseNotice.textContent = 'Firebase 已設定，可以建立或加入多人房間。';
  } else {
    els.firebaseNotice.textContent = '多人模式需要先修改 js/firebase-config.js 並設定 Firebase。';
  }
}

function updateLevelUi() {
  const config = getLevelConfig(els.levelRange.value);
  els.levelText.textContent = config.level;
  els.levelHint.textContent = config.label;
}

function getPlayerName() {
  const name = clampName(els.playerName.value);
  els.playerName.value = name;
  localStorage.setItem('wam.playerName', name);
  state.localPlayerName = name;
  return name;
}

function buildBoard(size) {
  state.boardSize = size;
  els.gameBoard.innerHTML = '';
  for (let i = 0; i < size; i += 1) {
    const node = els.holeTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.index = String(i);
    node.setAttribute('aria-label', `第 ${i + 1} 個地鼠洞`);
    els.gameBoard.append(node);
  }
}

function setActiveMole(index, moleKey = '') {
  state.currentMole = index;
  state.currentMoleKey = moleKey;
  $$('.hole').forEach(hole => {
    const active = Number(hole.dataset.index) === Number(index);
    hole.classList.toggle('active', active);
    if (!active) hole.classList.remove('hit');
  });
}

function clearTimers() {
  clearInterval(state.hostTimer);
  clearInterval(state.singleTimer);
  clearInterval(state.clockTimer);
  clearTimeout(state.activeMoleTimer);
  state.hostTimer = null;
  state.singleTimer = null;
  state.clockTimer = null;
  state.activeMoleTimer = null;
}

function updateTopbar() {
  els.modeLabel.textContent = state.mode === 'online' ? (state.isHost ? '多人・房主' : '多人') : '單人';
  els.roomCodeLabel.textContent = state.roomCode || '—';
  els.scoreLabel.textContent = state.score;
  const seconds = state.playing ? Math.max(0, Math.ceil((state.endsAt - now()) / 1000)) : Number(els.durationSelect.value);
  els.timeLabel.textContent = seconds;
}

function setStatus(message) {
  els.statusStrip.textContent = message;
}

function startSingleGame() {
  if (state.roomCode) handleLeaveRoom(false);
  Sound.start();
  clearTimers();
  state.mode = 'single';
  state.score = 0;
  state.playing = true;
  state.lastHitMoleKey = '';
  state.currentMoleKey = '';
  state.endsAt = now() + Number(els.durationSelect.value) * 1000;

  const levelConfig = getLevelConfig(els.levelRange.value);
  buildBoard(levelConfig.boardSize);
  updateTopbar();
  setStatus(`單人遊戲開始！難度 ${levelConfig.level}。`);
  els.startGameBtn.textContent = '重新開始';
  els.leaveRoomBtn.hidden = true;

  const publishLocalMole = () => {
    if (!state.playing) return;
    const index = pickRandomHole(state.boardSize, state.currentMole);
    const moleKey = `${Date.now()}-${index}`;
    setActiveMole(index, moleKey);
    clearTimeout(state.activeMoleTimer);
    state.activeMoleTimer = setTimeout(() => {
      if (state.currentMoleKey === moleKey) setActiveMole(-1, '');
    }, levelConfig.visibleMs);
  };

  publishLocalMole();
  state.singleTimer = setInterval(publishLocalMole, levelConfig.intervalMs);
  state.clockTimer = setInterval(() => {
    updateTopbar();
    if (now() >= state.endsAt) endSingleGame();
  }, 180);
}

function endSingleGame() {
  if (!state.playing || state.mode !== 'single') return;
  state.playing = false;
  clearTimers();
  setActiveMole(-1, '');
  Sound.end();
  setStatus(`遊戲結束！你的分數是 ${state.score}。`);
  saveLocalScore({
    name: getPlayerName(),
    score: state.score,
    level: Number(els.levelRange.value),
    duration: Number(els.durationSelect.value)
  });
  updateLocalLeaderboard();
  showResult(`你的分數是 ${state.score}`);
  updateTopbar();
}

function handleHolePress(event) {
  const hole = event.target.closest('.hole');
  if (!hole || !state.playing) return;
  const index = Number(hole.dataset.index);

  if (index !== state.currentMole || !hole.classList.contains('active')) {
    Sound.miss();
    return;
  }

  if (state.mode === 'single') {
    if (state.lastHitMoleKey === state.currentMoleKey) return;
    state.lastHitMoleKey = state.currentMoleKey;
    state.score += 1;
    hole.classList.add('hit');
    Sound.hit();
    updateTopbar();
    setTimeout(() => hole.classList.remove('active', 'hit'), 140);
    return;
  }

  if (state.mode === 'online' && state.room?.status === 'playing') {
    if (!state.room.moleKey || state.lastHitMoleKey === state.room.moleKey) return;
    state.lastHitMoleKey = state.room.moleKey;
    hole.classList.add('hit');
    Sound.hit();
    incrementMyScore(state.roomCode).catch(error => setStatus(error.message));
    setTimeout(() => hole.classList.remove('hit'), 140);
  }
}

async function handleCreateRoom() {
  try {
    setStatus('正在建立 Firebase 房間...');
    const result = await createRoom({
      playerName: getPlayerName(),
      level: Number(els.levelRange.value),
      theme: els.themeSelect.value,
      duration: Number(els.durationSelect.value)
    });
    await enterOnlineRoom(result.roomCode, result.uid);
    setStatus(`房間 ${result.roomCode} 已建立。分享房號給朋友，房主按開始即可。`);
    Sound.click();
  } catch (error) {
    setStatus(error.message || '建立房間失敗。');
  }
}

async function handleJoinRoom() {
  try {
    setStatus('正在加入房間...');
    const result = await joinRoom({
      roomCode: els.roomCodeInput.value,
      playerName: getPlayerName()
    });
    await enterOnlineRoom(result.roomCode, result.uid);
    setStatus(`已加入房間 ${result.roomCode}。等待房主開始。`);
    Sound.click();
  } catch (error) {
    setStatus(error.message || '加入房間失敗。');
  }
}

async function enterOnlineRoom(roomCode, uid) {
  clearTimers();
  if (state.roomUnsubscribe) state.roomUnsubscribe();
  state.mode = 'online';
  state.roomCode = roomCode;
  state.uid = uid || await getUid();
  state.score = 0;
  state.playing = false;
  state.endedDialogKey = '';
  els.leaveRoomBtn.hidden = false;
  els.roomCodeInput.value = roomCode;
  els.startGameBtn.textContent = '開始多人遊戲';
  updateTopbar();

  state.roomUnsubscribe = await subscribeRoom(roomCode, handleRoomUpdate);
}

function handleRoomUpdate(room) {
  if (!room) {
    setStatus('房間已不存在或已被清除。');
    resetToSingleMode();
    return;
  }

  state.room = room;
  state.isHost = room.hostId === state.uid;
  state.score = Number(room.players?.[state.uid]?.score || 0);

  if (room.theme && document.body.dataset.theme !== room.theme) {
    document.body.dataset.theme = room.theme;
    els.themeSelect.value = room.theme;
  }

  if (room.level) {
    els.levelRange.value = room.level;
    updateLevelUi();
  }

  if (room.duration) els.durationSelect.value = String(room.duration);
  if (room.boardSize && room.boardSize !== state.boardSize) buildBoard(room.boardSize);

  renderRoomLeaderboard(Object.entries(room.players || {}).map(([uid, player]) => ({ uid, ...player })));

  if (room.status === 'playing') {
    state.playing = true;
    state.endsAt = Number(room.endsAt || 0);
    setActiveMole(Number(room.currentMole ?? -1), room.moleKey || '');
    updateOnlineClock(room);
    if (state.isHost) startHostMoleLoop(room);
    els.startGameBtn.textContent = state.isHost ? '重新開始多人遊戲' : '等待房主';
    els.startGameBtn.disabled = !state.isHost;
    setStatus(state.isHost ? '多人遊戲進行中。你是房主，系統由你的裝置同步地鼠位置。' : '多人遊戲進行中！看到地鼠就點。');
  } else {
    clearInterval(state.hostTimer);
    clearInterval(state.clockTimer);
    state.hostTimer = null;
    state.clockTimer = null;
    state.playing = false;
    setActiveMole(-1, '');
    els.startGameBtn.disabled = !state.isHost && room.status !== 'waiting';
    els.startGameBtn.textContent = state.isHost ? '開始多人遊戲' : '等待房主';

    if (room.status === 'ended') {
      const dialogKey = `${state.roomCode}-${room.endsAt || room.updatedAt || 'ended'}`;
      setStatus(`多人遊戲結束！你的分數是 ${state.score}。`);
      if (dialogKey !== state.endedDialogKey) {
        state.endedDialogKey = dialogKey;
        Sound.end();
        showResult(`你的分數是 ${state.score}`);
      }
    } else {
      setStatus(state.isHost ? `房間 ${state.roomCode} 等待中。分享房號，按開始一起玩。` : `已在房間 ${state.roomCode}，等待房主開始。`);
    }
  }

  updateTopbar();
}

function startHostMoleLoop(room) {
  if (state.hostTimer) return;
  const config = getLevelConfig(room.level || 1);

  const publishNext = () => {
    if (!state.room || state.room.status !== 'playing') return;
    if (now() >= Number(state.room.endsAt || 0)) {
      clearInterval(state.hostTimer);
      state.hostTimer = null;
      endRoomGame(state.roomCode).catch(error => setStatus(error.message));
      return;
    }
    const index = pickRandomHole(Number(state.room.boardSize || config.boardSize), Number(state.room.currentMole ?? -1));
    publishMole({
      roomCode: state.roomCode,
      index,
      moleKey: `${Date.now()}-${index}`
    }).catch(error => setStatus(error.message));
  };

  const delay = Math.max(0, Number(room.startedAt || 0) - now());
  const beginLoop = () => {
    publishNext();
    state.hostTimer = setInterval(publishNext, config.intervalMs);
  };
  state.hostTimer = setTimeout(beginLoop, delay);
}

function updateOnlineClock(room) {
  clearInterval(state.clockTimer);
  state.endsAt = Number(room.endsAt || 0);
  state.clockTimer = setInterval(() => {
    updateTopbar();
    if (state.isHost && state.playing && now() >= state.endsAt) {
      clearInterval(state.clockTimer);
      endRoomGame(state.roomCode).catch(error => setStatus(error.message));
    }
  }, 200);
}

async function handleOnlineStart() {
  if (!state.roomCode || !state.isHost) {
    setStatus('只有房主可以開始多人遊戲。');
    return;
  }
  try {
    Sound.start();
    await startRoomGame({
      roomCode: state.roomCode,
      level: Number(els.levelRange.value),
      theme: els.themeSelect.value,
      duration: Number(els.durationSelect.value)
    });
  } catch (error) {
    setStatus(error.message || '開始遊戲失敗。');
  }
}

async function handleLeaveRoom(announce = true) {
  try {
    if (state.roomCode) await leaveRoom(state.roomCode);
  } catch (error) {
    if (announce) setStatus(error.message || '離開房間時發生問題。');
  }
  resetToSingleMode();
  if (announce) setStatus('已離開房間，回到單人模式。');
}

function resetToSingleMode() {
  clearTimers();
  if (state.roomUnsubscribe) state.roomUnsubscribe();
  state.mode = 'single';
  state.roomCode = '';
  state.uid = '';
  state.isHost = false;
  state.room = null;
  state.roomUnsubscribe = null;
  state.score = 0;
  state.playing = false;
  els.leaveRoomBtn.hidden = true;
  els.startGameBtn.disabled = false;
  els.startGameBtn.textContent = '開始遊戲';
  buildBoard(getLevelConfig(els.levelRange.value).boardSize);
  renderRoomLeaderboard([]);
  updateTopbar();
}

function showResult(message) {
  els.resultText.textContent = message;
  if (typeof els.resultDialog.showModal === 'function') els.resultDialog.showModal();
  else alert(message);
}

function saveLocalScore(record) {
  const scores = getLocalScores();
  scores.push({
    ...record,
    date: new Date().toISOString()
  });
  scores.sort((a, b) => b.score - a.score || b.level - a.level);
  localStorage.setItem('wam.localScores', JSON.stringify(scores.slice(0, 10)));
}

function getLocalScores() {
  try {
    return JSON.parse(localStorage.getItem('wam.localScores') || '[]');
  } catch {
    return [];
  }
}

function updateLocalLeaderboard() {
  const scores = getLocalScores();
  if (!scores.length) {
    els.localLeaderboard.innerHTML = '<li class="empty">還沒有本機紀錄，先玩一局吧。</li>';
    return;
  }
  els.localLeaderboard.innerHTML = scores.map((item, index) => `
    <li>
      <span class="rank">${index + 1}</span>
      <span>${escapeHtml(item.name)}<br><small>難度 ${item.level}・${item.duration} 秒</small></span>
      <strong>${item.score}</strong>
    </li>
  `).join('');
}

function renderRoomLeaderboard(players) {
  const list = players
    .filter(player => player && player.name)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  if (!list.length) {
    els.roomLeaderboard.innerHTML = '<li class="empty">多人房間建立後會顯示玩家分數。</li>';
    return;
  }

  els.roomLeaderboard.innerHTML = list.map((player, index) => `
    <li>
      <span class="rank">${index + 1}</span>
      <span>${escapeHtml(player.name)}${player.uid === state.uid ? '（你）' : ''}<br><small>${player.active ? '在線' : '離線'}</small></span>
      <strong>${Number(player.score || 0)}</strong>
    </li>
  `).join('');
}

function switchLeaderboardTab(tabName) {
  $$('.tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tabName));
  els.roomLeaderboard.hidden = tabName !== 'room';
  els.localLeaderboard.hidden = tabName !== 'local';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
