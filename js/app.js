import {
  THEMES,
  MOLE_VISUALS,
  HIT_SOUND_PRESETS,
  MISS_SOUND_PRESETS,
  MISSION_MODES,
  clampName,
  getLevelConfig,
  pickRandomHole,
  getBuiltInMole,
  pickMoleType,
  getMoleType,
  calculateTargetScore,
  calculateBossHp,
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
  applyPlayerHit,
  recordPlayerMiss,
  claimCoopHit,
  claimBossHit,
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
  missionModeSelect: $('#missionModeSelect'),
  missionHint: $('#missionHint'),
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
  missionStrip: $('#missionStrip'),
  gameBoard: $('#gameBoard'),
  startGameBtn: $('#startGameBtn'),
  leaveRoomBtn: $('#leaveRoomBtn'),
  roomLeaderboard: $('#roomLeaderboard'),
  localLeaderboard: $('#localLeaderboard'),
  resultDialog: $('#resultDialog'),
  resultTitle: $('#resultTitle'),
  resultText: $('#resultText'),
  closeResultBtn: $('#closeResultBtn'),
  holeTemplate: $('#holeTemplate')
};

const state = {
  mode: 'single',
  multiplayerMode: 'coop',
  missionMode: 'classic',
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
  currentMoleType: 'normal',
  currentMoleValue: 1,
  moleSequence: 0,
  lastHitMoleKey: '',
  lastBossHitAt: 0,
  score: 0,
  teamScore: 0,
  targetScore: 0,
  bossHp: 0,
  bossMaxHp: 0,
  playing: false,
  endsAt: 0,
  endedDialogKey: '',
  localPlayerName: '',
  moleVisual: { type: 'emoji', value: '🐹', label: '經典地鼠' },
  customMoleDataUrl: '',
  customHitSound: '',
  customMissSound: '',
  stats: createStats()
};

init();

function createStats() {
  return { hits: 0, misses: 0, combo: 0, maxCombo: 0, bossHits: 0 };
}

function init() {
  fillSelects();
  restorePreferences();
  bindEvents();
  updateLevelUi();
  updateMissionUi();
  buildBoard(getLevelConfig(els.levelRange.value).boardSize);
  updateLocalLeaderboard();
  renderRoomLeaderboard([]);
  updateFirebaseNotice();
  updateTopbar();
  updateMissionStrip();
  updateCustomMolePreview();
  updateUploadVisibility();
  setupInviteFromUrl();
  setupPwaInstall();
  registerServiceWorker();
}

function fillSelects() {
  els.themeSelect.innerHTML = THEMES.map(theme => `<option value="${theme.id}">${theme.emoji} ${theme.label}</option>`).join('');
  els.missionModeSelect.innerHTML = MISSION_MODES.map(mode => `<option value="${mode.id}">${mode.label}</option>`).join('');
  els.moleSelect.innerHTML = MOLE_VISUALS.map(item => `<option value="${item.id}">${item.emoji} ${item.label}</option>`).join('');
  els.hitSoundSelect.innerHTML = HIT_SOUND_PRESETS.map(item => `<option value="${item.id}">${item.label}</option>`).join('');
  els.missSoundSelect.innerHTML = MISS_SOUND_PRESETS.map(item => `<option value="${item.id}">${item.label}</option>`).join('');
  els.hitSoundCards.innerHTML = HIT_SOUND_PRESETS.map(item => soundButtonMarkup(item, 'hit')).join('');
  els.missSoundCards.innerHTML = MISS_SOUND_PRESETS.map(item => soundButtonMarkup(item, 'miss')).join('');
}

function soundButtonMarkup(item, type) {
  return `<button class="sound-card" type="button" data-sound-type="${type}" data-sound-id="${escapeAttribute(item.id)}" aria-pressed="false"><span>${escapeHtml(item.label)}</span></button>`;
}

