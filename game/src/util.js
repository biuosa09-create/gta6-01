// Solmar Bay — small math and random helpers shared by every system.
// All helpers are pure functions on plain numbers; nothing here touches the DOM.
(function (global) {
  'use strict';

  /** Clamp a number into [lo, hi]. */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /** Linear interpolation between a and b. */
  function lerp(a, b, t) { return a + (b - a) * t; }

  /** Distance between two points. */
  function dist(x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Distance squared (cheaper when only a comparison is needed). */
  function dist2(x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  /** Shortest signed turn from angle a to angle b, in radians. */
  function angleDiff(a, b) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /** Normalise an angle to [-PI, PI]. */
  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  /** A deterministic seeded random generator (mulberry32) for stable screenshots. */
  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Pick one entry of an array with a rng. */
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  /** Random float in [lo, hi) with a rng. */
  function range(rng, lo, hi) { return lo + rng() * (hi - lo); }

  /** Random integer in [lo, hi] with a rng. */
  function rangeInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

  global.SBUtil = {
    clamp: clamp, lerp: lerp, dist: dist, dist2: dist2,
    angleDiff: angleDiff, wrapAngle: wrapAngle,
    makeRng: makeRng, pick: pick, range: range, rangeInt: rangeInt
  };
})(typeof window !== 'undefined' ? window : globalThis);
