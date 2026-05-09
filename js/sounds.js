let ctx = null;
let enabled = true;
let hitPreset = 'sparkle';
let missPreset = 'soft-buzz';
let customHitSound = '';
let customMissSound = '';

function getContext() {
  if (!ctx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) ctx = new AudioContextClass();
  }
  if (ctx?.state === 'suspended') ctx.resume();
  return ctx;
}

function beep({ frequency = 440, duration = 0.08, type = 'sine', gain = 0.08, slideTo = null, delay = 0 }) {
  if (!enabled) return;
  const audio = getContext();
  if (!audio) return;

  const osc = audio.createOscillator();
  const amp = audio.createGain();
  const start = audio.currentTime + delay;
  const end = start + duration;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), end);

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(amp).connect(audio.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

function playDataUrl(dataUrl) {
  if (!enabled || !dataUrl) return false;
  try {
    const audio = new Audio(dataUrl);
    audio.volume = 0.9;
    audio.play().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function speak(text) {
  if (!enabled || !('speechSynthesis' in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 1.12;
    utterance.pitch = text === '打到了' ? 1.2 : 0.78;
    utterance.volume = 0.95;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

function playHitPreset() {
  switch (hitPreset) {
    case 'coin':
      beep({ frequency: 880, duration: 0.06, type: 'square', gain: 0.045 });
      beep({ frequency: 1320, duration: 0.08, type: 'triangle', gain: 0.05, delay: 0.06 });
      break;
    case 'pop':
      beep({ frequency: 260, slideTo: 720, duration: 0.11, type: 'triangle', gain: 0.08 });
      break;
    case 'voice-hit':
      if (!speak('打到了')) playHitFallback();
      break;
    case 'custom-hit':
      if (!playDataUrl(customHitSound)) playHitFallback();
      break;
    case 'sparkle':
    default:
      playHitFallback();
      break;
  }
}

function playHitFallback() {
  beep({ frequency: 620, slideTo: 920, duration: 0.09, type: 'sine', gain: 0.1 });
  beep({ frequency: 980, duration: 0.07, type: 'triangle', gain: 0.06, delay: 0.045 });
}

function playMissPreset() {
  switch (missPreset) {
    case 'bubble-down':
      beep({ frequency: 420, slideTo: 180, duration: 0.16, type: 'sine', gain: 0.04 });
      break;
    case 'wood':
      beep({ frequency: 220, duration: 0.045, type: 'square', gain: 0.045 });
      beep({ frequency: 160, duration: 0.055, type: 'square', gain: 0.03, delay: 0.05 });
      break;
    case 'voice-miss':
      if (!speak('喔喔')) playMissFallback();
      break;
    case 'custom-miss':
      if (!playDataUrl(customMissSound)) playMissFallback();
      break;
    case 'soft-buzz':
    default:
      playMissFallback();
      break;
  }
}

function playMissFallback() {
  beep({ frequency: 180, slideTo: 120, duration: 0.1, type: 'sawtooth', gain: 0.035 });
}

export const Sound = {
  setEnabled(value) {
    enabled = Boolean(value);
  },
  isEnabled() {
    return enabled;
  },
  setHitPreset(value) {
    hitPreset = value || 'sparkle';
  },
  setMissPreset(value) {
    missPreset = value || 'soft-buzz';
  },
  setCustomHitSound(dataUrl) {
    customHitSound = dataUrl || '';
  },
  setCustomMissSound(dataUrl) {
    customMissSound = dataUrl || '';
  },
  click() {
    beep({ frequency: 520, duration: 0.05, type: 'triangle', gain: 0.05 });
  },
  hit() {
    playHitPreset();
  },
  miss() {
    playMissPreset();
  },
  start() {
    beep({ frequency: 360, duration: 0.06, type: 'sine', gain: 0.05 });
    beep({ frequency: 540, duration: 0.07, type: 'sine', gain: 0.06, delay: 0.07 });
    beep({ frequency: 760, duration: 0.08, type: 'sine', gain: 0.07, delay: 0.15 });
  },
  end() {
    beep({ frequency: 700, duration: 0.08, type: 'triangle', gain: 0.06 });
    beep({ frequency: 460, duration: 0.12, type: 'triangle', gain: 0.05, delay: 0.1 });
  },
  previewHit() {
    playHitPreset();
  },
  previewMiss() {
    playMissPreset();
  }
};
