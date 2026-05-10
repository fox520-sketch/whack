import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  onDisconnect,
  runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';

import { firebaseConfig, hasFirebaseConfig } from './firebase-config.js';
import {
  createRoomCode,
  getLevelConfig,
  getMoleType,
  calculateTargetScore,
  calculateBossHp,
  now
} from './game-settings.js';

export const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

let app = null;
let auth = null;
let db = null;
let readyPromise = null;

export function isFirebaseConfigured() {
  return hasFirebaseConfig();
}

export async function ensureFirebase() {
  if (!hasFirebaseConfig()) {
    throw new Error('尚未設定 Firebase。請先修改 js/firebase-config.js。');
  }

  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
  }

  if (!readyPromise) {
    readyPromise = new Promise((resolve, reject) => {
      const stop = onAuthStateChanged(auth, async user => {
        stop();
        if (user) {
          resolve(user);
          return;
        }
        try {
          const credential = await signInAnonymously(auth);
          resolve(credential.user);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  const user = await readyPromise;
  return { app, auth, db, user };
}

async function cleanupExpiredRoomIfNeeded(roomCode, room) {
  if (!room || !room.expiresAt || Number(room.expiresAt) > now()) return false;
  const { db: database } = await ensureFirebase();
  await remove(ref(database, `rooms/${roomCode}`));
  return true;
}

async function findAvailableRoomCode() {
  const { db: database } = await ensureFirebase();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = createRoomCode();
    const snapshot = await get(ref(database, `rooms/${code}`));
    if (!snapshot.exists()) return code;
  }
  throw new Error('暫時無法產生房號，請再試一次。');
}

function normalizeGameMode(mode) {
  return mode === 'versus' ? 'versus' : 'coop';
}

function normalizeMissionMode(mode) {
  if (mode === 'target' || mode === 'boss') return mode;
  return 'classic';
}

function cleanMoleVisual(moleVisual = {}) {
  const type = moleVisual.type === 'image' ? 'image' : 'emoji';
  const value = String(moleVisual.value || '🐹').slice(0, 260000);
  const label = String(moleVisual.label || '地鼠').slice(0, 30);
  return { type, value, label };
}

function emptyPlayerStats(playerName) {
  return {
    name: playerName,
    score: 0,
    hits: 0,
    misses: 0,
    combo: 0,
    maxCombo: 0,
    bossHits: 0,
    active: true,
    joinedAt: serverTimestamp(),
    lastSeen: serverTimestamp()
  };
}

export async function createRoom({ playerName, level, theme, duration, gameMode = 'coop', missionMode = 'classic', moleVisual }) {
  const { db: database, user } = await ensureFirebase();
  const roomCode = await findAvailableRoomCode();
  const levelConfig = getLevelConfig(level);
  const roomRef = ref(database, `rooms/${roomCode}`);
  const createdAt = now();
  const normalizedGameMode = normalizeGameMode(gameMode);
  const normalizedMissionMode = normalizeMissionMode(missionMode);
  const targetScore = normalizedGameMode === 'coop' && normalizedMissionMode === 'target'
    ? calculateTargetScore({ level: levelConfig.level, duration, playerCount: 1, missionMode: normalizedMissionMode })
    : 0;
  const bossMaxHp = normalizedGameMode === 'coop' && normalizedMissionMode === 'boss'
    ? calculateBossHp({ level: levelConfig.level, playerCount: 1 })
    : 0;

  await set(roomRef, {
    roomCode,
    hostId: user.uid,
    status: 'waiting',
    gameMode: normalizedGameMode,
    missionMode: normalizedMissionMode,
    teamScore: 0,
    targetScore,
    bossHp: bossMaxHp,
    bossMaxHp,
    bossDefeated: false,
    completed: false,
    endReason: '',
    level: levelConfig.level,
    theme,
    duration: Number(duration),
    boardSize: levelConfig.boardSize,
    currentMole: -1,
    moleKey: '',
    moleType: 'normal',
    moleValue: 1,
    moleSequence: 0,
    lastHitMoleKey: '',
    lastHitBy: '',
    moleVisual: cleanMoleVisual(moleVisual),
    hitClaims: {},
    startedAt: 0,
    endsAt: 0,
    createdAt,
    expiresAt: createdAt + ROOM_TTL_MS,
    updatedAt: serverTimestamp(),
    players: {
      [user.uid]: emptyPlayerStats(playerName)
    }
  });

  onDisconnect(ref(database, `rooms/${roomCode}/players/${user.uid}/active`)).set(false);
  onDisconnect(ref(database, `rooms/${roomCode}/players/${user.uid}/lastSeen`)).set(serverTimestamp());

  return { roomCode, uid: user.uid };
}

export async function joinRoom({ roomCode, playerName }) {
  const { db: database, user } = await ensureFirebase();
  const normalizedCode = String(roomCode || '').trim().toUpperCase();
  if (!normalizedCode) throw new Error('請輸入房號。');

  const roomRef = ref(database, `rooms/${normalizedCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) throw new Error('找不到這個房間，請確認房號是否正確。');
  const room = snapshot.val();
  if (room.expiresAt && Number(room.expiresAt) <= now()) {
    await cleanupExpiredRoomIfNeeded(normalizedCode, room);
    throw new Error('這個房間已過期，請房主重新建立房間。');
  }

  await set(ref(database, `rooms/${normalizedCode}/players/${user.uid}`), emptyPlayerStats(playerName));

  onDisconnect(ref(database, `rooms/${normalizedCode}/players/${user.uid}/active`)).set(false);
  onDisconnect(ref(database, `rooms/${normalizedCode}/players/${user.uid}/lastSeen`)).set(serverTimestamp());

  return { roomCode: normalizedCode, uid: user.uid };
}

export async function leaveRoom(roomCode) {
  const { db: database, user } = await ensureFirebase();
  if (!roomCode) return;
  await update(ref(database, `rooms/${roomCode}/players/${user.uid}`), {
    active: false,
    lastSeen: serverTimestamp()
  });
}

export async function startRoomGame({ roomCode, level, theme, duration, gameMode, missionMode, moleVisual }) {
  const { db: database, user } = await ensureFirebase();
  const roomSnapshot = await get(ref(database, `rooms/${roomCode}`));
  if (!roomSnapshot.exists()) throw new Error('房間不存在。');
  const room = roomSnapshot.val();
  if (room.hostId !== user.uid) throw new Error('只有房主可以開始遊戲。');

  const levelConfig = getLevelConfig(level || room.level);
  const normalizedGameMode = normalizeGameMode(gameMode || room.gameMode);
  const normalizedMissionMode = normalizeMissionMode(missionMode || room.missionMode);
  const start = now() + 1200;
  const end = start + Number(duration || room.duration || 45) * 1000;
  const players = room.players || {};
  const playerCount = Math.max(1, Object.keys(players).length);
  const resetStats = {};

  Object.keys(players).forEach(uid => {
    resetStats[`players/${uid}/score`] = 0;
    resetStats[`players/${uid}/hits`] = 0;
    resetStats[`players/${uid}/misses`] = 0;
    resetStats[`players/${uid}/combo`] = 0;
    resetStats[`players/${uid}/maxCombo`] = 0;
    resetStats[`players/${uid}/bossHits`] = 0;
  });

  const targetScore = normalizedGameMode === 'coop' && normalizedMissionMode === 'target'
    ? calculateTargetScore({ level: levelConfig.level, duration: Number(duration || room.duration || 45), playerCount, missionMode: normalizedMissionMode })
    : 0;
  const bossMaxHp = normalizedGameMode === 'coop' && normalizedMissionMode === 'boss'
    ? calculateBossHp({ level: levelConfig.level, playerCount })
    : 0;

  await update(ref(database, `rooms/${roomCode}`), {
    ...resetStats,
    status: 'playing',
    gameMode: normalizedGameMode,
    missionMode: normalizedMissionMode,
    teamScore: 0,
    targetScore,
    bossHp: bossMaxHp,
    bossMaxHp,
    bossDefeated: false,
    completed: false,
    endReason: '',
    level: levelConfig.level,
    theme: theme || room.theme || 'ocean',
    duration: Number(duration || room.duration || 45),
    boardSize: levelConfig.boardSize,
    currentMole: -1,
    moleKey: '',
    moleType: 'normal',
    moleValue: 1,
    moleSequence: 0,
    lastHitMoleKey: '',
    lastHitBy: '',
    moleVisual: cleanMoleVisual(moleVisual || room.moleVisual),
    hitClaims: null,
    startedAt: start,
    endsAt: end,
    expiresAt: now() + ROOM_TTL_MS,
    updatedAt: serverTimestamp()
  });
}

export async function endRoomGame(roomCode, options = {}) {
  const { db: database, user } = await ensureFirebase();
  const snapshot = await get(ref(database, `rooms/${roomCode}/hostId`));
  if (snapshot.val() !== user.uid) return;
  await update(ref(database, `rooms/${roomCode}`), {
    status: 'ended',
    currentMole: -1,
    moleKey: '',
    completed: Boolean(options.completed),
    endReason: String(options.reason || ''),
    updatedAt: serverTimestamp()
  });
}

export async function publishMole({ roomCode, index, moleKey, moleType = 'normal', moleValue = 1, moleSequence = 0, bossHp = 0, bossMaxHp = 0 }) {
  const { db: database, user } = await ensureFirebase();
  const hostSnapshot = await get(ref(database, `rooms/${roomCode}/hostId`));
  if (hostSnapshot.val() !== user.uid) return;

  const patch = {
    currentMole: index,
    moleKey,
    moleType: getMoleType(moleType).id,
    moleValue: Number(moleValue),
    moleSequence: Number(moleSequence),
    lastHitMoleKey: '',
    lastHitBy: '',
    updatedAt: serverTimestamp()
  };

  if (moleType === 'boss') {
    patch.bossHp = Number(bossHp || bossMaxHp || 1);
    patch.bossMaxHp = Number(bossMaxHp || bossHp || 1);
    patch.bossDefeated = false;
  }

  await update(ref(database, `rooms/${roomCode}`), patch);
}

function mutatePlayerStats(player, { scoreDelta = 0, hit = false, miss = false, bossHit = false } = {}) {
  if (!player) return player;
  const nextScore = Math.max(0, Number(player.score || 0) + Number(scoreDelta || 0));
  const hits = Number(player.hits || 0) + (hit ? 1 : 0);
  const misses = Number(player.misses || 0) + (miss ? 1 : 0);
  const combo = miss || scoreDelta < 0 ? 0 : Number(player.combo || 0) + (hit ? 1 : 0);
  const maxCombo = Math.max(Number(player.maxCombo || 0), combo);
  const bossHits = Number(player.bossHits || 0) + (bossHit ? 1 : 0);

  return {
    ...player,
    score: nextScore,
    hits,
    misses,
    combo,
    maxCombo,
    bossHits,
    active: true,
    lastSeen: Date.now()
  };
}

async function updateMyStats(roomCode, options) {
  const { db: database, user } = await ensureFirebase();
  const playerRef = ref(database, `rooms/${roomCode}/players/${user.uid}`);
  await runTransaction(playerRef, player => mutatePlayerStats(player, options));
}

async function updateTeamScore(roomCode, delta) {
  const { db: database } = await ensureFirebase();
  if (!delta) return;
  await runTransaction(ref(database, `rooms/${roomCode}/teamScore`), score => Math.max(0, Number(score || 0) + Number(delta || 0)));
}

export async function applyPlayerHit({ roomCode, moleKey, moleType = 'normal', scoreDelta = 1 }) {
  const { db: database, user } = await ensureFirebase();
  const type = getMoleType(moleType);
  const isBomb = type.id === 'bomb';
  await updateMyStats(roomCode, {
    scoreDelta,
    hit: !isBomb,
    miss: isBomb
  });
  await update(ref(database, `rooms/${roomCode}`), {
    lastHitMoleKey: String(moleKey || ''),
    lastHitBy: user.uid,
    updatedAt: serverTimestamp()
  });
  if (type.extraTimeMs) await addRoomTime(roomCode, type.extraTimeMs);
}

export async function recordPlayerMiss(roomCode) {
  if (!roomCode) return;
  await updateMyStats(roomCode, { scoreDelta: 0, hit: false, miss: true });
}

export async function claimCoopHit({ roomCode, moleKey, moleType = 'normal', scoreDelta = 1 }) {
  const { db: database, user } = await ensureFirebase();
  if (!roomCode || !moleKey) return false;

  const type = getMoleType(moleType);
  const claimRef = ref(database, `rooms/${roomCode}/hitClaims/${moleKey}`);
  const claimResult = await runTransaction(claimRef, current => {
    if (current) return;
    return {
      by: user.uid,
      at: now(),
      type: type.id
    };
  });

  if (!claimResult.committed) return false;

  const isBomb = type.id === 'bomb';
  await Promise.all([
    updateTeamScore(roomCode, scoreDelta),
    updateMyStats(roomCode, {
      scoreDelta,
      hit: !isBomb,
      miss: isBomb
    }),
    update(ref(database, `rooms/${roomCode}`), {
      lastHitMoleKey: moleKey,
      lastHitBy: user.uid,
      updatedAt: serverTimestamp()
    })
  ]);

  if (type.extraTimeMs) await addRoomTime(roomCode, type.extraTimeMs);
  return true;
}

export async function claimBossHit({ roomCode, moleKey }) {
  const { db: database, user } = await ensureFirebase();
  if (!roomCode || !moleKey) return { committed: false, defeated: false, hp: 0 };

  const hpRef = ref(database, `rooms/${roomCode}/bossHp`);
  const hpResult = await runTransaction(hpRef, hp => {
    const current = Number(hp || 0);
    if (current <= 0) return;
    return current - 1;
  });

  if (!hpResult.committed) return { committed: false, defeated: false, hp: 0 };
  const hp = Number(hpResult.snapshot.val() || 0);

  await Promise.all([
    updateTeamScore(roomCode, 2),
    updateMyStats(roomCode, { scoreDelta: 2, hit: true, bossHit: true }),
    update(ref(database, `rooms/${roomCode}`), {
      lastHitBy: user.uid,
      updatedAt: serverTimestamp()
    })
  ]);

  return { committed: true, defeated: hp <= 0, hp };
}

export async function addRoomTime(roomCode, extraMs) {
  const { db: database } = await ensureFirebase();
  await runTransaction(ref(database, `rooms/${roomCode}/endsAt`), endsAt => Number(endsAt || 0) + Number(extraMs || 0));
}

export async function touchMyPresence(roomCode) {
  const { db: database, user } = await ensureFirebase();
  await update(ref(database, `rooms/${roomCode}/players/${user.uid}`), {
    active: true,
    lastSeen: serverTimestamp()
  });
}

export async function getUid() {
  const { user } = await ensureFirebase();
  return user.uid;
}

export async function subscribeRoom(roomCode, callback) {
  const { db: database } = await ensureFirebase();
  const roomRef = ref(database, `rooms/${roomCode}`);
  return onValue(roomRef, async snapshot => {
    const room = snapshot.val();
    if (room && room.expiresAt && Number(room.expiresAt) <= now()) {
      try {
        await cleanupExpiredRoomIfNeeded(roomCode, room);
      } catch {
        // Another client may already be cleaning it up.
      }
      callback(null);
      return;
    }
    callback(room);
  });
}

export async function cleanupOldRoom(roomCode) {
  const { db: database, user } = await ensureFirebase();
  const snapshot = await get(ref(database, `rooms/${roomCode}`));
  if (!snapshot.exists()) return;
  const room = snapshot.val();
  if (room.hostId === user.uid && room.status === 'ended') {
    await remove(ref(database, `rooms/${roomCode}`));
  }
}

export async function removeExpiredRoom(roomCode) {
  const { db: database } = await ensureFirebase();
  const snapshot = await get(ref(database, `rooms/${roomCode}`));
  if (!snapshot.exists()) return false;
  const room = snapshot.val();
  if (!room.expiresAt || Number(room.expiresAt) > now()) return false;
  await remove(ref(database, `rooms/${roomCode}`));
  return true;
}
