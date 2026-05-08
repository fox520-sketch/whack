let ctx = null;
let enabled = true;

function getContext() {
  if (!ctx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) ctx = new AudioContextClass();
  }
  if (ctx?.state === 'suspended') ctx.resume();
  return ctx;
}

function beep({ frequency = 440, duration = 0.08, type = 'sine', gain = 0.08, slideTo = null }) {
  if (!enabled) return;
  const audio = getContext();
  if (!audio) return;

  const osc = audio.createOscillator();
  const amp = audio.createGain();
  const start = audio.currentTime;
  const end = start + duration;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, end);

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(amp).connect(audio.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

export const Sound = {
  setEnabled(value) {
    enabled = Boolean(value);
  },
  isEnabled() {
    return enabled;
  },
  click() {
    beep({ frequency: 520, duration: 0.05, type: 'triangle', gain: 0.05 });
  },
  hit() {
    beep({ frequency: 620, slideTo: 920, duration: 0.09, type: 'sine', gain: 0.1 });
    setTimeout(() => beep({ frequency: 980, duration: 0.07, type: 'triangle', gain: 0.06 }), 45);
  },
  miss() {
    beep({ frequency: 180, slideTo: 120, duration: 0.1, type: 'sawtooth', gain: 0.035 });
  },
  start() {
    beep({ frequency: 360, duration: 0.06, type: 'sine', gain: 0.05 });
    setTimeout(() => beep({ frequency: 540, duration: 0.07, type: 'sine', gain: 0.06 }), 70);
    setTimeout(() => beep({ frequency: 760, duration: 0.08, type: 'sine', gain: 0.07 }), 150);
  },
  end() {
    beep({ frequency: 700, duration: 0.08, type: 'triangle', gain: 0.06 });
    setTimeout(() => beep({ frequency: 460, duration: 0.12, type: 'triangle', gain: 0.05 }), 100);
  }
};
