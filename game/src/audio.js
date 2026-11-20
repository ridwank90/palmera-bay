// Every sound in Palmera Bay, synthesized with WebAudio — no audio files.
// A lazy AudioContext (browsers only allow sound after a gesture), a master
// gain with a mute toggle, one-shot effects, a two-tone police siren and an
// engine hum that follows the car's speed, and a small looped music groove
// (chord pads, a bass line and a sparse lead) scheduled ahead of time.

const MUSIC = {
  bpm: 100,
  // Am – F – C – G, as MIDI notes; the pad holds the chord, the bass walks it.
  chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
  bass: [45, 41, 48, 43],
  lead: [69, 0, 72, 0, 71, 0, 69, 67, 69, 0, 64, 0, 67, 0, 0, 0],
};

function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenStep = 0;
  let sirenTimer = 0;
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return ctx;
  }

  /** Call on the first click or key press: browsers need a gesture for sound. */
  function unlock() {
    ensure();
  }

  function setMuted(value) {
    muted = value;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function tone(freq, dur, type, volume, when = 0, slideTo = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, volume, filterFreq, when = 0, type = 'lowpass') {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(dur + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
    source.stop(t0 + dur + 0.05);
  }

  function gunshot() {
    if (!ensure()) return;
    noise(0.12, 0.5, 1800, 0, 'highpass');
    tone(160, 0.14, 'sine', 0.5, 0, 50);
  }

  function punch() {
    if (!ensure()) return;
    noise(0.09, 0.4, 500);
    tone(110, 0.1, 'sine', 0.35, 0, 60);
  }

  function crash() {
    if (!ensure()) return;
    noise(0.25, 0.5, 900);
    tone(90, 0.25, 'sawtooth', 0.25, 0, 40);
  }

  function pickup() {
    if (!ensure()) return;
    tone(880, 0.09, 'sine', 0.3);
    tone(1318, 0.14, 'sine', 0.3, 0.08);
  }

  function cash() {
    if (!ensure()) return;
    tone(1046, 0.08, 'triangle', 0.3);
    tone(1318, 0.08, 'triangle', 0.3, 0.07);
    tone(1568, 0.16, 'triangle', 0.3, 0.14);
  }

  function missionDone() {
    if (!ensure()) return;
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.32, i * 0.11));
  }

  function missionFail() {
    if (!ensure()) return;
    [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.18, i * 0.16));
  }

  function click() {
    if (!ensure()) return;
    tone(700, 0.05, 'square', 0.12);
  }

  function engineStart() {
    if (!ensure() || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function engineSet(speedNorm, throttle) {
    if (!engineOsc || !ctx) return;
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(55 + speedNorm * 160 + throttle * 30, t, 0.08);
    engineGain.gain.setTargetAtTime(0.05 + speedNorm * 0.07 + throttle * 0.03, t, 0.1);
  }

  function engineStop() {
    if (!engineOsc) return;
    try {
      engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      const osc = engineOsc;
      window.setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 300);
    } catch { /* no context */ }
    engineOsc = null;
    engineGain = null;
    engineFilter = null;
  }

  function sirenSet(nearest) {
    if (!ctx) return;
    if (nearest === null || nearest > 900) {
      if (sirenOsc) {
        try { sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); } catch { /* no context */ }
        const osc = sirenOsc;
        window.setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 400);
        sirenOsc = null;
        sirenGain = null;
      }
      return;
    }
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenStep = 0;
      sirenTimer = 0;
    }
    const volume = Math.max(0, 0.14 * (1 - nearest / 900));
    sirenGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.1);
  }

  /** Called every frame: alternates the siren's two tones. */
  function sirenTick(dt) {
    if (!sirenOsc || !ctx) return;
    sirenTimer -= dt;
    if (sirenTimer <= 0) {
      sirenTimer = 0.42;
      sirenStep = 1 - sirenStep;
      sirenOsc.frequency.setTargetAtTime(sirenStep ? 950 : 700, ctx.currentTime, 0.03);
    }
  }

  function scheduleMusicStep(step, when) {
    const bar = Math.floor(step / 16) % MUSIC.chords.length;
    const beat = step % 16;
    const chord = MUSIC.chords[bar];
    if (beat === 0) {
      for (const note of chord) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = midiToFreq(note);
        const gain = ctx.createGain();
        const barLen = (60 / MUSIC.bpm) * 4;
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(0.05, when + 0.2);
        gain.gain.setTargetAtTime(0.0001, when + barLen * 0.9, 0.3);
        osc.connect(gain);
        gain.connect(master);
        osc.start(when);
        osc.stop(when + barLen + 0.2);
      }
    }
    if (beat % 2 === 0) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = midiToFreq(MUSIC.bass[bar]);
      const gain = ctx.createGain();
      const eighth = 60 / MUSIC.bpm / 2;
      gain.gain.setValueAtTime(0.11, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + eighth * 0.95);
      osc.connect(gain);
      gain.connect(master);
      osc.start(when);
      osc.stop(when + eighth);
    }
    const lead = MUSIC.lead[beat];
    if (lead > 0) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = midiToFreq(lead);
      const gain = ctx.createGain();
      const eighth = 60 / MUSIC.bpm / 2;
      gain.gain.setValueAtTime(0.035, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + eighth * 0.9);
      osc.connect(gain);
      gain.connect(master);
      osc.start(when);
      osc.stop(when + eighth);
    }
  }

  function musicStart() {
    if (!ensure() || musicTimer) return;
    musicStep = 0;
    nextNoteTime = ctx.currentTime + 0.1;
    const eighth = 60 / MUSIC.bpm / 2;
    musicTimer = window.setInterval(() => {
      if (!ctx) return;
      while (nextNoteTime < ctx.currentTime + 0.25) {
        scheduleMusicStep(musicStep, nextNoteTime);
        musicStep += 1;
        nextNoteTime += eighth;
      }
    }, 100);
  }

  function musicStop() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    unlock, setMuted, isMuted,
    gunshot, punch, crash, pickup, cash, missionDone, missionFail, click,
    engineStart, engineSet, engineStop,
    sirenSet, sirenTick,
    musicStart, musicStop,
  };
}
