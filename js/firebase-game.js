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
import { createRoomCode, getLevelConfig, now } from './game-settings.js';

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

function cleanMoleVisual(moleVisual = {}) {
  const type = moleVisual.type === 'image' ? 'image' : 'emoji';
  const value = String(moleVisual.value || '🐹').slice(0, 260000);
  const label = String(moleVisual.label || '地鼠').slice(0, 30);
  return { type, value, label };
}

export async function createRoom({ playerName, level, theme, duration, gameMode = 'coop', moleVisual }) {
  const { db: database, user } = await ensureFirebase();
  const roomCode = await findAvailableRoomCode();
  const levelConfig = getLevelConfig(level);
  const roomRef = ref(database, `rooms/${roomCode}`);

  await set(roomRef, {
    roomCode,
    hostId: user.uid,
    status: 'waiting',
    gameMode: normalizeGameMode(gameMode),
    teamScore: 0,
    level: levelConfig.level,
    theme,
    duration: Number(duration),
    boardSize: levelConfig.boardSize,
    currentMole: -1,
    moleKey: '',
    lastHitMoleKey: '',
    lastHitBy: '',
    moleVisual: cleanMoleVisual(moleVisual),
    hitClaims: {},
    startedAt: 0,
    endsAt: 0,
    updatedAt: serverTimestamp(),
    players: {
      [user.uid]: {
        name: playerName,
        score: 0,
        active: true,
        joinedAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      }
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

  await set(ref(database, `rooms/${normalizedCode}/players/${user.uid}`), {
    name: playerName,
    score: 0,
    active: true,
    joinedAt: serverTimestamp(),
    lastSeen: serverTimestamp()
  });

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

export async function startRoomGame({ roomCode, level, theme, duration, gameMode, moleVisual }) {
  const { db: database, user } = await ensureFirebase();
  const roomSnapshot = await get(ref(database, `rooms/${roomCode}`));
  if (!roomSnapshot.exists()) throw new Error('房間不存在。');
  const room = roomSnapshot.val();
  if (room.hostId !== user.uid) throw new Error('只有房主可以開始遊戲。');

  const levelConfig = getLevelConfig(level || room.level);
  const start = now() + 1200;
  const end = start + Number(duration || room.duration || 45) * 1000;
  const players = room.players || {};
  const resetScores = {};

  Object.keys(players).forEach(uid => {
    resetScores[`players/${uid}/score`] = 0;
  });

  await update(ref(database, `rooms/${roomCode}`), {
    ...resetScores,
    status: 'playing',
    gameMode: normalizeGameMode(gameMode || room.gameMode),
    teamScore: 0,
    level: levelConfig.level,
    theme: theme || room.theme || 'ocean',
    duration: Number(duration || room.duration || 45),
    boardSize: levelConfig.boardSize,
    currentMole: -1,
    moleKey: '',
    lastHitMoleKey: '',
    lastHitBy: '',
    moleVisual: cleanMoleVisual(moleVisual || room.moleVisual),
    hitClaims: null,
    startedAt: start,
    endsAt: end,
    updatedAt: serverTimestamp()
  });
}

export async function endRoomGame(roomCode) {
  const { db: database, user } = await ensureFirebase();
  const snapshot = await get(ref(database, `rooms/${roomCode}/hostId`));
  if (snapshot.val() !== user.uid) return;
  await update(ref(database, `rooms/${roomCode}`), {
    status: 'ended',
    currentMole: -1,
    moleKey: '',
    updatedAt: serverTimestamp()
  });
}

export async function publishMole({ roomCode, index, moleKey }) {
  const { db: database, user } = await ensureFirebase();
  const hostSnapshot = await get(ref(database, `rooms/${roomCode}/hostId`));
  if (hostSnapshot.val() !== user.uid) return;

  await update(ref(database, `rooms/${roomCode}`), {
    currentMole: index,
    moleKey,
    updatedAt: serverTimestamp()
  });
}

export async function incrementMyScore(roomCode) {
  const { db: database, user } = await ensureFirebase();
  const scoreRef = ref(database, `rooms/${roomCode}/players/${user.uid}/score`);
  await runTransaction(scoreRef, currentScore => (Number(currentScore) || 0) + 1);
  await update(ref(database, `rooms/${roomCode}/players/${user.uid}`), {
    lastSeen: serverTimestamp(),
    active: true
  });
}

export async function claimCoopHit({ roomCode, moleKey }) {
  const { db: database, user } = await ensureFirebase();
  if (!roomCode || !moleKey) return false;

  const claimRef = ref(database, `rooms/${roomCode}/hitClaims/${moleKey}`);
  const claimResult = await runTransaction(claimRef, current => {
    if (current) return;
    return {
      by: user.uid,
      at: now()
    };
  });

  if (!claimResult.committed) return false;

  await Promise.all([
    runTransaction(ref(database, `rooms/${roomCode}/teamScore`), score => (Number(score) || 0) + 1),
    runTransaction(ref(database, `rooms/${roomCode}/players/${user.uid}/score`), score => (Number(score) || 0) + 1),
    update(ref(database, `rooms/${roomCode}`), {
      lastHitMoleKey: moleKey,
      lastHitBy: user.uid,
      updatedAt: serverTimestamp()
    }),
    update(ref(database, `rooms/${roomCode}/players/${user.uid}`), {
      lastSeen: serverTimestamp(),
      active: true
    })
  ]);

  return true;
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
  return onValue(roomRef, snapshot => callback(snapshot.val()));
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
