import {
  THEMES,
  MOLE_VISUALS,
  HIT_SOUND_PRESETS,
  MISS_SOUND_PRESETS,
  clampName,
  getLevelConfig,
  pickRandomHole,
  getBuiltInMole,
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
  claimCoopHit,
  subscribeRoom,
  getUid,
  touchMyPresence,
  ROOM_TTL_MS
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
  multiplayerModeSelect: $('#multiplayerModeSelect'),
  moleSelect: $('#moleSelect'),
  moleUpload: $('#moleUpload'),
  customMolePreview: $('#customMolePreview'),
  hitSoundSelect: $('#hitSoundSelect'),
  missSoundSelect: $('#missSoundSelect'),
  hitSoundCards: $('#hitSoundCards'),
  missSoundCards: $('#missSoundCards'),
  hitSoundUpload: $('#hitSoundUpload'),
  missSoundUpload: $('#missSoundUpload'),
  previewHitSound: $('#previewHitSound'),
  previewMissSound: $('#previewMissSound'),
  soundToggle: $('#soundToggle'),
  createRoomBtn: $('#createRoomBtn'),
  roomCodeInput: $('#roomCodeInput'),
  joinRoomBtn: $('#joinRoomBtn'),
  firebaseNotice: $('#firebaseNotice'),
  roomShareCard: $('#roomShareCard'),
  shareRoomCode: $('#shareRoomCode'),
  roomQrCanvas: $('#roomQrCanvas'),
  inviteLink: $('#inviteLink'),
  copyInviteBtn: $('#copyInviteBtn'),
  refreshQrBtn: $('#refreshQrBtn'),
  roomExpiryLabel: $('#roomExpiryLabel'),
  installPwaBtn: $('#installPwaBtn'),
  pwaHint: $('#pwaHint'),
  modeLabel: $('#modeLabel'),
  roomCodeLabel: $('#roomCodeLabel'),
  scoreTitle: $('#scoreTitle'),
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
  multiplayerMode: 'coop',
  roomCode: '',
  uid: '',
  isHost: false,
  room: null,
  roomUnsubscribe: null,
  presenceTimer: null,
  expiryTimer: null,
  deferredInstallPrompt: null,
  hostTimer: null,
  singleTimer: null,
  clockTimer: null,
  activeMoleTimer: null,
  boardSize: 9,
  currentMole: -1,
  currentMoleKey: '',
  lastHitMoleKey: '',
  score: 0,
  teamScore: 0,
  playing: false,
  endsAt: 0,
  endedDialogKey: '',
  localPlayerName: '',
  moleVisual: { type: 'emoji', value: '🐹', label: '經典地鼠' },
  customMoleDataUrl: '',
  customHitSound: '',
  customMissSound: ''
};

init();

function init() {
  fillSelects();
  restorePreferences();
  bindEvents();
  updateLevelUi();
  buildBoard(getLevelConfig(els.levelRange.value).boardSize);
  updateLocalLeaderboard();
  renderRoomLeaderboard([]);
  updateFirebaseNotice();
  updateTopbar();
  updateCustomMolePreview();
  updateUploadVisibility();
  setupInviteFromUrl();
  setupPwaInstall();
  registerServiceWorker();
}

function fillSelects() {
  els.themeSelect.innerHTML = THEMES
    .map(theme => `<option value="${theme.id}">${theme.emoji} ${theme.label}</option>`)
    .join('');

  els.moleSelect.innerHTML = MOLE_VISUALS
    .map(item => `<option value="${item.id}">${item.emoji} ${item.label}</option>`)
    .join('');

  els.hitSoundSelect.innerHTML = HIT_SOUND_PRESETS
    .map(item => `<option value="${item.id}">${item.label}</option>`)
    .join('');

  els.missSoundSelect.innerHTML = MISS_SOUND_PRESETS
    .map(item => `<option value="${item.id}">${item.label}</option>`)
    .join('');

  els.hitSoundCards.innerHTML = HIT_SOUND_PRESETS
    .map(item => soundButtonMarkup(item, 'hit'))
    .join('');

  els.missSoundCards.innerHTML = MISS_SOUND_PRESETS
    .map(item => soundButtonMarkup(item, 'miss'))
    .join('');
}