function restorePreferences() {
  els.playerName.value = localStorage.getItem('wam.playerName') || '';
  els.levelRange.value = localStorage.getItem('wam.level') || '1';
  els.durationSelect.value = localStorage.getItem('wam.duration') || '45';
  els.missionModeSelect.value = localStorage.getItem('wam.missionMode') || 'classic';
  els.themeSelect.value = localStorage.getItem('wam.theme') || 'ocean';
  els.multiplayerModeSelect.value = localStorage.getItem('wam.multiplayerMode') || 'coop';
  els.moleSelect.value = localStorage.getItem('wam.moleId') || 'hamster';
  els.hitSoundSelect.value = localStorage.getItem('wam.hitSoundPreset') || 'sparkle';
  els.missSoundSelect.value = localStorage.getItem('wam.missSoundPreset') || 'soft-buzz';
  els.soundToggle.checked = localStorage.getItem('wam.sound') !== 'off';

  state.multiplayerMode = els.multiplayerModeSelect.value;
  state.missionMode = els.missionModeSelect.value;
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
    updateMissionUi();
    if (!state.playing && state.mode === 'single') buildBoard(getLevelConfig(els.levelRange.value).boardSize);
  });
  els.durationSelect.addEventListener('change', () => {
    localStorage.setItem('wam.duration', els.durationSelect.value);
    updateMissionUi();
    if (!state.playing) updateTopbar();
  });
  els.missionModeSelect.addEventListener('change', () => {
    state.missionMode = els.missionModeSelect.value;
    localStorage.setItem('wam.missionMode', state.missionMode);
    updateMissionUi();
    updateMissionStrip();
  });
  els.themeSelect.addEventListener('change', () => {
    localStorage.setItem('wam.theme', els.themeSelect.value);
    document.body.dataset.theme = els.themeSelect.value;
  });
  els.multiplayerModeSelect.addEventListener('change', () => {
    state.multiplayerMode = els.multiplayerModeSelect.value;
    localStorage.setItem('wam.multiplayerMode', state.multiplayerMode);
    updateMissionUi();
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

  els.hitSoundSelect.addEventListener('change', () => handleHitSoundChoice(els.hitSoundSelect.value, { preview: true }));
  els.missSoundSelect.addEventListener('change', () => handleMissSoundChoice(els.missSoundSelect.value, { preview: true }));
  els.hitSoundCards.addEventListener('click', event => {
    const button = event.target.closest('button[data-sound-id]');
    if (button) handleHitSoundChoice(button.dataset.soundId, { preview: true });
  });
  els.missSoundCards.addEventListener('click', event => {
    const button = event.target.closest('button[data-sound-id]');
    if (button) handleMissSoundChoice(button.dataset.soundId, { preview: true });
  });
  els.hitSoundUpload.addEventListener('change', event => handleAudioUpload(event, 'hit'));
  els.missSoundUpload.addEventListener('change', event => handleAudioUpload(event, 'miss'));
  els.previewHitSound.addEventListener('click', () => { Sound.unlock(); Sound.previewHit(); });
  els.previewMissSound.addEventListener('click', () => { Sound.unlock(); Sound.previewMiss(); });

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

  $$('.tab').forEach(button => button.addEventListener('click', () => switchLeaderboardTab(button.dataset.tab)));

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

function updateFirebaseNotice() {
  els.firebaseNotice.textContent = isFirebaseConfigured()
    ? 'Firebase 已設定，可以建立或加入多人房間。'
    : '多人模式需要先修改 js/firebase-config.js 並設定 Firebase。';
}

function updateLevelUi() {
  const config = getLevelConfig(els.levelRange.value);
  els.levelText.textContent = config.level;
  els.levelHint.textContent = config.label;
}

function updateMissionUi() {
  const mission = MISSION_MODES.find(item => item.id === els.missionModeSelect.value) || MISSION_MODES[0];
  const target = calculateTargetScore({
    level: Number(els.levelRange.value),
    duration: Number(els.durationSelect.value),
    playerCount: state.room ? Object.keys(state.room.players || {}).length : 1,
    missionMode: mission.id
  });
  const bossHp = calculateBossHp({
    level: Number(els.levelRange.value),
    playerCount: state.room ? Object.keys(state.room.players || {}).length : 1
  });
  if (mission.id === 'target') els.missionHint.textContent = `${mission.description} 建議目標約 ${target} 分。`;
  else if (mission.id === 'boss') els.missionHint.textContent = `${mission.description} 預估 Boss 血量 ${bossHp}。`;
  else els.missionHint.textContent = mission.description;
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
    if (visual.type === 'image') mole.innerHTML = `<img src="${escapeAttribute(visual.value)}" alt="${escapeAttribute(visual.label)}" />`;
    else mole.textContent = visual.value || '🐹';
  });
}

function setActiveMole(index, moleKey = '', moleType = 'normal', moleValue = 1) {
  state.currentMole = index;
  state.currentMoleKey = moleKey;
  state.currentMoleType = moleType || 'normal';
  state.currentMoleValue = Number(moleValue || getMoleType(moleType).score || 1);
  const type = getMoleType(state.currentMoleType);
  $$('.hole').forEach(hole => {
    const active = Number(hole.dataset.index) === Number(index);
    hole.classList.toggle('active', active);
    hole.dataset.moleType = active ? type.id : '';
    const badge = hole.querySelector('.mole-badge');
    if (badge) badge.textContent = active ? type.emoji : '';
    if (!active) hole.classList.remove('hit', 'bad-hit', 'heart-hit', 'boss-hit', 'miss-tap');
  });
}

function triggerHitEffect(hole, moleType, text) {
  const type = getMoleType(moleType);
  const pop = hole.querySelector('.hit-pop');
  if (pop) pop.textContent = text || type.pop;
  hole.classList.remove('hit', 'bad-hit', 'heart-hit', 'boss-hit');
  void hole.offsetWidth;
  hole.classList.add('hit');
  if (type.id === 'bomb') hole.classList.add('bad-hit');
  if (type.id === 'heart') hole.classList.add('heart-hit');
  if (type.id === 'boss') hole.classList.add('boss-hit');
}

function triggerMissEffect(hole = null) {
  const target = hole || els.gameBoard;
  target.classList.remove('miss-tap');
  void target.offsetWidth;
  target.classList.add('miss-tap');
  setTimeout(() => target.classList.remove('miss-tap'), 220);
}

function vibrate(pattern) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

