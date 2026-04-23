// =====================================================
// Hurricane Sonification Engine using Tone.js
// =====================================================

// --- Audio graph (bus & FX) ---
const master = new Tone.Gain().toDestination();
const mainLPF = new Tone.Filter({ type: 'lowpass', frequency: 8000, Q: 0.7 }).connect(master);
const mainHPF = new Tone.Filter({ type: 'highpass', frequency: 50, Q: 0.7 }).connect(mainLPF);
const panBus = new Tone.Panner(0).connect(mainHPF);
const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.15 }).connect(panBus);

// --- Sonification state ---
const sonificationState = {
  isPlaying: false,
  autoPlay: true,
  sequenceLoop: null,
  currentIndex: 0,
  previousCategory: null, // Track previous category for TTS
  // Sound layer toggles
  enableStrings: true,    // Pressure → Low drone
  enableWoodwinds: true,  // Wind speed → Flute-like notes
  enableBrass: true,      // Category → Warning motifs
  enableSpatial: true,    // Position → Panning & filtering
  enableTTS: true         // Text-to-speech category announcements
};

// --- Helper functions (converted from wind in knots to mph) ---
function deriveCategoryFromWind(windKnots) {
  const windMph = windKnots * 1.15078;
  if (windMph >= 157) return 5;
  if (windMph >= 130) return 4;
  if (windMph >= 111) return 3;
  if (windMph >= 96) return 2;
  if (windMph >= 74) return 1;
  return 0;
}

function panFromLon(lon) {
  const min = -100, max = -60;
  const t = Math.max(0, Math.min(1, (lon - min) / (max - min)));
  return t * 2 - 1;
}

function hpfFromLat(lat) {
  const min = 5, max = 45;
  const t = Math.max(0, Math.min(1, (lat - min) / (max - min)));
  return 50 + t * (1500 - 50);
}

function stringPitchFromPressure(pressure) {
  const p = isFinite(pressure) ? pressure : 1015;
  const t = Math.max(0, Math.min(1, (1020 - p) / 100));
  return 110 - t * 55; // 110..55 Hz
}

function woodwindNoteCount(windKnots) {
  const windMph = windKnots * 1.15078;
  const w = Math.max(0, Math.min(160, isFinite(windMph) ? windMph : 0));
  return Math.round(2 + (w / 160) * 14);
}

function woodwindGain(windKnots) {
  const windMph = windKnots * 1.15078;
  const w = Math.max(0, Math.min(160, isFinite(windMph) ? windMph : 0));
  return 0.15 + (w / 160) * 0.6; // 0.15 .. 0.75
}

const brassMotifs = {
  0: [0],
  1: [0],
  2: [0, 7],
  3: [0, 3, 7],
  4: [0, 2, 5, 7],
  5: [0, 2, 3, 6, 10]
};

function brassVolume(cat) {
  return Math.min(1, 0.3 + (cat * 0.14));
}

function pressureToBrightness(pressure) {
  const p = isFinite(pressure) ? pressure : 1015;
  const delta = Math.max(0, 1015 - p);
  const gain = Math.min(1, delta / 40);
  return gain;
}

// --- Text-to-speech for category changes ---
function speakCategory(category) {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance();
    
    // Construct the message based on category
    let message = '';
    if (category === 5) {
      message = 'Category 5 Hurricane';
    } else if (category === 4) {
      message = 'Category 4 Hurricane';
    } else if (category === 3) {
      message = 'Category 3 Hurricane';
    } else if (category === 2) {
      message = 'Category 2 Hurricane';
    } else if (category === 1) {
      message = 'Category 1 Hurricane';
    } else {
      message = 'Tropical Storm';
    }
    
    utterance.text = message;
    utterance.rate = 2.0;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    
    window.speechSynthesis.speak(utterance);
  }
}

