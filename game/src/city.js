// Solmar Bay — the city itself: a 3200 x 3200 grid of streets, blocks, buildings,
// parks, a beach and a port, generated once from a seed. Everything the game needs
// to place, drive and collide lives here: roads, buildings, districts and landmarks.
(function (global) {
  'use strict';
  var U = global.SBUtil;

  /** World size in pixels. */
  var WORLD = 3200;
  /** Distance between neighbouring street centrelines. */
  var PITCH = 400;
  /** Street width. */
  var ROAD = 90;
  /** Street centreline coordinates (8 vertical, 8 horizontal). */
  var CENTERS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
  /** Half-width of a street. */
  var HALF = ROAD / 2;

  /** Named places the story and the HUD refer to (all on streets). */
  var PLACES = {
    garage:    { name: "Vera's Garage",  x: 1800, y: 1400 },
    port:      { name: 'Old Port',       x: 3000, y: 1000 },
    marina:    { name: 'Marina Drop',    x: 2600, y: 3000 },
    bank:      { name: 'Solmar Bank',    x: 1400, y: 1000 },
    safehouse: { name: 'Safehouse',      x: 600,  y: 600 },
    hospital:  { name: 'Solmar General', x: 1000, y: 1800 },
    beach:     { name: 'Coral Beach',    x: 1400, y: 3090 },
    cashA:     { name: 'Cash Drop',      x: 600,  y: 2200 },
    cashB:     { name: 'Cash Drop',      x: 2200, y: 600 },
    cashC:     { name: 'Cash Drop',      x: 2600, y: 2200 }
  };

  /** Pastel roof colours for buildings. */
  var ROOFS = ['#e8a87c', '#a8c8e8', '#e8d8a0', '#c8a8d8', '#f0e0c8', '#a8d8b0', '#e8b0b8', '#b8c8d8'];
  /** Glass tower colours for downtown. */
  var TOWERS = ['#7fb0d8', '#8fb8c8', '#a0b8d8', '#6f9fc8'];

  /** Is a point on a street (inside a road band)? */
  function isRoadPoint(x, y) {
    for (var i = 0; i < CENTERS.length; i++) {
      if (Math.abs(x - CENTERS[i]) <= HALF || Math.abs(y - CENTERS[i]) <= HALF) return true;
    }
    return false;
  }

  /** Nearest street centreline coordinate to a value. */
  function nearestCenter(v) {
    var best = CENTERS[0], bd = Math.abs(v - best);
    for (var i = 1; i < CENTERS.length; i++) {
      var d = Math.abs(v - CENTERS[i]);
      if (d < bd) { bd = d; best = CENTERS[i]; }
    }
    return best;
  }

  /** Is a point inside the water (south beach sea / east marina)? */
  function inWater(x, y) {
    return (y >= 3140 && x < 3045) || (x >= 3140);
  }

  /** Is a point on the sand strip? */
  function onSand(x, y) {
    return y >= 3045 && y < 3140 && x < 3045;
  }

  /** District name for a point, shown in the HUD. */
  function districtAt(x, y) {
    if (onSand(x, y) || inWater(x, y)) return 'Coral Beach';
    if (x >= 3045) return 'Marina';
    if (x >= 2600 && y <= 1400) return 'Old Port';
    if (x >= 1000 && x <= 2200 && y >= 1000 && y <= 2200) return 'Downtown';
    if (x <= 1000 && y <= 1000) return 'Palm Heights';
    if (y >= 2600) return 'Southside';
    return 'Midtown';
  }

  /** Build the whole city from a seed. Returns {buildings, trees, parks, lights, parkedSpots}. */
  function buildCity(seed) {
    var rng = U.makeRng(seed);
    var buildings = [];
    var trees = [];
    var parks = [];
    var lights = [];
    var parkedSpots = [];

    // Street lights along every street, every 200 px, offset to the kerb.
    for (var s = 0; s < CENTERS.length; s++) {
      for (var t = 0; t < WORLD; t += 200) {
        lights.push({ x: CENTERS[s] + HALF - 6, y: t + 100 });
        lights.push({ x: t + 100, y: CENTERS[s] + HALF - 6 });
      }
    }

    // Blocks sit between neighbouring street centrelines: 7 x 7 of them.
    for (var bx = 0; bx < 7; bx++) {
      for (var by = 0; by < 7; by++) {
        var x0 = CENTERS[bx] + HALF, y0 = CENTERS[by] + HALF;
        var x1 = CENTERS[bx + 1] - HALF, y1 = CENTERS[by + 1] - HALF;
        var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        var downtown = bx >= 2 && bx <= 4 && by >= 2 && by <= 4;
        var houses = bx <= 1 && by <= 1;
        var port = bx === 6 && by <= 2;
        var park = (bx === 1 && by === 3) || (bx === 4 && by === 1) || (bx === 5 && by === 4) || (bx === 2 && by === 5);
        var parking = (bx === 5 && by === 2) || (bx === 3 && by === 6);

        if (park) {
          parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
          for (var p = 0; p < 14; p++) {
            trees.push({ x: U.range(rng, x0 + 20, x1 - 20), y: U.range(rng, y0 + 20, y1 - 20), r: U.range(rng, 10, 18) });
          }
          continue;
        }
        if (parking) {
          for (var q = 0; q < 5; q++) {
            parkedSpots.push({ x: x0 + 40 + q * 52, y: cy, angle: 0 });
          }
          continue;
        }
        if (port) {
          // Long warehouses along the docks.
          buildings.push({ x: x0 + 10, y: y0 + 20, w: x1 - x0 - 20, h: 70, color: '#b08a68', roof: '#8a6a50', tall: false });
          buildings.push({ x: x0 + 10, y: y1 - 90, w: x1 - x0 - 20, h: 70, color: '#a88868', roof: '#7a5a44', tall: false });
          continue;
        }
        if (houses) {
          // Four small houses with gardens.
          var hx = [x0 + 30, x1 - 110, x0 + 30, x1 - 110];
          var hy = [y0 + 30, y0 + 30, y1 - 110, y1 - 110];
          for (var h = 0; h < 4; h++) {
            buildings.push({ x: hx[h], y: hy[h], w: 80, h: 80, color: U.pick(rng, ROOFS), roof: U.pick(rng, ROOFS), tall: false });
            trees.push({ x: hx[h] + 95, y: hy[h] + 20, r: 12 });
          }
          continue;
        }
        if (downtown) {
          // One or two glass towers with a plaza.
          var tw = U.range(rng, 110, 150);
          buildings.push({ x: cx - tw / 2, y: cy - tw / 2, w: tw, h: tw, color: U.pick(rng, TOWERS), roof: '#5a7a9a', tall: true });
          if (rng() < 0.6) {
            buildings.push({ x: x0 + 20, y: y0 + 20, w: 90, h: 70, color: U.pick(rng, ROOFS), roof: U.pick(rng, ROOFS), tall: false });
          }
          continue;
        }
        // Mixed midtown: two mid-size blocks.
        buildings.push({ x: x0 + 20, y: y0 + 25, w: U.range(rng, 90, 130), h: U.range(rng, 80, 110), color: U.pick(rng, ROOFS), roof: U.pick(rng, ROOFS), tall: false });
        buildings.push({ x: x1 - U.range(rng, 110, 150), y: y1 - U.range(rng, 100, 130), w: U.range(rng, 90, 120), h: U.range(rng, 80, 110), color: U.pick(rng, ROOFS), roof: U.pick(rng, ROOFS), tall: false });
        for (var tr = 0; tr < 3; tr++) {
          trees.push({ x: U.range(rng, x0 + 15, x1 - 15), y: U.range(rng, y0 + 15, y1 - 15), r: U.range(rng, 8, 13) });
        }
      }
    }

    // A few parked cars on the streets near the garage and the beach.
    parkedSpots.push({ x: 1845, y: 1400, angle: 0 });
    parkedSpots.push({ x: 1355, y: 1000, angle: Math.PI / 2 });
    parkedSpots.push({ x: 2555, y: 3000, angle: 0 });
    parkedSpots.push({ x: 645, y: 600, angle: Math.PI / 2 });

    return { buildings: buildings, trees: trees, parks: parks, lights: lights, parkedSpots: parkedSpots };
  }

  /** Push a circle out of buildings, water and the world edge. Returns {x, y, hit}. */
  function collideCircle(city, x, y, r) {
    var hit = false;
    var bx = U.clamp(x, r, WORLD - r), by = U.clamp(y, r, WORLD - r);
    if (bx !== x || by !== y) { x = bx; y = by; hit = true; }
    for (var i = 0; i < city.buildings.length; i++) {
      var b = city.buildings[i];
      var nx = U.clamp(x, b.x, b.x + b.w), ny = U.clamp(y, b.y, b.y + b.h);
      var dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.001) {
          var d = Math.sqrt(d2);
          x = nx + (dx / d) * r; y = ny + (dy / d) * r;
        } else {
          // Centre inside the building: push out along the smallest overlap.
          var left = x - b.x, right = b.x + b.w - x, top = y - b.y, bot = b.y + b.h - y;
          var m = Math.min(left, right, top, bot);
          if (m === left) x = b.x - r; else if (m === right) x = b.x + b.w + r;
          else if (m === top) y = b.y - r; else y = b.y + b.h + r;
        }
      }
    }
    if (inWater(x, y)) {
      // Shove back out of the sea / marina water.
      if (x >= 3140) { x = 3140 - r; hit = true; }
      else if (y >= 3140) { y = 3140 - r; hit = true; }
    }
    return { x: x, y: y, hit: hit };
  }

  /** A random point on a street (used to spawn traffic). */
  function randomRoadPoint(rng) {
    if (rng() < 0.5) return { x: U.pick(rng, CENTERS), y: U.range(rng, 120, WORLD - 120) };
    return { x: U.range(rng, 120, WORLD - 120), y: U.pick(rng, CENTERS) };
  }

  global.SBCity = {
    WORLD: WORLD, PITCH: PITCH, ROAD: ROAD, HALF: HALF, CENTERS: CENTERS,
    PLACES: PLACES, buildCity: buildCity, isRoadPoint: isRoadPoint,
    nearestCenter: nearestCenter, inWater: inWater, onSand: onSand,
    districtAt: districtAt, collideCircle: collideCircle, randomRoadPoint: randomRoadPoint
  };
})(typeof window !== 'undefined' ? window : globalThis);
