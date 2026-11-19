// Solmar Bay — the renderer: paints the city, the cars, the people, the particles
// and the night on a 2D canvas. The camera follows the player; only the visible
// slice of the world is drawn.
(function (global) {
  'use strict';
  var U = global.SBUtil;
  var C = global.SBCity;

  /** Create the renderer for a canvas; keeps the camera and the canvas size. */
  function createRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    var view = { w: 1280, h: 720, dpr: 1 };

    function resize() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      view.w = window.innerWidth; view.h = window.innerHeight; view.dpr = dpr;
      canvas.width = Math.floor(view.w * dpr);
      canvas.height = Math.floor(view.h * dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    return { canvas: canvas, ctx: ctx, view: view, resize: resize };
  }

  /** Draw the ground, streets, blocks, parks, buildings and trees. */
  function drawWorld(state, renderer) {
    var ctx = renderer.ctx, cam = state.camera;
    var vw = renderer.view.w, vh = renderer.view.h;
    ctx.save();
    ctx.scale(renderer.view.dpr, renderer.view.dpr);
    ctx.translate(-cam.x, -cam.y);
    var x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + vw + 60, y1 = cam.y + vh + 60;

    // Grass base.
    ctx.fillStyle = '#79a85a';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // Beach sand and the sea along the south edge; marina water on the east edge.
    ctx.fillStyle = '#e8d8a0';
    ctx.fillRect(Math.max(x0, 0), 3045, Math.min(x1, 3045) - Math.max(x0, 0), 95);
    ctx.fillStyle = '#3a90c4';
    ctx.fillRect(Math.max(x0, 0), 3140, Math.min(x1, C.WORLD) - Math.max(x0, 0), 60);
    ctx.fillRect(3140, Math.max(y0, 0), 60, Math.min(y1, C.WORLD) - Math.max(y0, 0));
    // Sand sparkle: a few pale dots.
    ctx.fillStyle = 'rgba(255,250,220,0.5)';
    for (var s = 0; s < 40; s++) {
      var sx = ((s * 173) % 3000) + 60, sy = 3055 + ((s * 97) % 70);
      if (sx > x0 && sx < x1 && sy > y0 && sy < y1) ctx.fillRect(sx, sy, 3, 2);
    }

    // Streets: asphalt bands with a pale kerb and a dashed centre line.
    for (var i = 0; i < C.CENTERS.length; i++) {
      var c = C.CENTERS[i];
      ctx.fillStyle = '#3c414d';
      ctx.fillRect(Math.max(x0, 0), c - C.HALF, Math.min(x1, C.WORLD) - Math.max(x0, 0), C.ROAD);
      ctx.fillRect(c - C.HALF, Math.max(y0, 0), C.ROAD, Math.min(y1, C.WORLD) - Math.max(y0, 0));
      ctx.fillStyle = '#c8b898';
      ctx.fillRect(Math.max(x0, 0), c - C.HALF, Math.min(x1, C.WORLD) - Math.max(x0, 0), 3);
      ctx.fillRect(Math.max(x0, 0), c + C.HALF - 3, Math.min(x1, C.WORLD) - Math.max(x0, 0), 3);
      ctx.fillRect(c - C.HALF, Math.max(y0, 0), 3, Math.min(y1, C.WORLD) - Math.max(y0, 0));
      ctx.fillRect(c + C.HALF - 3, Math.max(y0, 0), 3, Math.min(y1, C.WORLD) - Math.max(y0, 0));
    }
    // Centre dashes.
    ctx.fillStyle = '#e8d84a';
    for (var d = 0; d < C.CENTERS.length; d++) {
      var cc = C.CENTERS[d];
      for (var t = 0; t < C.WORLD; t += 60) {
        if (t > x0 - 60 && t < x1) ctx.fillRect(t, cc - 2, 30, 4);
        if (t > y0 - 60 && t < y1) ctx.fillRect(cc - 2, t, 4, 30);
      }
    }

    // Parks: green lawns with a path.
    for (var p = 0; p < state.city.parks.length; p++) {
      var park = state.city.parks[p];
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = '#5d9a48';
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = '#c8b898';
      ctx.fillRect(park.x, park.y + park.h / 2 - 4, park.w, 8);
    }

    // Buildings: a soft shadow, the body, a lighter roof and windows on towers.
    for (var b = 0; b < state.city.buildings.length; b++) {
      var bd = state.city.buildings[b];
      if (bd.x > x1 || bd.x + bd.w < x0 || bd.y > y1 || bd.y + bd.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(bd.x + 6, bd.y + 8, bd.w, bd.h);
      ctx.fillStyle = bd.color;
      ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(bd.x + 5, bd.y + 5, bd.w - 10, bd.h - 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bd.x + 1, bd.y + 1, bd.w - 2, bd.h - 2);
      if (bd.tall) {
        ctx.fillStyle = 'rgba(255,255,220,0.75)';
        for (var wx = bd.x + 12; wx < bd.x + bd.w - 12; wx += 22) {
          for (var wy = bd.y + 12; wy < bd.y + bd.h - 12; wy += 22) {
            ctx.fillRect(wx, wy, 10, 12);
          }
        }
      }
    }

    // Trees: a dark base and a bright canopy.
    for (var t2 = 0; t2 < state.city.trees.length; t2++) {
      var tr = state.city.trees[t2];
      if (tr.x < x0 || tr.x > x1 || tr.y < y0 || tr.y > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.arc(tr.x + 3, tr.y + 4, tr.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f7a34';
      ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#57a047';
      ctx.beginPath(); ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** Draw one car: body, cabin, wheels, lights; police get a flashing light bar. */
  function drawCar(ctx, car, time, night) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-22, -10, 46, 24);
    // Wheels.
    ctx.fillStyle = '#181818';
    ctx.fillRect(-16, -13, 12, 5); ctx.fillRect(-16, 8, 12, 5);
    ctx.fillRect(6, -13, 12, 5); ctx.fillRect(6, 8, 12, 5);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -22, -11, 44, 22, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Cabin and windshield.
    ctx.fillStyle = 'rgba(30,40,60,0.85)';
    roundRect(ctx, -6, -8, 14, 16, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.7)';
    ctx.fillRect(6, -7, 3, 14);
    // Headlights at night.
    if (night) {
      ctx.fillStyle = '#fff8c0';
      ctx.fillRect(20, -9, 3, 4); ctx.fillRect(20, 5, 3, 4);
    }
    // Police: white doors and a flashing light bar.
    if (car.driver === 'police') {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(-8, -11, 12, 22);
      var flash = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
      ctx.fillRect(-4, -11, 7, 4);
      ctx.fillStyle = flash ? '#3b82ff' : '#ff3b30';
      ctx.fillRect(-4, 7, 7, 4);
    }
    // Taxi sign.
    if (car.name === 'Coral Taxi') {
      ctx.fillStyle = '#fff8c0';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.fillStyle = '#222';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, -1);
    }
    ctx.restore();
  }

  /** A rounded rectangle path (no Path2D, so it works everywhere). */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Draw a pedestrian: a little walker with a shirt, head and walking bob. */
  function drawPed(ctx, ped, time) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      // Lying flat.
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.fillRect(-12, -5, 24, 10);
      ctx.fillStyle = '#e8c8a0';
      ctx.beginPath(); ctx.arc(14, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(ped.angle);
    var bob = Math.sin(time * 10 + ped.x) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 3, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    // Legs.
    ctx.fillStyle = '#2c3440';
    ctx.fillRect(-6 + bob, -4, 5, 8);
    ctx.fillRect(-6 - bob, -4, 5, 8);
    // Body.
    ctx.fillStyle = ped.hostile ? '#3a3a3a' : ped.color;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    // Head.
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
    if (ped.hostile) {
      // A rival with a gun: a dark barrel in front.
      ctx.fillStyle = '#111';
      ctx.fillRect(8, -2, 10, 4);
    }
    // Health bar over a hurt hostile.
    if (ped.hostile && ped.health < 60) {
      ctx.rotate(-ped.angle);
      ctx.fillStyle = '#222';
      ctx.fillRect(-14, -20, 28, 4);
      ctx.fillStyle = '#e84040';
      ctx.fillRect(-13, -19, 26 * (ped.health / 60), 2);
    }
    ctx.restore();
  }

  /** Draw the player on foot: a walker in a red jacket with a direction tick. */
  function drawPlayer(ctx, p, time) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    var bob = p.speed > 0 ? Math.sin(time * 12) * 2 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 3, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2c3440';
    ctx.fillRect(-6 + bob, -5, 5, 10);
    ctx.fillRect(-6 - bob, -5, 5, 10);
    ctx.fillStyle = '#d84040';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath(); ctx.arc(7, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(9, -2, 1.5, 0, Math.PI * 2); ctx.fill();
    // Punch flash.
    if (p.punchT > 0.2) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(22, 0, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** The mission beacon: a pulsing column of light and a ring at the target. */
  function drawBeacon(ctx, target, time) {
    if (!target) return;
    var pulse = 0.6 + Math.sin(time * 4) * 0.25;
    ctx.save();
    ctx.globalAlpha = pulse * 0.5;
    ctx.fillStyle = '#ff5ad8';
    ctx.fillRect(target.x - 4, target.y - 220, 8, 220);
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#ff5ad8';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(target.x, target.y, 34 + Math.sin(time * 3) * 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff5ad8';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 14);
    ctx.lineTo(target.x + 9, target.y + 6);
    ctx.lineTo(target.x - 9, target.y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Night: a dark blue wash, headlight cones and glowing street lights. */
  function drawNight(state, renderer) {
    var ctx = renderer.ctx, cam = state.camera;
    var vw = renderer.view.w, vh = renderer.view.h;
    ctx.save();
    ctx.scale(renderer.view.dpr, renderer.view.dpr);
    ctx.fillStyle = 'rgba(8,14,44,0.42)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.translate(-cam.x, -cam.y);
    // Headlight cone from the player's car (or a torch glow on foot).
    var p = state.player;
    ctx.globalCompositeOperation = 'lighter';
    var hx = p.x, hy = p.y, ha = p.angle;
    var grad = ctx.createRadialGradient(hx, hy, 10, hx, hy, 260);
    grad.addColorStop(0, 'rgba(255,240,180,0.20)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(hx, hy, 260, 0, Math.PI * 2); ctx.fill();
    // Street light pools.
    for (var i = 0; i < state.city.lights.length; i++) {
      var L = state.city.lights[i];
      if (L.x < cam.x - 300 || L.x > cam.x + vw + 300 || L.y < cam.y - 300 || L.y > cam.y + vh + 300) continue;
      var g = ctx.createRadialGradient(L.x, L.y, 2, L.x, L.y, 90);
      g.addColorStop(0, 'rgba(255,220,140,0.28)');
      g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(L.x, L.y, 90, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** Paint one frame: world, entities, effects, night wash. The HUD is separate. */
  function renderGame(state, renderer) {
    var ctx = renderer.ctx;
    var vw = renderer.view.w, vh = renderer.view.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, renderer.canvas.width, renderer.canvas.height);
    drawWorld(state, renderer);

    ctx.save();
    ctx.scale(renderer.view.dpr, renderer.view.dpr);
    ctx.translate(-state.camera.x, -state.camera.y);
    var time = state.time;
    var x0 = state.camera.x - 80, y0 = state.camera.y - 80;
    var x1 = state.camera.x + vw + 80, y1 = state.camera.y + vh + 80;
    var inView = function (x, y) { return x > x0 && x < x1 && y > y0 && y < y1; };

    // Cash drops glow on the street.
    var M = global.SBMissions;
    if (state.mission) {
      var step = state.mission.def.steps[state.mission.step];
      if (step && step.type === 'collect') {
        for (var ci = 0; ci < step.items.length; ci++) {
          var drop = C.PLACES[step.items[ci]];
          if (drop.taken || !inView(drop.x, drop.y)) continue;
          ctx.fillStyle = '#7ae87a';
          ctx.beginPath(); ctx.arc(drop.x, drop.y, 12 + Math.sin(time * 5) * 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1a5a1a';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('$', drop.x, drop.y + 4);
        }
      }
    }

    // Cars, then people, then the player.
    for (var c = 0; c < state.cars.length; c++) {
      var car = state.cars[c];
      if (inView(car.x, car.y)) drawCar(ctx, car, time, state.night);
    }
    for (var p = 0; p < state.peds.length; p++) {
      var ped = state.peds[p];
      if (inView(ped.x, ped.y)) drawPed(ctx, ped, time);
    }
    if (!state.player.inCar) drawPlayer(ctx, state.player, time);

    // Particles (sparks, smoke, tracers).
    for (var i = 0; i < state.particles.length; i++) {
      var pt = state.particles[i];
      if (pt.tracer) {
        ctx.strokeStyle = 'rgba(255,233,160,' + (pt.life / pt.max) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.tx, pt.ty); ctx.stroke();
      } else {
        ctx.globalAlpha = Math.max(0, pt.life / pt.max);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        ctx.globalAlpha = 1;
      }
    }

    // Floating "+$300" labels.
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    for (var f = 0; f < state.floaters.length; f++) {
      var fl = state.floaters[f];
      ctx.globalAlpha = Math.min(1, fl.t);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x, fl.y);
      ctx.globalAlpha = 1;
    }

    drawBeacon(ctx, M.missionTarget(state), time);
    ctx.restore();

    if (state.night) drawNight(state, renderer);
  }

  global.SBRender = {
    createRenderer: createRenderer, renderGame: renderGame,
    drawWorld: drawWorld, drawCar: drawCar, drawPed: drawPed
  };
})(typeof window !== 'undefined' ? window : globalThis);
