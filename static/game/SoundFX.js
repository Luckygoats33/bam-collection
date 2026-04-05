/**
 * SoundFX.js — Double Dribble-style 8-bit basketball sound effects
 * Uses Web Audio API procedurally. No audio files required.
 */

const SoundFX = (() => {
  let ctx = null;
  let muted = false;

  // Create AudioContext on first user interaction (browser requirement)
  function init() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  // --- Helpers ---

  // Play a simple oscillator with attack/decay envelope
  function playTone(freq, type, startTime, duration, peakGain = 0.4) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  // Play a frequency-modulated tone (for vibrato / wobble)
  function playVibratoTone(freq, vibratoRate, vibratoDepth, type, startTime, duration, peakGain = 0.35) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(vibratoRate, startTime);
    lfoGain.gain.setValueAtTime(vibratoDepth, startTime);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    lfo.start(startTime);
    lfo.stop(startTime + duration + 0.01);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  // Generate a white noise burst via a buffer source
  function playNoise(startTime, duration, peakGain = 0.3, filterFreq = null) {
    if (!ctx) return;
    const bufferSize = Math.ceil(ctx.sampleRate * (duration + 0.02));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    if (filterFreq !== null) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(filterFreq, startTime);
      filter.Q.setValueAtTime(1.5, startTime);
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    gain.connect(ctx.destination);
    source.start(startTime);
    source.stop(startTime + duration + 0.02);
  }

  // --- Sound Effects ---

  /**
   * bounce() — ball dribble bounce
   * Short low-pitch blip ~100hz, 50ms
   */
  function bounce() {
    if (muted || !ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.05);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /**
   * swish() — basket made
   * Ascending arpeggio, 3 quick notes going up, cheerful
   */
  function swish() {
    if (muted || !ctx) return;
    const t = ctx.currentTime;
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      playTone(freq, 'square', t + i * 0.07, 0.12, 0.3);
    });
  }

  /**
   * brick() — missed shot hitting rim
   * Short harsh noise burst, 80ms
   */
  function brick() {
    if (muted || !ctx) return;
    const t = ctx.currentTime;
    // Low thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
    // Add noise crunch layer
    playNoise(t, 0.08, 0.2, 300);
  }

  /**
   * whistle() — referee whistle
   * High pitch ~800hz, 300ms, slight vibrato
   */
  function whistle() {
    if (muted || !ctx) return;
    const t = ctx.currentTime;
    playVibratoTone(820, 18, 25, 'sine', t, 0.3, 0.4);
  }

  /**
   * buzzer() — quarter/game buzzer
   * Loud low tone ~200hz, 500ms
   */
  function buzzer() {
    if (muted || !ctx) return;
    const t = ctx.currentTime;
    playTone(200, 'square', t, 0.5, 0.6);
    // Add a slight harmonic for that buzzer harshness
    playTone(202, 'sawtooth', t, 0.5, 0.15);
  }

  /**
   * steal() — steal/turnover
   * Quick descending 2-note, ~150ms
   */
  function steal() {
    if (muted || !ctx) return;
    const t = ctx.currentTime;
    playTone(600, 'square', t, 0.08, 0.35);
    playTone(350, 'square', t + 0.08, 0.08, 0.3);
  }

  /**
   * pass() — ball pass whoosh
   * White noise filtered, very short 30ms
   */
  function pass() {
    if (muted || !ctx) return;
    const t = ctx.currentTime;
    const bufferSize = Math.ceil(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(3000, t + 0.03);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(t);
    source.stop(t + 0.05);
  }

  /**
   * crowd() — crowd cheer on score
   * Filtered noise swell, 400ms
   */
  function crowd() {
    if (muted || !ctx) return;
    const t = ctx.currentTime;
    const bufferSize = Math.ceil(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.Q.setValueAtTime(0.5, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.1);   // swell up
    gain.gain.linearRampToValueAtTime(0.35, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(t);
    source.stop(t + 0.5);
  }

  /**
   * menuSelect() — menu selection blip
   * Short high tone ~600hz, 40ms
   */
  function menuSelect() {
    if (muted || !ctx) return;
    const t = ctx.currentTime;
    playTone(660, 'square', t, 0.04, 0.35);
  }

  // Public API
  return {
    init,
    toggleMute,
    get muted() { return muted; },
    bounce,
    swish,
    brick,
    whistle,
    buzzer,
    steal,
    pass,
    crowd,
    menuSelect,
  };
})();

// Export for module environments; also works as a plain script global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SoundFX;
}