// --- Voice synthesis functions ---
function playStrings(pressure, dur) {
  if (!isFinite(pressure)) return;

  const baseFreq = stringPitchFromPressure(pressure);
  const loud = pressureToBrightness(pressure);

  const env = new Tone.AmplitudeEnvelope({
    attack: 0.05,
    decay: 0.4,
    sustain: Math.min(0.9, 0.3 + loud),
    release: 0.3
  }).connect(panBus);

  const filt = new Tone.Filter({
    type: 'lowpass',
    frequency: 1200,
    Q: 0.4
  }).connect(env);

  const osc = new Tone.Oscillator({
    frequency: baseFreq,
    type: 'sawtooth'
  }).connect(filt);

  osc.start();
  env.triggerAttackRelease(dur * 0.95);

  // Extra growl for pressure < 950
  if (pressure < 950) {
    const detuneSemis = 1.5;
    const freq2 = baseFreq * Math.pow(2, detuneSemis / 12);
    const env2 = new Tone.AmplitudeEnvelope({
      attack: 0.05,
      decay: 0.4,
      sustain: Math.min(0.8, 0.25 + loud),
      release: 0.25
    }).connect(panBus);

    const filt2 = new Tone.Filter({
      type: 'lowpass',
      frequency: 1000,
      Q: 0.5
    }).connect(env2);

    const osc2 = new Tone.Oscillator({
      frequency: freq2,
      type: 'sawtooth'
    }).connect(filt2);

    osc2.start();
    env2.triggerAttackRelease(dur * 0.9);
    osc2.stop('+' + dur);
  }

  osc.stop('+' + dur);
}

function playWoodwinds(windKnots, dur) {
  if (!isFinite(windKnots)) return;

  const notes = woodwindNoteCount(windKnots);
  const g = woodwindGain(windKnots);
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.08, sustain: 0.1, release: 0.05 }
  }).connect(new Tone.Gain(g).connect(reverb));

  const scale = [0, 2, 4, 7, 9];
  const baseHz = 660;

  for (let i = 0; i < notes; i++) {
    const t = (i / notes) * (dur * 0.9);
    const idx = Math.floor((i * 1.7) % scale.length);
    const semis = scale[idx];
    const freq = baseHz * Math.pow(2, semis / 12);
    synth.triggerAttackRelease(freq, 0.06, '+' + t);
  }

  setTimeout(() => { synth.dispose(); }, dur * 1000 + 50);
}

function playBrass(windKnots, dur) {
  if (!isFinite(windKnots)) return;

  const category = deriveCategoryFromWind(windKnots);
  const cat = Math.max(0, Math.min(5, parseInt(category) || 0));
  const motif = brassMotifs[cat] || brassMotifs[0];
  const vol = brassVolume(cat);

  const gain = new Tone.Gain(vol).connect(panBus);
  const filt = new Tone.Filter({
    type: 'lowpass',
    frequency: 1800,
    Q: 0.6
  }).connect(gain);

  const synth = new Tone.Synth({
    oscillator: { type: (cat >= 4 ? 'square' : 'sawtooth') },
    envelope: { attack: 0.01, decay: 0.12, sustain: 0.0, release: 0.08 }
  }).connect(filt);

  const baseHz = 220;
  const stepDur = Math.max(0.06, Math.min(0.18, dur / Math.max(1, motif.length + 1)));

  for (let i = 0; i < motif.length; i++) {
    const when = '+' + (i * stepDur);
    synth.triggerAttackRelease(baseHz * Math.pow(2, motif[i] / 12), stepDur * 0.9, when);
  }

  setTimeout(() => { synth.dispose(); }, dur * 1000 + 50);
}

function scheduleStringsOffline(point, startTime, dur, panBus) {
  if (!isFinite(point.mslp)) return;

  const baseFreq = stringPitchFromPressure(point.mslp);
  const loud = pressureToBrightness(point.mslp);

  const env = new Tone.AmplitudeEnvelope({
    attack: 0.05,
    decay: 0.4,
    sustain: Math.min(0.9, 0.3 + loud),
    release: 0.3
  }).connect(panBus);

  const filt = new Tone.Filter({
    type: 'lowpass',
    frequency: 1200,
    Q: 0.4
  }).connect(env);

  const osc = new Tone.Oscillator({
    frequency: baseFreq,
    type: 'sawtooth'
  }).connect(filt);

  osc.start(startTime);
  osc.stop(startTime + dur);
  env.triggerAttackRelease(dur * 0.95, startTime);

  if (point.mslp < 950) {
    const detuneSemis = 1.5;
    const freq2 = baseFreq * Math.pow(2, detuneSemis / 12);
    const env2 = new Tone.AmplitudeEnvelope({
      attack: 0.05,
      decay: 0.4,
      sustain: Math.min(0.8, 0.25 + loud),
      release: 0.25
    }).connect(panBus);

    const filt2 = new Tone.Filter({
      type: 'lowpass',
      frequency: 1000,
      Q: 0.5
    }).connect(env2);

    const osc2 = new Tone.Oscillator({
      frequency: freq2,
      type: 'sawtooth'
    }).connect(filt2);

    osc2.start(startTime);
    osc2.stop(startTime + dur);
    env2.triggerAttackRelease(dur * 0.9, startTime);
  }
}

