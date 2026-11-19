// Solmar Bay — the HUD: health and money, wanted stars, the mission objective,
// the live minimap, contextual hints, and the title / pause / game-over screens.
(function (global) {
  'use strict';
  var U = global.SBUtil;
  var C = global.SBCity;
  var M = global.SBMissions;

  /** Minimap size in pixels. */
  var MAP = 190;

  /** Draw a star (filled or outline) at x, y. */
  function drawStar(ctx, x, y, r, filled) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + (i * Math.PI) / 5;
      var rad = i % 2 === 0 ? r : r * 0.45;
      var px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (filled) { ctx.fillStyle = '#ffd94a'; ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  /** Split text into lines that fit maxW (for the toast message). */
  function wrapLines(ctx, text, maxW) {
    var words = String(text).split(' ');
    var lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  /** The live minimap: the whole city shrunk, with the player, cars, cops and marker. */
  function drawMinimap(state, renderer) {
    var ctx = renderer.ctx;
    var vw = renderer.view.w;
    var mx = vw - MAP - 14, my = 14;
    var s = MAP / C.WORLD;
    // The caller (drawHUD) already applied the device-pixel scale.
    // Frame.
    ctx.fillStyle = 'rgba(10,16,28,0.85)';
    ctx.fillRect(mx - 4, my - 4, MAP + 8, MAP + 8);
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx - 4, my - 4, MAP + 8, MAP + 8);
    // Sea and sand.
    ctx.fillStyle = '#2a6a9a';
    ctx.fillRect(mx, my, MAP, MAP);
    ctx.fillStyle = '#79a85a';
    ctx.fillRect(mx, my, MAP, MAP * (3045 / C.WORLD));
    ctx.fillStyle = '#e8d8a0';
    ctx.fillRect(mx, my + MAP * (3045 / C.WORLD), MAP, MAP * (95 / C.WORLD));
    // Streets.
    ctx.fillStyle = '#3c414d';
    for (var i = 0; i < C.CENTERS.length; i++) {
      var c = C.CENTERS[i] * s;
      ctx.fillRect(mx, my + c - 2, MAP, 4);
      ctx.fillRect(mx + c - 2, my, 4, MAP);
    }
    // Buildings as dots.
    ctx.fillStyle = 'rgba(20,24,32,0.8)';
    for (var b = 0; b < state.city.buildings.length; b++) {
      var bd = state.city.buildings[b];
      ctx.fillRect(mx + bd.x * s, my + bd.y * s, Math.max(2, bd.w * s), Math.max(2, bd.h * s));
    }
    // Cash drops.
    if (state.mission) {
      var step = state.mission.def.steps[state.mission.step];
      if (step && step.type === 'collect') {
        ctx.fillStyle = '#7ae87a';
        for (var ci = 0; ci < step.items.length; ci++) {
          var drop = C.PLACES[step.items[ci]];
          if (!drop.taken) { ctx.beginPath(); ctx.arc(mx + drop.x * s, my + drop.y * s, 4, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    }
    // Mission marker (pulsing pink).
    var target = M.missionTarget(state);
    if (target) {
      var pr = 5 + Math.sin(state.time * 4) * 1.5;
      ctx.fillStyle = '#ff5ad8';
      ctx.beginPath(); ctx.arc(mx + target.x * s, my + target.y * s, pr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx + target.x * s, my + target.y * s, pr + 2, 0, Math.PI * 2); ctx.stroke();
    }
    // Traffic cars (yellow), police (flashing blue/red).
    ctx.fillStyle = '#e8c832';
    for (var c2 = 0; c2 < state.cars.length; c2++) {
      var car = state.cars[c2];
      if (car.driver === 'police') continue;
      ctx.fillRect(mx + car.x * s - 1, my + car.y * s - 1, 3, 3);
    }
    for (var p2 = 0; p2 < state.police.length; p2++) {
      var cop = state.police[p2];
      ctx.fillStyle = Math.floor(state.time * 4) % 2 === 0 ? '#ff3b30' : '#3b82ff';
      ctx.beginPath(); ctx.arc(mx + cop.x * s, my + cop.y * s, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // The player: a white arrow that turns with them.
    var pl = state.player;
    ctx.save();
    ctx.translate(mx + pl.x * s, my + pl.y * s);
    ctx.rotate(pl.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /** The in-game HUD: bars, stars, objective, hints, speed, edge arrow. */
  function drawHUD(state, renderer) {
    var ctx = renderer.ctx;
    var vw = renderer.view.w, vh = renderer.view.h;
    var p = state.player;
    ctx.save();
    ctx.scale(renderer.view.dpr, renderer.view.dpr);

    // Red flash on a fresh crime.
    if (state.crimeFlash > 0) {
      ctx.fillStyle = 'rgba(220,40,40,' + (state.crimeFlash * 0.18) + ')';
      ctx.fillRect(0, 0, vw, vh);
    }

    // Top-left: health bar, money, district.
    ctx.fillStyle = 'rgba(10,16,28,0.7)';
    ctx.fillRect(12, 12, 230, 74);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(12, 12, 230, 74);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MILO KADE', 22, 32);
    ctx.fillStyle = '#222';
    ctx.fillRect(22, 40, 150, 12);
    ctx.fillStyle = p.health > 40 ? '#5ad86a' : '#e84040';
    ctx.fillRect(22, 40, 150 * (p.health / 100), 12);
    ctx.fillStyle = '#7ae87a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('$' + p.money, 180, 52);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px sans-serif';
    ctx.fillText(C.districtAt(p.x, p.y) + '  •  ' + (state.night ? 'Night' : 'Day'), 22, 72);

    // Wanted stars under the health box.
    for (var s = 0; s < 5; s++) drawStar(ctx, 30 + s * 26, 102, 10, s < p.wanted);
    if (p.wanted > 0) {
      ctx.fillStyle = '#ff6a5a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('WANTED', 168, 107);
    }

    // Top-centre: mission title and objective.
    if (state.mission) {
      var m = state.mission;
      ctx.fillStyle = 'rgba(10,16,28,0.7)';
      var obj = M.missionObjective(state);
      ctx.font = 'bold 15px sans-serif';
      var w = Math.max(ctx.measureText(m.def.title).width, ctx.measureText(obj).width) + 28;
      ctx.fillRect(vw / 2 - w / 2, 12, w, 52);
      ctx.strokeStyle = 'rgba(255,90,216,0.7)';
      ctx.strokeRect(vw / 2 - w / 2, 12, w, 52);
      ctx.fillStyle = '#ff5ad8';
      ctx.textAlign = 'center';
      ctx.fillText(m.def.title.toUpperCase(), vw / 2, 31);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText(obj, vw / 2, 52);
    }

    // Toast message, word-wrapped so it never runs under the minimap.
    if (state.messageT > 0 && state.message) {
      ctx.globalAlpha = Math.min(1, state.messageT);
      ctx.font = 'bold 16px sans-serif';
      var lines = wrapLines(ctx, state.message, vw - MAP - 330);
      if (lines.length > 3) lines = lines.slice(0, 3);
      var mw = 0;
      for (var li = 0; li < lines.length; li++) mw = Math.max(mw, ctx.measureText(lines[li]).width);
      mw += 30;
      var mh = lines.length * 21 + 12;
      ctx.fillStyle = 'rgba(10,16,28,0.8)';
      ctx.fillRect(vw / 2 - mw / 2, 76, mw, mh);
      ctx.fillStyle = '#ffd94a';
      ctx.textAlign = 'center';
      for (var lj = 0; lj < lines.length; lj++) ctx.fillText(lines[lj], vw / 2, 96 + lj * 21);
      ctx.globalAlpha = 1;
    }

    drawMinimap(state, renderer);

    // Edge arrow pointing at an off-screen mission target.
    var target = M.missionTarget(state);
    if (target) {
      var cam = state.camera;
      var onScreen = target.x > cam.x + 40 && target.x < cam.x + vw - 40 && target.y > cam.y + 40 && target.y < cam.y + vh - 40;
      if (!onScreen) {
        var a = Math.atan2(target.y - p.y, target.x - p.x);
        var ax = vw / 2 + Math.cos(a) * 120, ay = vh / 2 + Math.sin(a) * 120;
        var dist = Math.round(U.dist(p.x, p.y, target.x, target.y));
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.fillStyle = '#ff5ad8';
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dist + 'm', ax, ay + 26);
      }
    }

    // Bottom-left: contextual hints.
    ctx.textAlign = 'left';
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    var hint = p.inCar
      ? 'W/S drive  •  A/D steer  •  Space handbrake  •  E get out  •  P pause  •  M mute'
      : 'WASD move  •  Shift run  •  E enter car  •  F punch  •  Click shoot  •  P pause  •  Q save';
    ctx.fillText(hint, 14, vh - 14);

    // Bottom-right: speed and car name while driving.
    if (p.inCar) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/h', vw - 16, vh - 40);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#ffd94a';
      ctx.fillText(p.inCar.name, vw - 16, vh - 18);
    }

    // Busted timer warning.
    if (p.bustedT > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('BUSTED IN ' + Math.ceil(2 - p.bustedT) + '... RUN!', vw / 2, vh - 90);
    }
    ctx.restore();
  }

  /** A clickable menu button; returns its rect for hit-testing. */
  function drawButton(ctx, x, y, w, h, label, accent) {
    ctx.fillStyle = accent ? '#ff5ad8' : 'rgba(20,28,44,0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent ? '#fff' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + 6);
    return { x: x, y: y, w: w, h: h, label: label };
  }

  /** The title screen. Returns the buttons it drew, for click handling. */
  function drawTitleScreen(renderer, saveExists, showHelp) {
    var ctx = renderer.ctx;
    var vw = renderer.view.w, vh = renderer.view.h;
    ctx.save();
    ctx.scale(renderer.view.dpr, renderer.view.dpr);
    // Sunset gradient backdrop.
    var g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, '#ff9a5a');
    g.addColorStop(0.55, '#c85a8a');
    g.addColorStop(1, '#2a3a6a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
    // Sun, up and to the right so it never sits behind the title.
    ctx.fillStyle = '#ffe9a0';
    ctx.beginPath(); ctx.arc(vw * 0.86, vh * 0.16, 54, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a2438';
    for (var i = 0; i < 14; i++) {
      var bw = 50 + ((i * 37) % 60), bh = 90 + ((i * 53) % 160);
      ctx.fillRect(i * (vw / 14), vh - bh - 90, bw, bh + 90);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, vh - 90, vw, 90);
    // Title.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 84px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 18;
    ctx.fillText('SOLMAR BAY', vw / 2, vh * 0.32);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('AN OPEN-WORLD CRIME STORY', vw / 2, vh * 0.32 + 38);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '16px sans-serif';
    ctx.fillText('Steal cars. Run missions for Vera. Outrun the Solmar Bay police.', vw / 2, vh * 0.32 + 68);

    var buttons = [];
    var bx = vw / 2 - 130, by = vh * 0.52;
    if (showHelp) {
      ctx.fillStyle = 'rgba(10,16,28,0.88)';
      ctx.fillRect(vw / 2 - 300, vh * 0.46, 600, 210);
      ctx.strokeStyle = '#ffd94a';
      ctx.strokeRect(vw / 2 - 300, vh * 0.46, 600, 210);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('HOW TO PLAY', vw / 2, vh * 0.46 + 32);
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'left';
      var lines = [
        'WASD / Arrows — move or drive    Shift — run',
        'E — steal / enter a car, get out    F — punch',
        'Mouse click — shoot toward the cursor',
        'Space — handbrake    P — pause    Q — save    M — mute',
        'Follow the pink marker: missions pay, the cops chase.',
        'Lose the cops to drop your wanted level. Save often!'
      ];
      for (var l = 0; l < lines.length; l++) ctx.fillText(lines[l], vw / 2 - 280, vh * 0.46 + 62 + l * 24);
      buttons.push(drawButton(ctx, bx, vh * 0.46 + 224, 260, 46, 'BACK', false));
      ctx.restore();
      return buttons;
    }
    if (saveExists) {
      buttons.push(drawButton(ctx, bx, by, 260, 48, 'CONTINUE', true));
      buttons.push(drawButton(ctx, bx, by + 60, 260, 48, 'NEW GAME', false));
      buttons.push(drawButton(ctx, bx, by + 120, 260, 48, 'HOW TO PLAY', false));
    } else {
      buttons.push(drawButton(ctx, bx, by, 260, 48, 'NEW GAME', true));
      buttons.push(drawButton(ctx, bx, by + 60, 260, 48, 'HOW TO PLAY', false));
    }
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '13px sans-serif';
    ctx.fillText('A fan-made open-world game. Original city, characters and story.', vw / 2, vh - 24);
    ctx.restore();
    return buttons;
  }

  /** The pause screen. Returns its buttons. */
  function drawPauseScreen(renderer, state) {
    var ctx = renderer.ctx;
    var vw = renderer.view.w, vh = renderer.view.h;
    ctx.save();
    ctx.scale(renderer.view.dpr, renderer.view.dpr);
    ctx.fillStyle = 'rgba(8,12,24,0.72)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('PAUSED', vw / 2, vh * 0.3);
    ctx.fillStyle = '#ffd94a';
    ctx.font = '16px sans-serif';
    ctx.fillText('Money $' + state.player.money + '  •  Missions done: ' + state.stats.missionsDone + '  •  Cars stolen: ' + state.stats.carsStolen, vw / 2, vh * 0.3 + 34);
    var buttons = [];
    var bx = vw / 2 - 130;
    buttons.push(drawButton(ctx, bx, vh * 0.42, 260, 48, 'RESUME', true));
    buttons.push(drawButton(ctx, bx, vh * 0.42 + 60, 260, 48, 'SAVE GAME', false));
    buttons.push(drawButton(ctx, bx, vh * 0.42 + 120, 260, 48, 'QUIT TO TITLE', false));
    ctx.restore();
    return buttons;
  }

  /** The wasted / game-over screen. Returns its buttons. */
  function drawWastedScreen(renderer) {
    var ctx = renderer.ctx;
    var vw = renderer.view.w, vh = renderer.view.h;
    ctx.save();
    ctx.scale(renderer.view.dpr, renderer.view.dpr);
    ctx.fillStyle = 'rgba(20,0,0,0.78)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('WASTED', vw / 2, vh * 0.4);
    ctx.fillStyle = '#fff';
    ctx.font = '17px sans-serif';
    ctx.fillText('Solmar General patched you up. You lost $100 — the mission restarts.', vw / 2, vh * 0.4 + 36);
    var buttons = [];
    buttons.push(drawButton(ctx, vw / 2 - 130, vh * 0.52, 260, 48, 'GET BACK OUT THERE', true));
    ctx.restore();
    return buttons;
  }

  global.SBHud = {
    drawHUD: drawHUD, drawMinimap: drawMinimap,
    drawTitleScreen: drawTitleScreen, drawPauseScreen: drawPauseScreen,
    drawWastedScreen: drawWastedScreen
  };
})(typeof window !== 'undefined' ? window : globalThis);
