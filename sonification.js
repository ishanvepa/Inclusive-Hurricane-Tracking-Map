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
    
    if (sonificationState.previousCategory !== null && 
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
  }
};