function scheduleWoodwindsOffline(point, startTime, dur, reverb) {
  if (!isFinite(point.vmax)) return;

  const notes = woodwindNoteCount(point.vmax);
  const g = woodwindGain(point.vmax);
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.08, sustain: 0.1, release: 0.05 }
  }).connect(new Tone.Gain(g).connect(reverb));

  const scale = [0, 2, 4, 7, 9];
  const baseHz = 660;

  for (let i = 0; i < notes; i++) {
    const offset = (i / notes) * (dur * 0.9);
    const idx = Math.floor((i * 1.7) % scale.length);
    const semis = scale[idx];
    const freq = baseHz * Math.pow(2, semis / 12);
    synth.triggerAttackRelease(freq, 0.06, startTime + offset);
  }
}

function scheduleBrassOffline(point, startTime, dur, panBus) {
  if (!isFinite(point.vmax)) return;

  const category = deriveCategoryFromWind(point.vmax);
  const cat = Math.max(0, Math.min(5, parseInt(category) || 0));
  const motif = brassMotifs[cat] || brassMotifs[0];
  const vol = brassVolume(cat);

  const gain = new Tone.Gain(vol).connect(panBus);
  const filt = new Tone.Filter({
    type: 'lowpass',
    frequency: 1800,
    Q: 0.6
  }).connect(gain);

  const synth = new Tone.Synth({
    oscillator: { type: (cat >= 4 ? 'square' : 'sawtooth') },
    envelope: { attack: 0.01, decay: 0.12, sustain: 0.0, release: 0.08 }
  }).connect(filt);

  const baseHz = 220;
  const stepDur = Math.max(0.06, Math.min(0.18, dur / Math.max(1, motif.length + 1)));

  for (let i = 0; i < motif.length; i++) {
    const noteTime = startTime + (i * stepDur);
    synth.triggerAttackRelease(baseHz * Math.pow(2, motif[i] / 12), stepDur * 0.9, noteTime);
  }
}

function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const numFrames = buffer.length;
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const wavSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(wavSize);
  const view = new DataView(arrayBuffer);

  let offset = 0;
  const writeString = (str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
    offset += str.length;
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, format, true);
  offset += 2;
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, byteRate, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bitDepth, true);
  offset += 2;
  writeString('data');
  view.setUint32(offset, dataSize, true);
  offset += 4;

  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function renderSequenceToWav(dataPoints, intervalMs = 800) {
  if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
    throw new Error('No data points available for export.');
  }

  const intervalSec = intervalMs / 1000;
  const tailSec = 2.0;
  const totalDuration = (dataPoints.length * intervalSec) + tailSec;

  const states = {
    strings: sonificationState.enableStrings,
    woodwinds: sonificationState.enableWoodwinds,
    brass: sonificationState.enableBrass,
    spatial: sonificationState.enableSpatial
  };

  const rendered = await Tone.Offline(() => {
    const masterOut = new Tone.Gain().toDestination();
    const lpf = new Tone.Filter({ type: 'lowpass', frequency: 8000, Q: 0.7 }).connect(masterOut);
    const hpf = new Tone.Filter({ type: 'highpass', frequency: 50, Q: 0.7 }).connect(lpf);
    const panner = new Tone.Panner(0).connect(hpf);
    const reverbNode = new Tone.Reverb({ decay: 2.5, wet: 0.15 }).connect(panner);

    for (let i = 0; i < dataPoints.length; i++) {
      const point = dataPoints[i];
      const start = i * intervalSec;

      if (states.spatial) {
        panner.pan.setValueAtTime(panFromLon(point.lon), start);
        hpf.frequency.setValueAtTime(hpfFromLat(point.lat), start);
      } else {
        panner.pan.setValueAtTime(0, start);
        hpf.frequency.setValueAtTime(50, start);
      }

      if (states.strings) {
        scheduleStringsOffline(point, start, intervalSec, panner);
      }
      if (states.woodwinds) {
        scheduleWoodwindsOffline(point, start, intervalSec, reverbNode);
      }
      if (states.brass) {
        scheduleBrassOffline(point, start, intervalSec, panner);
      }
    }
  }, totalDuration);

  return audioBufferToWavBlob(rendered);
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// --- Main performance function ---
async function performPoint(dataPoint, duration = 0.8) {
  // Ensure audio context is started
  await Tone.start();

  const dur = duration;
  
  // Apply spatial positioning if enabled
  if (sonificationState.enableSpatial) {
    const pan = panFromLon(dataPoint.lon);
    panBus.pan.rampTo(pan, 0.08);
    mainHPF.frequency.rampTo(hpfFromLat(dataPoint.lat), 0.1);
  } else {
    // Reset to center if spatial is disabled
    panBus.pan.rampTo(0, 0.08);
    mainHPF.frequency.rampTo(50, 0.1);
  }

  // Check for category change and speak if needed
  if (sonificationState.enableTTS && isFinite(dataPoint.vmax)) {
    const currentCategory = deriveCategoryFromWind(dataPoint.vmax);
    
    // Speak on category change OR if this is the first point (previousCategory is null)
    if (sonificationState.previousCategory === null || 
        currentCategory !== sonificationState.previousCategory) {
      speakCategory(currentCategory);
    }
    
    sonificationState.previousCategory = currentCategory;
  }

  // Play each voice if enabled and data is valid
  if (sonificationState.enableStrings && isFinite(dataPoint.mslp)) {
    playStrings(dataPoint.mslp, dur);
  }
  if (isFinite(dataPoint.vmax)) {
    if (sonificationState.enableWoodwinds) {
      playWoodwinds(dataPoint.vmax, dur);
    }
    if (sonificationState.enableBrass) {
      playBrass(dataPoint.vmax, dur);
    }
  }
}

