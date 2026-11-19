// Solmar Bay — every sound is synthesised with WebAudio: engine hum, sirens,
// gunshots, punches, pickups and a little bass-driven music loop. No audio files.
(function (global) {
  'use strict';

  /** Create the sound engine. All methods are safe to call before audio starts. */
  function createAudio() {
    var ctx = null;
    var master = null;
    var engineOsc = null, engineGain = null;
    var musicTimer = null;
    var muted = false;
    var musicStep = 0;
    /** Bass line of the street theme (A minor walk: Am F C G), in Hz. */
    var BASS = [110, 110, 87.31, 87.31, 130.81, 130.81, 98, 98];
    /** Sparkle notes over the bass, in Hz (0 = rest). */
    var LEAD = [440, 0, 523.25, 0, 659.25, 0, 523.25, 0, 392, 0, 440, 0, 523.25, 587.33, 659.25, 0];

    /** Build the AudioContext on the first user gesture; browsers block it before. */
    function ensure() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(ctx.destination);
        // Engine: a low sawtooth whose pitch follows the car's speed.
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        var engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 320;
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      } catch (e) { ctx = null; return false; }
      return true;
    }

    /** A short oscillator blip. */
    function blip(freqA, freqB, dur, type, vol) {
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freqA, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + dur);
      g.gain.setValueAtTime(vol || 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    }

    /** A burst of filtered noise (gunshot, crash, footsteps on gravel). */
    function noise(dur, vol, cutoff) {
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff || 3000;
      var g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(filter); filter.connect(g); g.connect(master);
      src.start(t);
    }

    /** Two-tone police siren wail, called while a chase is on. */
    function siren() { blip(700, 950, 0.42, 'triangle', 0.07); setTimeout(function () { blip(950, 700, 0.42, 'triangle', 0.07); }, 430); }

    return {
      /** Unlock audio (call from a click / keydown). */
      unlock: ensure,
      /** Mute or unmute everything. Returns the new muted state. */
      toggleMute: function () {
        muted = !muted;
        if (master) master.gain.value = muted ? 0 : 0.5;
        return muted;
      },
      isMuted: function () { return muted; },
      /** Engine pitch/gain from the driven car's speed (0..1). */
      setEngine: function (amount, driving) {
        if (!ctx || !engineGain) return;
        engineGain.gain.value = driving ? 0.05 + amount * 0.06 : 0.0;
        engineOsc.frequency.value = 50 + amount * 130;
      },
      shoot: function () { noise(0.12, 0.35, 2200); blip(180, 60, 0.1, 'square', 0.2); },
      punch: function () { blip(140, 55, 0.14, 'sine', 0.4); noise(0.08, 0.2, 800); },
      crash: function () { noise(0.3, 0.45, 900); blip(90, 40, 0.25, 'sine', 0.35); },
      pickup: function () { blip(660, 660, 0.09, 'sine', 0.25); setTimeout(function () { blip(880, 880, 0.14, 'sine', 0.25); }, 90); },
      coin: function () { blip(990, 990, 0.08, 'triangle', 0.22); setTimeout(function () { blip(1320, 1320, 0.12, 'triangle', 0.22); }, 80); },
      missionDone: function () {
        var notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach(function (f, i) { setTimeout(function () { blip(f, f, 0.22, 'triangle', 0.28); }, i * 130); });
      },
      busted: function () { blip(320, 110, 0.7, 'sawtooth', 0.25); },
      siren: siren,
      /** Start the little street-theme loop (bass + sparkle + hat ticks). */
      startMusic: function () {
        if (!ctx || musicTimer) return;
        musicTimer = setInterval(function () {
          if (muted || !ctx) return;
          var bass = BASS[musicStep % BASS.length];
          blip(bass, bass, 0.42, 'square', 0.07);
          var lead = LEAD[musicStep % LEAD.length];
          if (lead) blip(lead, lead, 0.18, 'sine', 0.05);
          if (musicStep % 2 === 0) noise(0.03, 0.04, 6000);
          musicStep++;
        }, 300);
      },
      stopMusic: function () { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
    };
  }

  global.SBAudio = { createAudio: createAudio };
})(typeof window !== 'undefined' ? window : globalThis);