function soundButtonMarkup(item, type) {
  return `<button class="sound-card" type="button" data-sound-type="${type}" data-sound-id="${escapeAttribute(item.id)}" aria-pressed="false"><span>${escapeHtml(item.label)}</span></button>`;
}

function restorePreferences() {
  els.playerName.value = localStorage.getItem('wam.playerName') || '';
  els.levelRange.value = localStorage.getItem('wam.level') || '1';
  els.durationSelect.value = localStorage.getItem('wam.duration') || '45';
  els.themeSelect.value = localStorage.getItem('wam.theme') || 'ocean';
  els.multiplayerModeSelect.value = localStorage.getItem('wam.multiplayerMode') || 'coop';
  els.moleSelect.value = localStorage.getItem('wam.moleId') || 'hamster';
  els.hitSoundSelect.value = localStorage.getItem('wam.hitSoundPreset') || 'sparkle';
  els.missSoundSelect.value = localStorage.getItem('wam.missSoundPreset') || 'soft-buzz';
  els.soundToggle.checked = localStorage.getItem('wam.sound') !== 'off';

  state.multiplayerMode = els.multiplayerModeSelect.value;
  state.customMoleDataUrl = localStorage.getItem('wam.customMoleImage') || '';
  state.customHitSound = localStorage.getItem('wam.customHitSound') || '';
  state.customMissSound = localStorage.getItem('wam.customMissSound') || '';

  Sound.setEnabled(els.soundToggle.checked);
  Sound.setHitPreset(els.hitSoundSelect.value);
  Sound.setMissPreset(els.missSoundSelect.value);
  Sound.setCustomHitSound(state.customHitSound);
  Sound.setCustomMissSound(state.customMissSound);

  document.body.dataset.theme = els.themeSelect.value;
  state.moleVisual = getSelectedMoleVisual();
  syncSoundChoiceButtons();
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
  els.multiplayerModeSelect.addEventListener('change', () => {
    state.multiplayerMode = els.multiplayerModeSelect.value;
    localStorage.setItem('wam.multiplayerMode', state.multiplayerMode);
    updateTopbar();
  });
  els.moleSelect.addEventListener('change', () => {
    localStorage.setItem('wam.moleId', els.moleSelect.value);
    state.moleVisual = getSelectedMoleVisual();
    updateUploadVisibility();
    updateCustomMolePreview();
    applyMoleVisual();
  });
  els.moleUpload.addEventListener('change', handleMoleUpload);

  els.hitSoundSelect.addEventListener('change', () => {
    handleHitSoundChoice(els.hitSoundSelect.value, { preview: true });
  });
  els.missSoundSelect.addEventListener('change', () => {
    handleMissSoundChoice(els.missSoundSelect.value, { preview: true });
  });
  els.hitSoundCards.addEventListener('click', event => {
    const button = event.target.closest('button[data-sound-id]');
    if (!button) return;
    handleHitSoundChoice(button.dataset.soundId, { preview: true });
  });
  els.missSoundCards.addEventListener('click', event => {
    const button = event.target.closest('button[data-sound-id]');
    if (!button) return;
    handleMissSoundChoice(button.dataset.soundId, { preview: true });
  });
  els.hitSoundUpload.addEventListener('change', event => handleAudioUpload(event, 'hit'));
  els.missSoundUpload.addEventListener('change', event => handleAudioUpload(event, 'miss'));
  els.previewHitSound.addEventListener('click', () => {
    Sound.unlock();
    Sound.previewHit();
  });
  els.previewMissSound.addEventListener('click', () => {
    Sound.unlock();
    Sound.previewMiss();
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
  els.copyInviteBtn.addEventListener('click', copyInviteLink);
  els.refreshQrBtn.addEventListener('click', () => {
    if (state.roomCode) renderRoomQrCode(getInviteUrl(state.roomCode));
  });
  els.installPwaBtn.addEventListener('click', installPwa);

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
      touchMyPresence(state.roomCode).catch(() => {});
    }
  });

  window.addEventListener('pagehide', () => {
    if (state.roomCode) leaveRoom(state.roomCode).catch(() => {});
  });
}

