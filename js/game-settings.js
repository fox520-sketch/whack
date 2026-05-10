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

export const MOLE_VISUALS = [
  { id: 'hamster', label: '經典地鼠', emoji: '🐹' },
  { id: 'otter', label: '小水獺', emoji: '🦦' },
  { id: 'octopus', label: '章魚', emoji: '🐙' },
  { id: 'crab', label: '螃蟹', emoji: '🦀' },
  { id: 'puffer', label: '河豚', emoji: '🐡' },
  { id: 'seal', label: '海豹', emoji: '🦭' },
  { id: 'dolphin', label: '海豚', emoji: '🐬' },
  { id: 'shark', label: '鯊魚', emoji: '🦈' },
  { id: 'turtle', label: '海龜', emoji: '🐢' },
  { id: 'jellyfish', label: '水母', emoji: '🪼' },
  { id: 'starfish', label: '海星', emoji: '⭐' },
  { id: 'robot', label: '機器地鼠', emoji: '🤖' },
  { id: 'ghost', label: '幽靈地鼠', emoji: '👻' },
  { id: 'custom', label: '自訂上傳圖片', emoji: '🖼️' }
];

export const HIT_SOUND_PRESETS = [
  { id: 'sparkle', label: '清脆泡泡' },
  { id: 'coin', label: '得分金幣' },
  { id: 'pop', label: '彈跳 Pop' },
  { id: 'voice-hit', label: '語音：打到了' },
  { id: 'custom-hit', label: '自訂打中音效' }
];

export const MISS_SOUND_PRESETS = [
  { id: 'soft-buzz', label: '低音喔喔' },
  { id: 'bubble-down', label: '泡泡下沉' },
  { id: 'wood', label: '木魚敲空' },
  { id: 'voice-miss', label: '語音：喔喔' },
  { id: 'custom-miss', label: '自訂沒打中音效' }
];

export const MISSION_MODES = [
  { id: 'classic', label: '一般模式', description: '自由打地鼠，結束後統計分數與命中率。' },
  { id: 'target', label: '合作任務：限時達標', description: '合作模式共同達到目標分數就任務成功。' },
  { id: 'boss', label: '合作任務：Boss 地鼠', description: '合作模式會出現 Boss 地鼠，需要多人連打削減血量。' }
];

export const MOLE_TYPES = {
  normal: { id: 'normal', label: '普通', emoji: '', score: 1, pop: '+1' },
  golden: { id: 'golden', label: '黃金地鼠', emoji: '✨', score: 5, pop: '+5' },
  bomb: { id: 'bomb', label: '炸彈地鼠', emoji: '💣', score: -3, pop: '-3' },
  heart: { id: 'heart', label: '愛心地鼠', emoji: '💗', score: 1, extraTimeMs: 3000, pop: '+3秒' },
  boss: { id: 'boss', label: 'Boss 地鼠', emoji: '👑', score: 2, pop: '-1HP' }
};

export function getLevelConfig(level) {
  const normalized = Math.min(20, Math.max(1, Number(level) || 1));
  const intervalMs = Math.round(980 - (normalized - 1) * 34);
  const visibleMs = Math.round(820 - (normalized - 1) * 24);
  const boardSize = normalized >= 15 ? 16 : normalized >= 8 ? 12 : 9;
  const specialChance = Math.min(0.32, 0.08 + normalized * 0.009);

  return {
    level: normalized,
    intervalMs: Math.max(330, intervalMs),
    visibleMs: Math.max(300, visibleMs),
    boardSize,
    specialChance,
    label: getLevelLabel(normalized)
  };
}

function getLevelLabel(level) {
  if (level <= 3) return '輕鬆暖身，地鼠速度較慢。';
  if (level <= 7) return '普通速度，適合熟悉節奏。';
  if (level <= 12) return '反應挑戰，洞口變多，特殊地鼠會更常出現。';
  if (level <= 16) return '高手節奏，地鼠很快消失，炸彈也更常見。';
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

export function pickMoleType({ level = 1, missionMode = 'classic', sequence = 0 } = {}) {
  const config = getLevelConfig(level);
  if (missionMode === 'boss' && sequence > 0 && sequence % 5 === 0) return MOLE_TYPES.boss;

  const roll = Math.random();
  if (roll > config.specialChance) return MOLE_TYPES.normal;

  const bombChance = Math.min(0.34, 0.1 + level * 0.008);
  const goldenChance = 0.42;
  const specialRoll = Math.random();
  if (specialRoll < bombChance) return MOLE_TYPES.bomb;
  if (specialRoll < bombChance + goldenChance) return MOLE_TYPES.golden;
  return MOLE_TYPES.heart;
}

export function getMoleType(typeId = 'normal') {
  return MOLE_TYPES[typeId] || MOLE_TYPES.normal;
}

export function calculateTargetScore({ level = 1, duration = 45, playerCount = 1, missionMode = 'classic' } = {}) {
  if (missionMode === 'boss') return 0;
  const base = Math.round((Number(duration) || 45) * (0.54 + Number(level) * 0.018));
  const playerBonus = Math.max(0, (Number(playerCount) || 1) - 1) * Math.round((Number(duration) || 45) * 0.16);
  return Math.max(18, base + playerBonus);
}

export function calculateBossHp({ level = 1, playerCount = 1 } = {}) {
  return Math.max(8, Math.round(8 + Number(level) * 0.9 + Math.max(0, Number(playerCount) - 1) * 5));
}

export function getBuiltInMole(id) {
  return MOLE_VISUALS.find(item => item.id === id && item.id !== 'custom') || MOLE_VISUALS[0];
}

export function now() {
  return Date.now();
}
