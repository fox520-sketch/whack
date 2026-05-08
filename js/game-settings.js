export const THEMES = [
  { id: 'ocean', label: '海洋風', emoji: '🌊' },
  { id: 'eye', label: '護眼風', emoji: '🍃' },
  { id: 'paper', label: '電子紙風', emoji: '📖' },
  { id: 'twilight', label: '暮光風', emoji: '🌆' },
  { id: 'sakura', label: '櫻花風', emoji: '🌸' },
  { id: 'forest', label: '森林風', emoji: '🌲' },
  { id: 'sunset', label: '夕陽風', emoji: '🌅' },
  { id: 'star', label: '星空風', emoji: '✨' },
  { id: 'candy', label: '糖果風', emoji: '🍬' },
  { id: 'neon', label: '霓虹風', emoji: '⚡' }
];

export function getLevelConfig(level) {
  const normalized = Math.min(20, Math.max(1, Number(level) || 1));
  const intervalMs = Math.round(980 - (normalized - 1) * 34);
  const visibleMs = Math.round(820 - (normalized - 1) * 24);
  const boardSize = normalized >= 15 ? 16 : normalized >= 8 ? 12 : 9;
  const bonusChance = normalized >= 12 ? 0.12 : normalized >= 6 ? 0.08 : 0.04;

  return {
    level: normalized,
    intervalMs: Math.max(330, intervalMs),
    visibleMs: Math.max(300, visibleMs),
    boardSize,
    bonusChance,
    label: getLevelLabel(normalized)
  };
}

function getLevelLabel(level) {
  if (level <= 3) return '輕鬆暖身，地鼠速度較慢。';
  if (level <= 7) return '普通速度，適合熟悉節奏。';
  if (level <= 12) return '反應挑戰，洞口變多。';
  if (level <= 16) return '高手節奏，地鼠很快消失。';
  return '極限挑戰，建議用雙手或大螢幕。';
}

export function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function clampName(name) {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
  return trimmed.slice(0, 16) || `玩家${Math.floor(Math.random() * 900 + 100)}`;
}

export function pickRandomHole(boardSize, previousIndex = -1) {
  if (boardSize <= 1) return 0;
  let next = Math.floor(Math.random() * boardSize);
  if (next === previousIndex) next = (next + 1) % boardSize;
  return next;
}

export function now() {
  return Date.now();
}