// --- Public API ---
window.Sonification = {
  // Play a single data point
  playPoint: async function(dataPoint, duration = 0.8) {
    await performPoint(dataPoint, duration);
  },

  // Play a sequence of points
  playSequence: async function(dataPoints, intervalMs = 800, onComplete = null) {
    await Tone.start();
    sonificationState.isPlaying = true;
    sonificationState.currentIndex = 0;

    const play = async () => {
      if (!sonificationState.isPlaying || sonificationState.currentIndex >= dataPoints.length) {
        sonificationState.isPlaying = false;
        sonificationState.currentIndex = 0; // Reset for next play
        if (onComplete) onComplete();
        return;
      }

      const point = dataPoints[sonificationState.currentIndex];
      await performPoint(point, intervalMs / 1000);
      sonificationState.currentIndex++;

      sonificationState.sequenceLoop = setTimeout(play, intervalMs);
    };

    play();
  },

  // Stop any playing sequence
  stop: function() {
    sonificationState.isPlaying = false;
    sonificationState.currentIndex = 0; // Reset to beginning
    sonificationState.previousCategory = null; // Reset category tracking
    if (sonificationState.sequenceLoop) {
      clearTimeout(sonificationState.sequenceLoop);
      sonificationState.sequenceLoop = null;
    }
    // Also cancel any ongoing speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },

  // Get/set auto-play state
  getAutoPlay: function() {
    return sonificationState.autoPlay;
  },

  setAutoPlay: function(enabled) {
    sonificationState.autoPlay = enabled;
  },

  // Check if currently playing
  isPlaying: function() {
    return sonificationState.isPlaying;
  },

  // Toggle individual sound layers
  setStringsEnabled: function(enabled) {
    sonificationState.enableStrings = enabled;
  },

  setWoodwindsEnabled: function(enabled) {
    sonificationState.enableWoodwinds = enabled;
  },

  setBrassEnabled: function(enabled) {
    sonificationState.enableBrass = enabled;
  },

  setSpatialEnabled: function(enabled) {
    sonificationState.enableSpatial = enabled;
  },

  setTTSEnabled: function(enabled) {
    sonificationState.enableTTS = enabled;
    if (!enabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },

  // Get current state of layers
  getLayerStates: function() {
    return {
      strings: sonificationState.enableStrings,
      woodwinds: sonificationState.enableWoodwinds,
      brass: sonificationState.enableBrass,
      spatial: sonificationState.enableSpatial,
      tts: sonificationState.enableTTS
    };
  },

  // Render and download full sequence as WAV.
  downloadSequenceWav: async function(dataPoints, intervalMs = 800, filename = 'hurricane-sonification.wav') {
    const blob = await renderSequenceToWav(dataPoints, intervalMs);
    triggerBlobDownload(blob, filename);
  }
};