function handleHitSoundChoice(value, options = {}) {
  Sound.unlock();
  els.hitSoundSelect.value = value;
  localStorage.setItem('wam.hitSoundPreset', value);
  Sound.setHitPreset(value);
  syncSoundChoiceButtons();
  updateUploadVisibility();
  if (options.preview && value !== 'custom-hit') Sound.previewHit();
}

function handleMissSoundChoice(value, options = {}) {
  Sound.unlock();
  els.missSoundSelect.value = value;
  localStorage.setItem('wam.missSoundPreset', value);
  Sound.setMissPreset(value);
  syncSoundChoiceButtons();
  updateUploadVisibility();
  if (options.preview && value !== 'custom-miss') Sound.previewMiss();
}

function syncSoundChoiceButtons() {
  $$('#hitSoundCards .sound-card').forEach(button => {
    const active = button.dataset.soundId === els.hitSoundSelect.value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  $$('#missSoundCards .sound-card').forEach(button => {
    const active = button.dataset.soundId === els.missSoundSelect.value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function setupInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const room = String(params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (!room) return;
  els.roomCodeInput.value = room;
  setStatus(`已從邀請連結帶入房號 ${room}，輸入暱稱後按「加入」。`);
  $('#multiplayerPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setupPwaInstall() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    els.installPwaBtn.hidden = false;
    els.pwaHint.textContent = '可安裝囉！按下按鈕後選擇安裝即可。';
  });

  window.addEventListener('appinstalled', () => {
    state.deferredInstallPrompt = null;
    els.installPwaBtn.hidden = true;
    els.pwaHint.textContent = '已安裝完成，可從桌面開啟「鼠叔出沒」。';
  });
}

async function installPwa() {
  if (!state.deferredInstallPrompt) {
    setStatus('目前瀏覽器尚未提供安裝按鈕。iPhone 請用 Safari 分享 → 加到主畫面。');
    return;
  }
  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice.catch(() => null);
  state.deferredInstallPrompt = null;
  els.installPwaBtn.hidden = true;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // The game still works without the offline shell cache.
    });
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

function getSelectedMoleVisual() {
  if (els.moleSelect.value === 'custom' && state.customMoleDataUrl) {
    return { type: 'image', value: state.customMoleDataUrl, label: '自訂圖片' };
  }
  const builtIn = getBuiltInMole(els.moleSelect.value);
  return { type: 'emoji', value: builtIn.emoji, label: builtIn.label };
}

function buildBoard(size) {
  state.boardSize = size;
  els.gameBoard.dataset.boardSize = String(size);
  els.gameBoard.innerHTML = '';
  for (let i = 0; i < size; i += 1) {
    const node = els.holeTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.index = String(i);
    node.setAttribute('aria-label', `第 ${i + 1} 個地鼠洞`);
    els.gameBoard.append(node);
  }
  applyMoleVisual();
}

function applyMoleVisual() {
  const visual = state.moleVisual || { type: 'emoji', value: '🐹', label: '地鼠' };
  $$('.mole').forEach(mole => {
    mole.classList.toggle('custom-image', visual.type === 'image');
    if (visual.type === 'image') {
      mole.innerHTML = `<img src="${escapeAttribute(visual.value)}" alt="${escapeAttribute(visual.label)}" />`;
    } else {
      mole.textContent = visual.value || '🐹';
    }
  });
}

function updateCustomMolePreview() {
  if (state.customMoleDataUrl) {
    els.customMolePreview.innerHTML = `<img src="${escapeAttribute(state.customMoleDataUrl)}" alt="自訂地鼠預覽" /><span>已載入自訂圖片</span>`;
  } else {
    els.customMolePreview.innerHTML = '<span>尚未上傳自訂圖片</span>';
  }
}

function updateUploadVisibility() {
  els.moleUpload.closest('.upload-box').hidden = els.moleSelect.value !== 'custom';
  els.hitSoundUpload.closest('.upload-box').hidden = els.hitSoundSelect.value !== 'custom-hit';
  els.missSoundUpload.closest('.upload-box').hidden = els.missSoundSelect.value !== 'custom-miss';
}

async function handleMoleUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setStatus('請選擇圖片檔。');
    return;
  }

  try {
    const dataUrl = await resizeImageFile(file, 256);
    state.customMoleDataUrl = dataUrl;
    localStorage.setItem('wam.customMoleImage', dataUrl);
    els.moleSelect.value = 'custom';
    localStorage.setItem('wam.moleId', 'custom');
    state.moleVisual = getSelectedMoleVisual();
    updateCustomMolePreview();
    applyMoleVisual();
    setStatus('自訂地鼠圖片已套用。多人房主開始遊戲時，圖片會同步給房間玩家。');
  } catch {
    setStatus('圖片處理失敗，請換一張較小的圖片。');
  }
}

async function handleAudioUpload(event, type) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('audio/')) {
    setStatus('請選擇音訊檔。');
    return;
  }
  if (file.size > 700 * 1024) {
    setStatus('音效檔建議小於 700KB，請先裁短或壓縮後再上傳。');
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    if (type === 'hit') {
      state.customHitSound = dataUrl;
      localStorage.setItem('wam.customHitSound', dataUrl);
      els.hitSoundSelect.value = 'custom-hit';
      localStorage.setItem('wam.hitSoundPreset', 'custom-hit');
      Sound.setHitPreset('custom-hit');
      Sound.setCustomHitSound(dataUrl);
      syncSoundChoiceButtons();
      setStatus('自訂打中音效已套用。');
      Sound.previewHit();
    } else {
      state.customMissSound = dataUrl;
      localStorage.setItem('wam.customMissSound', dataUrl);
      els.missSoundSelect.value = 'custom-miss';
      localStorage.setItem('wam.missSoundPreset', 'custom-miss');
      Sound.setMissPreset('custom-miss');
      Sound.setCustomMissSound(dataUrl);
      syncSoundChoiceButtons();
      setStatus('自訂沒打中音效已套用。');
      Sound.previewMiss();
    }
  } catch {
    setStatus('音訊讀取失敗，請換一個檔案。');
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeImageFile(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', 0.82));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
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
  const roomMode = state.room?.gameMode || state.multiplayerMode;
  if (state.mode === 'online') {
    els.modeLabel.textContent = roomMode === 'coop'
      ? (state.isHost ? '多人合作・房主' : '多人合作')
      : (state.isHost ? '多人競賽・房主' : '多人競賽');
  } else {
    els.modeLabel.textContent = '單人';
  }
  els.roomCodeLabel.textContent = state.roomCode || '—';
  els.scoreTitle.textContent = state.mode === 'online' && roomMode === 'coop' ? '合作分數' : '分數';
  els.scoreLabel.textContent = state.mode === 'online' && roomMode === 'coop' ? state.teamScore : state.score;
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
  state.teamScore = 0;
  state.playing = true;
  state.lastHitMoleKey = '';
  state.currentMoleKey = '';
  state.moleVisual = getSelectedMoleVisual();
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
    duration: Number(els.durationSelect.value),
    mode: '單人'
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
    const roomMode = state.room.gameMode || 'coop';
    if (!state.room.moleKey || state.lastHitMoleKey === state.room.moleKey) return;
    if (roomMode === 'coop' && state.room.lastHitMoleKey === state.room.moleKey) return;

    state.lastHitMoleKey = state.room.moleKey;
    hole.classList.add('hit');

    if (roomMode === 'coop') {
      claimCoopHit({ roomCode: state.roomCode, moleKey: state.room.moleKey })
        .then(committed => {
          if (committed) Sound.hit();
          else Sound.miss();
        })
        .catch(error => setStatus(error.message));
    } else {
      Sound.hit();
      incrementMyScore(state.roomCode).catch(error => setStatus(error.message));
    }

    setTimeout(() => hole.classList.remove('hit'), 140);
  }
}