function updateStatsForLocal({ scoreDelta = 0, hit = false, miss = false, bossHit = false } = {}) {
  state.score = Math.max(0, state.score + Number(scoreDelta || 0));
  if (hit) state.stats.hits += 1;
  if (miss) state.stats.misses += 1;
  if (bossHit) state.stats.bossHits += 1;
  if (miss || scoreDelta < 0) state.stats.combo = 0;
  else if (hit) state.stats.combo += 1;
  state.stats.maxCombo = Math.max(state.stats.maxCombo, state.stats.combo);
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
  if (!file.type.startsWith('image/')) return setStatus('請選擇圖片檔。');
  if (file.size > 1024 * 1024) return setStatus('圖片建議小於 1MB，請壓縮後再上傳。');
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
  if (!file.type.startsWith('audio/')) return setStatus('請選擇音訊檔。');
  if (file.size > 700 * 1024) return setStatus('音效檔建議小於 700KB，請先裁短或壓縮後再上傳。');
  try {
    const dataUrl = await readFileAsDataUrl(file);
    if (type === 'hit') {
      state.customHitSound = dataUrl;
      localStorage.setItem('wam.customHitSound', dataUrl);
      handleHitSoundChoice('custom-hit');
      Sound.setCustomHitSound(dataUrl);
      setStatus('自訂打中音效已套用。');
      Sound.previewHit();
    } else {
      state.customMissSound = dataUrl;
      localStorage.setItem('wam.customMissSound', dataUrl);
      handleMissSoundChoice('custom-miss');
      Sound.setCustomMissSound(dataUrl);
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

function updateMissionStrip() {
  const missionMode = state.room?.missionMode || state.missionMode;
  if (!missionMode || missionMode === 'classic') {
    els.missionStrip.hidden = true;
    els.missionStrip.innerHTML = '';
    return;
  }

  els.missionStrip.hidden = false;
  if (missionMode === 'target') {
    const target = state.room?.targetScore || state.targetScore || calculateTargetScore({ level: Number(els.levelRange.value), duration: Number(els.durationSelect.value), playerCount: 1, missionMode });
    const score = state.mode === 'online' ? state.teamScore : state.score;
    const percent = Math.min(100, Math.round(score / Math.max(1, target) * 100));
    els.missionStrip.innerHTML = `
      <div class="mission-info"><strong>限時達標</strong><span>${score} / ${target} 分</span></div>
      <div class="mission-bar"><span style="width:${percent}%"></span></div>
    `;
    return;
  }

  if (missionMode === 'boss') {
    const hp = Math.max(0, Number(state.room?.bossHp ?? state.bossHp ?? 0));
    const maxHp = Math.max(1, Number(state.room?.bossMaxHp ?? state.bossMaxHp ?? 1));
    const percent = Math.min(100, Math.round(hp / maxHp * 100));
    els.missionStrip.innerHTML = `
      <div class="mission-info"><strong>Boss 地鼠</strong><span>HP ${hp} / ${maxHp}</span></div>
      <div class="mission-bar boss"><span style="width:${percent}%"></span></div>
    `;
  }
}

function setStatus(message) {
  els.statusStrip.textContent = message;
}

function startSingleGame() {
  if (state.roomCode) {
    leaveRoom(state.roomCode).catch(() => {});
    resetToSingleMode();
  }
  Sound.start();
  clearTimers();
  state.mode = 'single';
  state.score = 0;
  state.teamScore = 0;
  state.stats = createStats();
  state.playing = true;
  state.lastHitMoleKey = '';
  state.currentMoleKey = '';
  state.currentMoleType = 'normal';
  state.moleSequence = 0;
  state.missionMode = els.missionModeSelect.value;
  state.moleVisual = getSelectedMoleVisual();
  state.endsAt = now() + Number(els.durationSelect.value) * 1000;
  state.targetScore = state.missionMode === 'target'
    ? calculateTargetScore({ level: Number(els.levelRange.value), duration: Number(els.durationSelect.value), playerCount: 1, missionMode: state.missionMode })
    : 0;
  state.bossMaxHp = state.missionMode === 'boss' ? calculateBossHp({ level: Number(els.levelRange.value), playerCount: 1 }) : 0;
  state.bossHp = state.bossMaxHp;

  const levelConfig = getLevelConfig(els.levelRange.value);
  buildBoard(levelConfig.boardSize);
  updateTopbar();
  updateMissionStrip();
  setStatus(`單人遊戲開始！黃金 +5、炸彈 -3、愛心 +3 秒。`);
  els.startGameBtn.textContent = '重新開始';
  els.leaveRoomBtn.hidden = true;

  const publishLocalMole = () => {
    if (!state.playing) return;
    if (now() >= state.endsAt) return endSingleGame();
    if (state.currentMoleType === 'boss' && state.currentMole >= 0 && state.bossHp > 0) return;
    state.moleSequence += 1;
    const index = pickRandomHole(state.boardSize, state.currentMole);
    const type = pickMoleType({ level: Number(els.levelRange.value), missionMode: state.missionMode, sequence: state.moleSequence });
    const moleKey = `${Date.now()}-${index}-${type.id}`;
    setActiveMole(index, moleKey, type.id, type.score);
    clearTimeout(state.activeMoleTimer);
    if (type.id !== 'boss') {
      state.activeMoleTimer = setTimeout(() => {
        if (state.currentMoleKey === moleKey) setActiveMole(-1, '', 'normal', 1);
      }, levelConfig.visibleMs);
    }
  };

  publishLocalMole();
  state.singleTimer = setInterval(publishLocalMole, levelConfig.intervalMs);
  state.clockTimer = setInterval(() => {
    updateTopbar();
    updateMissionStrip();
    if (state.missionMode === 'target' && state.targetScore && state.score >= state.targetScore) endSingleGame({ completed: true, reason: 'target' });
    if (state.missionMode === 'boss' && state.bossMaxHp && state.bossHp <= 0) endSingleGame({ completed: true, reason: 'boss' });
    if (now() >= state.endsAt) endSingleGame();
  }, 180);
}

function endSingleGame(options = {}) {
  if (!state.playing || state.mode !== 'single') return;
  state.playing = false;
  clearTimers();
  setActiveMole(-1, '', 'normal', 1);
  Sound.end();
  const completed = Boolean(options.completed || (state.missionMode === 'target' && state.score >= state.targetScore) || (state.missionMode === 'boss' && state.bossMaxHp && state.bossHp <= 0));
  const summary = buildResultSummary({
    title: completed ? '任務成功！' : '遊戲結束',
    score: state.score,
    stats: state.stats,
    missionMode: state.missionMode,
    targetScore: state.targetScore,
    bossDefeated: state.bossMaxHp ? state.bossHp <= 0 : false,
    players: [{ name: getPlayerName(), score: state.score, ...state.stats }],
    completed
  });
  setStatus(`${summary.title} 你的分數是 ${state.score}，命中率 ${summary.accuracy}% ，最高連擊 ${state.stats.maxCombo}。`);
  saveLocalScore({
    name: getPlayerName(),
    score: state.score,
    level: Number(els.levelRange.value),
    duration: Number(els.durationSelect.value),
    mode: state.missionMode === 'classic' ? '單人' : `單人・${getMissionLabel(state.missionMode)}`,
    hits: state.stats.hits,
    misses: state.stats.misses,
    maxCombo: state.stats.maxCombo,
    accuracy: summary.accuracy,
    grade: summary.grade
  });
  updateLocalLeaderboard();
  showResult(summary);
  updateTopbar();
  updateMissionStrip();
}

function getCurrentOnlineMoleType() {
  return getMoleType(state.room?.moleType || state.currentMoleType || 'normal');
}

function getCurrentOnlineMoleValue() {
  const type = getCurrentOnlineMoleType();
  return Number(state.room?.moleValue ?? type.score ?? 1);
}

function handleHolePress(event) {
  const hole = event.target.closest('.hole');
  if (!hole || !state.playing) return;
  Sound.unlock();
  const index = Number(hole.dataset.index);

  if (index !== state.currentMole || !hole.classList.contains('active')) {
    Sound.miss();
    vibrate(20);
    triggerMissEffect(hole);
    if (state.mode === 'single') updateStatsForLocal({ miss: true });
    if (state.mode === 'online' && state.roomCode) recordPlayerMiss(state.roomCode).catch(() => {});
    updateTopbar();
    return;
  }

  if (state.mode === 'single') {
    handleSingleHit(hole);
    return;
  }

  if (state.mode === 'online' && state.room?.status === 'playing') {
    handleOnlineHit(hole).catch(error => setStatus(error.message || '打擊失敗。'));
  }
}

function handleSingleHit(hole) {
  const type = getMoleType(state.currentMoleType);
  if (type.id === 'boss') {
    if (now() - state.lastBossHitAt < 180) return;
    state.lastBossHitAt = now();
    state.bossHp = Math.max(0, state.bossHp - 1);
    updateStatsForLocal({ scoreDelta: 2, hit: true, bossHit: true });
    triggerHitEffect(hole, 'boss', state.bossHp <= 0 ? '擊敗!' : '-1HP');
    Sound.hit();
    vibrate(28);
    if (state.bossHp <= 0) {
      setActiveMole(-1, '', 'normal', 1);
      setStatus('Boss 地鼠被擊敗了！');
    }
    updateTopbar();
    updateMissionStrip();
    return;
  }

  if (state.lastHitMoleKey === state.currentMoleKey) return;
  state.lastHitMoleKey = state.currentMoleKey;
  const isBomb = type.id === 'bomb';
  const delta = Number(type.score || 1);
  updateStatsForLocal({ scoreDelta: delta, hit: !isBomb, miss: isBomb });
  if (type.extraTimeMs) state.endsAt += type.extraTimeMs;
  triggerHitEffect(hole, type.id, type.pop);
  if (isBomb) {
    Sound.miss();
    vibrate([30, 40, 30]);
  } else {
    Sound.hit();
    vibrate(type.id === 'golden' ? [20, 25, 20] : 18);
  }
  setTimeout(() => hole.classList.remove('active', 'hit', 'bad-hit', 'heart-hit'), 160);
  if (type.id !== 'bomb') setStatus(type.id === 'heart' ? '愛心地鼠！時間 +3 秒。' : type.id === 'golden' ? '黃金地鼠！+5 分。' : '打到了！');
  else setStatus('打到炸彈了，分數 -3、連擊歸零。');
  updateTopbar();
  updateMissionStrip();
}

async function handleOnlineHit(hole) {
  const roomMode = state.room.gameMode || 'coop';
  const type = getCurrentOnlineMoleType();
  const scoreDelta = getCurrentOnlineMoleValue();

  if (roomMode === 'coop' && type.id === 'boss') {
    if (now() - state.lastBossHitAt < 220) return;
    state.lastBossHitAt = now();
    const result = await claimBossHit({ roomCode: state.roomCode, moleKey: state.room.moleKey });
    if (!result.committed) return;
    triggerHitEffect(hole, 'boss', result.defeated ? '擊敗!' : '-1HP');
    Sound.hit();
    vibrate(result.defeated ? [40, 60, 40] : 26);
    if (result.defeated && state.isHost) {
      await endRoomGame(state.roomCode, { completed: true, reason: 'boss' });
    }
    return;
  }

  if (!state.room.moleKey || state.lastHitMoleKey === state.room.moleKey) return;
  if (roomMode === 'coop' && state.room.lastHitMoleKey === state.room.moleKey) return;

  state.lastHitMoleKey = state.room.moleKey;
  triggerHitEffect(hole, type.id, type.pop);

  if (roomMode === 'coop') {
    const committed = await claimCoopHit({
      roomCode: state.roomCode,
      moleKey: state.room.moleKey,
      moleType: type.id,
      scoreDelta
    });
    if (committed) {
      if (type.id === 'bomb') {
        Sound.miss();
        vibrate([30, 40, 30]);
      } else {
        Sound.hit();
        vibrate(type.id === 'heart' ? [18, 40, 18] : 22);
      }
    } else {
      Sound.miss();
    }
  } else {
    await applyPlayerHit({ roomCode: state.roomCode, moleKey: state.room.moleKey, moleType: type.id, scoreDelta });
    if (type.id === 'bomb') {
      Sound.miss();
      vibrate([30, 40, 30]);
    } else {
      Sound.hit();
      vibrate(22);
    }
  }

  setTimeout(() => hole.classList.remove('hit', 'bad-hit', 'heart-hit'), 160);
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
      missionMode: els.missionModeSelect.value,
      moleVisual: state.moleVisual
    });
    await enterOnlineRoom(result.roomCode, result.uid);
    const modeText = els.multiplayerModeSelect.value === 'coop' ? '合作模式' : '競賽模式';
    setStatus(`房間 ${result.roomCode} 已建立。${modeText}・${getMissionLabel(els.missionModeSelect.value)}。`);
    Sound.click();
  } catch (error) {
    setStatus(error.message || '建立房間失敗。');
  }
}

async function handleJoinRoom() {
  try {
    setStatus('正在加入房間...');
    const result = await joinRoom({ roomCode: els.roomCodeInput.value, playerName: getPlayerName() });
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
  state.stats = createStats();
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
  const me = room.players?.[state.uid] || {};
  state.score = Number(me.score || 0);
  state.stats = {
    hits: Number(me.hits || 0),
    misses: Number(me.misses || 0),
    combo: Number(me.combo || 0),
    maxCombo: Number(me.maxCombo || 0),
    bossHits: Number(me.bossHits || 0)
  };
  state.teamScore = Number(room.teamScore || 0);
  state.targetScore = Number(room.targetScore || 0);
  state.bossHp = Number(room.bossHp || 0);
  state.bossMaxHp = Number(room.bossMaxHp || 0);
  state.multiplayerMode = room.gameMode || 'coop';
  state.missionMode = room.missionMode || 'classic';
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
  if (room.missionMode) els.missionModeSelect.value = room.missionMode;
  if (room.boardSize && room.boardSize !== state.boardSize) buildBoard(room.boardSize);
  updateMissionUi();

  renderRoomLeaderboard(Object.entries(room.players || {}).map(([uid, player]) => ({ uid, ...player })), room.gameMode || 'coop');

  if (room.status === 'playing') {
    state.playing = true;
    state.endsAt = Number(room.endsAt || 0);
    const type = getMoleType(room.moleType || 'normal');
    const hitAlready = room.gameMode === 'coop' && type.id !== 'boss' && room.lastHitMoleKey && room.lastHitMoleKey === room.moleKey;
    setActiveMole(hitAlready ? -1 : Number(room.currentMole ?? -1), hitAlready ? '' : room.moleKey || '', type.id, room.moleValue || type.score);
    updateOnlineClock(room);
    if (state.isHost) startHostMoleLoop(room);
    els.startGameBtn.textContent = state.isHost ? '重新開始多人遊戲' : '等待房主';
    els.startGameBtn.disabled = !state.isHost;
    setOnlineStatus(room);
    if (state.isHost && room.gameMode === 'coop' && room.missionMode === 'target' && room.targetScore && state.teamScore >= Number(room.targetScore)) {
      endRoomGame(state.roomCode, { completed: true, reason: 'target' }).catch(() => {});
    }
    if (state.isHost && room.gameMode === 'coop' && room.missionMode === 'boss' && Number(room.bossHp || 0) <= 0 && Number(room.bossMaxHp || 0) > 0) {
      endRoomGame(state.roomCode, { completed: true, reason: 'boss' }).catch(() => {});
    }
  } else {
    clearInterval(state.hostTimer);
    clearInterval(state.clockTimer);
    state.hostTimer = null;
    state.clockTimer = null;
    state.playing = false;
    setActiveMole(-1, '', 'normal', 1);
    els.startGameBtn.disabled = !state.isHost && room.status !== 'waiting';
    els.startGameBtn.textContent = state.isHost ? '開始多人遊戲' : '等待房主';

    if (room.status === 'ended') {
      const dialogKey = `${state.roomCode}-${room.endsAt || room.updatedAt || 'ended'}-${room.completed ? '1' : '0'}`;
      const players = Object.entries(room.players || {}).map(([uid, player]) => ({ uid, ...player }));
      const summary = buildResultSummary({
        title: room.completed ? '任務成功！' : '多人遊戲結束',
        score: room.gameMode === 'coop' ? state.teamScore : state.score,
        stats: room.gameMode === 'coop' ? sumStats(players) : state.stats,
        missionMode: room.missionMode || 'classic',
        targetScore: Number(room.targetScore || 0),
        bossDefeated: Boolean(Number(room.bossHp || 0) <= 0 && Number(room.bossMaxHp || 0) > 0 || room.endReason === 'boss'),
        players,
        completed: Boolean(room.completed),
        roomMode: room.gameMode || 'coop'
      });
      setStatus(`${summary.title} ${room.gameMode === 'coop' ? `團隊分數 ${state.teamScore}` : `你的分數 ${state.score}`}，評級 ${summary.grade}。`);
      if (dialogKey !== state.endedDialogKey) {
        state.endedDialogKey = dialogKey;
        Sound.end();
        showResult(summary);
      }
    } else {
      setStatus(state.isHost ? `房間 ${state.roomCode} 等待中。分享房號，按開始一起玩。` : `已在房間 ${state.roomCode}，等待房主開始。`);
    }
  }

  updateTopbar();
  updateMissionStrip();
}

function setOnlineStatus(room) {
  const type = getMoleType(room.moleType || 'normal');
  if (type.id === 'boss') {
    setStatus(`Boss 地鼠出現！大家連打削減 HP，目前 ${Number(room.bossHp || 0)} / ${Number(room.bossMaxHp || 1)}。`);
    return;
  }
  const missionText = getMissionLabel(room.missionMode || 'classic');
  const specialText = type.id === 'normal' ? '' : ` 特殊地鼠：${type.label}。`;
  if (room.gameMode === 'coop') setStatus(`${missionText}進行中，大家共同累積合作分數。${specialText}`);
  else setStatus(`競賽模式進行中，每位玩家各自計分。${specialText}`);
}

function startHostMoleLoop(room) {
  if (state.hostTimer) return;
  const config = getLevelConfig(room.level || 1);

  const publishNext = () => {
    if (!state.room || state.room.status !== 'playing') return;
    if (state.room.gameMode === 'coop' && state.room.missionMode === 'target' && Number(state.room.targetScore || 0) > 0 && Number(state.room.teamScore || 0) >= Number(state.room.targetScore || 0)) {
      clearInterval(state.hostTimer);
      state.hostTimer = null;
      endRoomGame(state.roomCode, { completed: true, reason: 'target' }).catch(error => setStatus(error.message));
      return;
    }
    if (state.room.gameMode === 'coop' && state.room.missionMode === 'boss' && Number(state.room.bossHp || 0) <= 0 && Number(state.room.bossMaxHp || 0) > 0) {
      clearInterval(state.hostTimer);
      state.hostTimer = null;
      endRoomGame(state.roomCode, { completed: true, reason: 'boss' }).catch(error => setStatus(error.message));
      return;
    }
    if (now() >= Number(state.room.endsAt || 0)) {
      clearInterval(state.hostTimer);
      state.hostTimer = null;
      const completed = state.room.gameMode === 'coop' && state.room.missionMode === 'target' && Number(state.room.teamScore || 0) >= Number(state.room.targetScore || 0);
      endRoomGame(state.roomCode, { completed, reason: completed ? 'target' : 'time' }).catch(error => setStatus(error.message));
      return;
    }
    if (state.room.moleType === 'boss' && Number(state.room.bossHp || 0) > 0 && Number(state.room.currentMole ?? -1) >= 0) return;

    const sequence = Number(state.room.moleSequence || 0) + 1;
    let type = pickMoleType({ level: Number(state.room.level || 1), missionMode: state.room.missionMode || 'classic', sequence });
    if (state.room.gameMode !== 'coop' && type.id === 'boss') type = getMoleType('normal');
    if (state.room.missionMode !== 'boss' && type.id === 'boss') type = getMoleType('normal');
    if (state.room.missionMode === 'boss' && Number(state.room.bossHp || 0) <= 0 && type.id === 'boss') type = getMoleType('normal');

    const index = pickRandomHole(Number(state.room.boardSize || config.boardSize), Number(state.room.currentMole ?? -1));
    publishMole({
      roomCode: state.roomCode,
      index,
      moleKey: `${Date.now()}-${index}-${type.id}`,
      moleType: type.id,
      moleValue: type.score,
      moleSequence: sequence,
      bossHp: type.id === 'boss' ? Number(state.room.bossHp || state.room.bossMaxHp || 1) : 0,
      bossMaxHp: type.id === 'boss' ? Number(state.room.bossMaxHp || 1) : 0
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
    updateMissionStrip();
    if (state.isHost && state.playing && now() >= state.endsAt) {
      clearInterval(state.clockTimer);
      const completed = state.room?.gameMode === 'coop' && state.room?.missionMode === 'target' && Number(state.room?.teamScore || 0) >= Number(state.room?.targetScore || 0);
      endRoomGame(state.roomCode, { completed, reason: completed ? 'target' : 'time' }).catch(error => setStatus(error.message));
    }
  }, 200);
}

async function handleOnlineStart() {
  if (!state.roomCode || !state.isHost) return setStatus('只有房主可以開始多人遊戲。');
  try {
    Sound.start();
    state.moleVisual = getSelectedMoleVisual();
    await startRoomGame({
      roomCode: state.roomCode,
      level: Number(els.levelRange.value),
      theme: els.themeSelect.value,
      duration: Number(els.durationSelect.value),
      gameMode: els.multiplayerModeSelect.value,
      missionMode: els.missionModeSelect.value,
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
  state.stats = createStats();
  state.playing = false;
  state.moleVisual = getSelectedMoleVisual();
  els.leaveRoomBtn.hidden = true;
  els.startGameBtn.disabled = false;
  els.startGameBtn.textContent = '開始遊戲';
  els.roomShareCard.hidden = true;
  buildBoard(getLevelConfig(els.levelRange.value).boardSize);
  renderRoomLeaderboard([]);
  updateTopbar();
  updateMissionStrip();
}

function showResult(summary) {
  if (typeof summary === 'string') {
    els.resultTitle.textContent = '遊戲結束';
    els.resultText.textContent = summary;
  } else {
    els.resultTitle.textContent = summary.title;
    els.resultText.innerHTML = resultMarkup(summary);
  }
  if (typeof els.resultDialog.showModal === 'function') els.resultDialog.showModal();
  else alert(typeof summary === 'string' ? summary : `${summary.title}\n分數：${summary.score}\n評級：${summary.grade}`);
}

function buildResultSummary({ title, score, stats, missionMode, targetScore = 0, bossDefeated = false, players = [], completed = false, roomMode = 'single' }) {
  const totalAttempts = Number(stats.hits || 0) + Number(stats.misses || 0);
  const accuracy = totalAttempts ? Math.round(Number(stats.hits || 0) / totalAttempts * 100) : 0;
  const mvp = getMvp(players);
  const grade = calculateGrade({ score, accuracy, maxCombo: stats.maxCombo || 0, missionMode, completed, targetScore });
  return {
    title,
    score,
    stats,
    accuracy,
    grade,
    missionMode,
    targetScore,
    bossDefeated,
    mvp,
    players,
    completed,
    roomMode
  };
}

function resultMarkup(summary) {
  const mission = getMissionLabel(summary.missionMode);
  const mvpLine = summary.mvp ? `<p><strong>MVP：</strong>${escapeHtml(summary.mvp.name)}，${Number(summary.mvp.score || 0)} 分，最高連擊 ${Number(summary.mvp.maxCombo || 0)}</p>` : '';
  const missionLine = summary.missionMode === 'target'
    ? `<p><strong>任務：</strong>${escapeHtml(mission)}・${summary.completed ? '達標成功' : `未達標，目標 ${summary.targetScore}`}</p>`
    : summary.missionMode === 'boss'
      ? `<p><strong>任務：</strong>${escapeHtml(mission)}・${summary.bossDefeated ? 'Boss 已擊敗' : 'Boss 尚未擊敗'}</p>`
      : `<p><strong>模式：</strong>${escapeHtml(mission)}</p>`;
  const playerRows = summary.players?.length
    ? `<div class="result-player-list">${summary.players
        .slice()
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 8)
        .map((player, index) => `<div><span>${index + 1}. ${escapeHtml(player.name || '玩家')}</span><strong>${Number(player.score || 0)}</strong></div>`)
        .join('')}</div>`
    : '';

  return `
    <div class="result-grade">${escapeHtml(summary.grade)}</div>
    ${missionLine}
    <div class="result-stats-grid">
      <div><span>總分</span><strong>${Number(summary.score || 0)}</strong></div>
      <div><span>命中率</span><strong>${summary.accuracy}%</strong></div>
      <div><span>最高連擊</span><strong>${Number(summary.stats.maxCombo || 0)}</strong></div>
      <div><span>Boss 命中</span><strong>${Number(summary.stats.bossHits || 0)}</strong></div>
    </div>
    <p><strong>命中 / 失誤：</strong>${Number(summary.stats.hits || 0)} / ${Number(summary.stats.misses || 0)}</p>
    ${mvpLine}
    ${playerRows}
  `;
}

function getMvp(players) {
  const sorted = (players || [])
    .filter(player => player && player.name)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(b.maxCombo || 0) - Number(a.maxCombo || 0));
  return sorted[0] || null;
}

function calculateGrade({ score, accuracy, maxCombo, missionMode, completed, targetScore }) {
  let points = 0;
  points += Math.min(45, Math.round(Number(score || 0) * 1.4));
  points += Math.min(30, Math.round(Number(accuracy || 0) * 0.3));
  points += Math.min(20, Number(maxCombo || 0) * 2);
  if (missionMode !== 'classic' && completed) points += 18;
  if (missionMode === 'target' && targetScore && score >= targetScore) points += 8;
  if (points >= 105) return 'S+';
  if (points >= 90) return 'S';
  if (points >= 75) return 'A';
  if (points >= 58) return 'B';
  if (points >= 40) return 'C';
  return 'D';
}

function sumStats(players) {
  return (players || []).reduce((acc, player) => {
    acc.hits += Number(player.hits || 0);
    acc.misses += Number(player.misses || 0);
    acc.maxCombo = Math.max(acc.maxCombo, Number(player.maxCombo || 0));
    acc.bossHits += Number(player.bossHits || 0);
    return acc;
  }, createStats());
}

function saveLocalScore(record) {
  const scores = getLocalScores();
  scores.push({ ...record, date: new Date().toISOString() });
  scores.sort((a, b) => b.score - a.score || b.level - a.level);
  localStorage.setItem('wam.localScores', JSON.stringify(scores.slice(0, 10)));
}

function getLocalScores() {
  try { return JSON.parse(localStorage.getItem('wam.localScores') || '[]'); }
  catch { return []; }
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
      <span>${escapeHtml(item.name)}<br><small>${escapeHtml(item.mode || '單人')}・難度 ${item.level}・${item.duration} 秒・命中率 ${item.accuracy ?? 0}%・${item.grade || '-'}</small></span>
      <strong>${item.score}</strong>
    </li>
  `).join('');
}

function renderRoomLeaderboard(players, roomMode = 'coop') {
  const list = players.filter(player => player && player.name).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  if (!list.length) {
    els.roomLeaderboard.innerHTML = '<li class="empty">多人房間建立後會顯示玩家資訊。</li>';
    return;
  }
  const scoreLabel = roomMode === 'coop' ? '貢獻' : '分數';
  const mission = state.room?.missionMode || 'classic';
  const missionHeader = mission !== 'classic'
    ? `<li class="team-score-row mission-row"><span>${mission === 'boss' ? '👑' : '🎯'}</span><span>${escapeHtml(getMissionLabel(mission))}${mission === 'target' ? `<br><small>目標 ${Number(state.room?.targetScore || 0)} 分</small>` : mission === 'boss' ? `<br><small>Boss HP ${Number(state.room?.bossHp || 0)} / ${Number(state.room?.bossMaxHp || 0)}</small>` : ''}</span><strong>${state.room?.completed ? '成功' : '進行'}</strong></li>`
    : '';
  const teamHeader = roomMode === 'coop'
    ? `<li class="team-score-row"><span>🤝</span><span>團隊合作分數</span><strong>${state.teamScore}</strong></li>`
    : '';

  els.roomLeaderboard.innerHTML = missionHeader + teamHeader + list.map((player, index) => {
    const lastSeen = Number(player.lastSeen || 0);
    const recentlySeen = lastSeen > 0 && now() - lastSeen < 45_000;
    const online = Boolean(player.active) && recentlySeen;
    const presenceText = online ? '在線' : `離線${lastSeen ? `・${formatLastSeen(lastSeen)}` : ''}`;
    return `
      <li class="${online ? 'online-player' : 'offline-player'}">
        <span class="rank">${index + 1}</span>
        <span>${escapeHtml(player.name)}${player.uid === state.uid ? '（你）' : ''}<br><small><span class="presence-dot"></span>${presenceText}・${scoreLabel}・命中 ${Number(player.hits || 0)}・連擊 ${Number(player.maxCombo || 0)}</small></span>
        <strong>${Number(player.score || 0)}</strong>
      </li>
    `;
  }).join('');
}

function getMissionLabel(missionMode) {
  return (MISSION_MODES.find(item => item.id === missionMode) || MISSION_MODES[0]).label;
}

function startPresence(roomCode) {
  stopPresence();
  touchMyPresence(roomCode).catch(() => {});
  state.presenceTimer = setInterval(() => {
    if (state.mode === 'online' && state.roomCode) touchMyPresence(state.roomCode).catch(() => {});
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
    if (!expiresAt) return els.roomExpiryLabel.textContent = '房間建立後會自動過期。';
    const remaining = expiresAt - now();
    if (remaining <= 0) return els.roomExpiryLabel.textContent = '房間已過期，請重新建立。';
    els.roomExpiryLabel.textContent = `房間約 ${formatTimeLeft(remaining)} 後自動過期，開始遊戲會重新延長。`;
  };
  updateExpiryText();
  clearInterval(state.expiryTimer);
  state.expiryTimer = setInterval(updateExpiryText, 30_000);
}

function getInviteUrl(roomCode) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.hash = '';
  url.search = '';
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
    window.QRCode.toCanvas(canvas, url, { width: 176, margin: 1, errorCorrectionLevel: 'M' }, error => {
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
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QR 產生失敗', canvas.width / 2, 76);
  ctx.font = '12px sans-serif';
  ctx.fillText('請使用邀請連結或房號', canvas.width / 2, 104);
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
  if (!state.deferredInstallPrompt) return setStatus('目前瀏覽器尚未提供安裝按鈕。iPhone 請用 Safari 分享 → 加到主畫面。');
  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice.catch(() => null);
  state.deferredInstallPrompt = null;
  els.installPwaBtn.hidden = true;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
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
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