async function handleCreateRoom() {
  try {
    setStatus('正在建立 Firebase 房間...');
    state.moleVisual = getSelectedMoleVisual();
    const result = await createRoom({
      playerName: getPlayerName(),
      level: Number(els.levelRange.value),
      theme: els.themeSelect.value,
      duration: Number(els.durationSelect.value),
      gameMode: els.multiplayerModeSelect.value,
      moleVisual: state.moleVisual
    });
    await enterOnlineRoom(result.roomCode, result.uid);
    setStatus(`房間 ${result.roomCode} 已建立。${els.multiplayerModeSelect.value === 'coop' ? '合作模式：大家共同累積同一個分數。' : '競賽模式：每位玩家各自計分。'}`);
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
  state.teamScore = 0;
  state.playing = false;
  state.endedDialogKey = '';
  els.leaveRoomBtn.hidden = false;
  els.roomCodeInput.value = roomCode;
  els.startGameBtn.textContent = '開始多人遊戲';
  updateTopbar();
  updateRoomShare({ roomCode, expiresAt: now() + ROOM_TTL_MS });
  startPresence(roomCode);

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
  state.teamScore = Number(room.teamScore || 0);
  state.multiplayerMode = room.gameMode || 'coop';
  updateRoomShare(room);

  if (room.moleVisual) {
    state.moleVisual = room.moleVisual;
    applyMoleVisual();
  }

  if (room.theme && document.body.dataset.theme !== room.theme) {
    document.body.dataset.theme = room.theme;
    els.themeSelect.value = room.theme;
  }

  if (room.level) {
    els.levelRange.value = room.level;
    updateLevelUi();
  }

  if (room.duration) els.durationSelect.value = String(room.duration);
  if (room.gameMode) els.multiplayerModeSelect.value = room.gameMode;
  if (room.boardSize && room.boardSize !== state.boardSize) buildBoard(room.boardSize);

  renderRoomLeaderboard(Object.entries(room.players || {}).map(([uid, player]) => ({ uid, ...player })), room.gameMode || 'coop');

  if (room.status === 'playing') {
    state.playing = true;
    state.endsAt = Number(room.endsAt || 0);
    const hitAlready = room.gameMode === 'coop' && room.lastHitMoleKey && room.lastHitMoleKey === room.moleKey;
    setActiveMole(hitAlready ? -1 : Number(room.currentMole ?? -1), hitAlready ? '' : room.moleKey || '');
    updateOnlineClock(room);
    if (state.isHost) startHostMoleLoop(room);
    els.startGameBtn.textContent = state.isHost ? '重新開始多人遊戲' : '等待房主';
    els.startGameBtn.disabled = !state.isHost;
    if (room.gameMode === 'coop') {
      setStatus(state.isHost ? '合作模式進行中。大家一起打同一批地鼠，共同累積合作分數。' : '合作模式進行中！大家一起打，同一隻地鼠先打到的人幫全隊加分。');
    } else {
      setStatus(state.isHost ? '競賽模式進行中。每位玩家各自計分。' : '競賽模式進行中！看到地鼠就點。');
    }
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
      const resultMessage = room.gameMode === 'coop'
        ? `合作分數是 ${state.teamScore}，你的貢獻是 ${state.score}`
        : `你的分數是 ${state.score}`;
      setStatus(`多人遊戲結束！${resultMessage}。`);
      if (dialogKey !== state.endedDialogKey) {
        state.endedDialogKey = dialogKey;
        Sound.end();
        showResult(resultMessage);
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
    state.moleVisual = getSelectedMoleVisual();
    await startRoomGame({
      roomCode: state.roomCode,
      level: Number(els.levelRange.value),
      theme: els.themeSelect.value,
      duration: Number(els.durationSelect.value),
      gameMode: els.multiplayerModeSelect.value,
      moleVisual: state.moleVisual
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
  stopPresence();
  if (state.roomUnsubscribe) state.roomUnsubscribe();
  state.mode = 'single';
  state.roomCode = '';
  state.uid = '';
  state.isHost = false;
  state.room = null;
  state.roomUnsubscribe = null;
  state.score = 0;
  state.teamScore = 0;
  state.playing = false;
  state.moleVisual = getSelectedMoleVisual();
  els.leaveRoomBtn.hidden = true;
  els.startGameBtn.disabled = false;
  els.startGameBtn.textContent = '開始遊戲';
  els.roomShareCard.hidden = true;
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
      <span>${escapeHtml(item.name)}<br><small>${escapeHtml(item.mode || '單人')}・難度 ${item.level}・${item.duration} 秒</small></span>
      <strong>${item.score}</strong>
    </li>
  `).join('');
}

function renderRoomLeaderboard(players, roomMode = 'coop') {
  const list = players
    .filter(player => player && player.name)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  if (!list.length) {
    els.roomLeaderboard.innerHTML = '<li class="empty">多人房間建立後會顯示玩家資訊。</li>';
    return;
  }

  const scoreLabel = roomMode === 'coop' ? '貢獻' : '分數';
  const teamHeader = roomMode === 'coop'
    ? `<li class="team-score-row"><span>🤝</span><span>團隊合作分數</span><strong>${state.teamScore}</strong></li>`
    : '';

  els.roomLeaderboard.innerHTML = teamHeader + list.map((player, index) => {
    const lastSeen = Number(player.lastSeen || 0);
    const recentlySeen = lastSeen > 0 && now() - lastSeen < 45_000;
    const online = Boolean(player.active) && recentlySeen;
    const presenceText = online ? '在線' : `離線${lastSeen ? `・${formatLastSeen(lastSeen)}` : ''}`;
    return `
      <li class="${online ? 'online-player' : 'offline-player'}">
        <span class="rank">${index + 1}</span>
        <span>${escapeHtml(player.name)}${player.uid === state.uid ? '（你）' : ''}<br><small><span class="presence-dot"></span>${presenceText}・${scoreLabel}</small></span>
        <strong>${Number(player.score || 0)}</strong>
      </li>
    `;
  }).join('');
}

function startPresence(roomCode) {
  stopPresence();
  touchMyPresence(roomCode).catch(() => {});
  state.presenceTimer = setInterval(() => {
    if (state.mode === 'online' && state.roomCode) {
      touchMyPresence(state.roomCode).catch(() => {});
    }
  }, 20_000);
}

function stopPresence() {
  clearInterval(state.presenceTimer);
  clearInterval(state.expiryTimer);
  state.presenceTimer = null;
  state.expiryTimer = null;
}

function updateRoomShare(room) {
  const roomCode = room?.roomCode || state.roomCode;
  if (!roomCode) {
    els.roomShareCard.hidden = true;
    return;
  }

  els.roomShareCard.hidden = false;
  els.shareRoomCode.textContent = roomCode;
  const url = getInviteUrl(roomCode);
  els.inviteLink.href = url;
  els.inviteLink.textContent = url;
  renderRoomQrCode(url);

  const updateExpiryText = () => {
    const expiresAt = Number(room?.expiresAt || 0);
    if (!expiresAt) {
      els.roomExpiryLabel.textContent = '房間建立後會自動過期。';
      return;
    }
    const remaining = expiresAt - now();
    if (remaining <= 0) {
      els.roomExpiryLabel.textContent = '房間已過期，請重新建立。';
      return;
    }
    els.roomExpiryLabel.textContent = `房間約 ${formatTimeLeft(remaining)} 後自動過期，開始遊戲會重新延長。`;
  };

  updateExpiryText();
  clearInterval(state.expiryTimer);
  state.expiryTimer = setInterval(updateExpiryText, 30_000);
}

function getInviteUrl(roomCode) {
  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.set('room', roomCode);
  return url.toString();
}

async function copyInviteLink() {
  if (!state.roomCode) return;
  const url = getInviteUrl(state.roomCode);
  try {
    await navigator.clipboard.writeText(url);
    setStatus('已複製邀請連結，可以貼給朋友加入房間。');
  } catch {
    window.prompt('請複製這個邀請連結：', url);
  }
}

function renderRoomQrCode(url) {
  const canvas = els.roomQrCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (window.QRCode?.toCanvas) {
    window.QRCode.toCanvas(canvas, url, {
      width: 176,
      margin: 1,
      errorCorrectionLevel: 'M'
    }, error => {
      if (error) drawQrFallback(canvas);
    });
    return;
  }

  drawQrFallback(canvas);
  setTimeout(() => {
    if (state.roomCode && window.QRCode?.toCanvas) renderRoomQrCode(url);
  }, 1000);
}

function drawQrFallback(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QR 載入中', canvas.width / 2, 78);
  ctx.font = '12px sans-serif';
  ctx.fillText('也可直接複製邀請連結', canvas.width / 2, 104);
}

function formatTimeLeft(ms) {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} 小時 ${rest} 分鐘` : `${hours} 小時`;
  }
  return `${minutes} 分鐘`;
}

function formatLastSeen(timestamp) {
  const seconds = Math.max(1, Math.round((now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分前`;
  return `${Math.round(minutes / 60)} 小時前`;
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

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
