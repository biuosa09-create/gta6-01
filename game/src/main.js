// Solmar Bay — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between four screens: title, play, paused and wasted.
//
// ?seed=N fixes the city. ?shot=cover|mission|chase|night (with &seed=N) stages
// that scene instead of the title screen, plays it for a moment and sets
// window.__shotReady for a screenshot.
(function () {
  'use strict';
  var U = window.SBUtil;
  var C = window.SBCity;
  var E = window.SBEntities;
  var M = window.SBMissions;
  var R = window.SBRender;
  var H = window.SBHud;
  var S = window.SBSave;

  /** The longest frame the loop catches up on; a longer stall is dropped. */
  var STEP = 1 / 60;
  var MAX_FRAME = 0.25;

  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot');
  var seedParam = Number.parseInt(params.get('seed') || '', 10);
  var seed = Number.isInteger(seedParam) ? seedParam : (Math.floor(Math.random() * 4294967296) >>> 0);

  var canvas = document.getElementById('game');
  var statusEl = document.getElementById('status');
  var renderer = R.createRenderer(canvas);
  var input = window.SBInput.createInput(canvas);
  var audio = window.SBAudio.createAudio();

  /** Build a fresh world and wire the shared handles the systems expect. */
  function newGame(gameSeed) {
    var state = E.createWorldState(gameSeed);
    state.input = input;
    state.audio = audio;
    state.camera = { x: 0, y: 0 };
    state.screen = 'title';
    state.showHelp = false;
    state.wastedT = 0;
    state.buttons = [];
    state.shotFrames = 0;
    state.shotInput = null;
    M.startMission(state, 0);
    return state;
  }

  var state = newGame(seed);

  /** Point-in-rect hit test for menu buttons. */
  function hitButton(buttons, x, y) {
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  /** Apply a loaded save to the world state. */
  function applySave(state, data) {
    var p = state.player;
    p.money = data.money;
    p.health = data.health;
    p.x = data.x; p.y = data.y;
    p.angle = -Math.PI / 2;
    state.night = !!data.night;
    state.stats = data.stats || state.stats;
    if (data.storyDone || data.missionIndex >= 99) {
      state.mission = null;
      state.storyDone = true;
    } else {
      M.startMission(state, data.missionIndex || 0);
    }
    state.night = !!data.night;
    E.setMessage(state, 'Welcome back to Solmar Bay.');
  }

  /** Stage one of the four screenshot scenes: place the player, set the mission. */
  function stageShot(state, kind) {
    var p = state.player;
    state.screen = 'play';
    // A fake input that holds the accelerator on driving shots, so they look alive.
    var drivingShot = kind === 'cover' || kind === 'chase' || kind === 'night';
    state.shotInput = {
      actionHeld: function (name) { return drivingShot && name === 'up'; },
      actionPressed: function () { return false; },
      mouse: { x: renderer.view.w / 2, y: renderer.view.h / 2, clicked: false, down: false },
      endFrame: function () {}
    };
    if (kind === 'cover') {
      // Driving a Comet GT down the main drag, traffic around, HUD and minimap up.
      var car = E.makeCar(E.MODELS[0], 600, 1400, 0, 'player');
      state.cars.push(car);
      p.inCar = car; p.x = car.x; p.y = car.y; p.angle = 0;
      car.speed = 150;
      M.startMission(state, 0);
      state.mission.step = 1; // already stolen: "Drive to Vera's Garage"
    } else if (kind === 'mission') {
      // On foot at the Old Port, meeting the contact for mission 2.
      M.startMission(state, 1);
      p.x = 2850; p.y = 900; p.angle = 0;
      p.money = 800;
      E.spawnPed(state); E.spawnPed(state);
    } else if (kind === 'chase') {
      // Three stars, two interceptors on the tail, downtown.
      var chaseCar = E.makeCar(E.MODELS[5], 1400, 1800, 0, 'player');
      state.cars.push(chaseCar);
      p.inCar = chaseCar; p.x = chaseCar.x; p.y = chaseCar.y; p.angle = 0;
      chaseCar.speed = 380;
      p.wanted = 3;
      E.spawnPoliceCar(state);
      E.spawnPoliceCar(state);
      M.startMission(state, 3);
      state.mission.step = 0;
    } else if (kind === 'night') {
      // Night Run: collecting cash drops under the street lights.
      M.startMission(state, 2);
      var nightCar = E.makeCar(E.MODELS[1], 500, 2200, 0, 'player');
      state.cars.push(nightCar);
      p.inCar = nightCar; p.x = nightCar.x; p.y = nightCar.y; p.angle = 0;
      nightCar.speed = 260;
      p.money = 1200;
    }
    // Settle the scene for a second of physics so traffic and cops are mid-chase.
    for (var i = 0; i < 60; i++) updateWorld(state, STEP);
    updateCamera(state);
  }

  /** Keep the camera centred on the player, clamped to the world. */
  function updateCamera(state) {
    var vw = renderer.view.w, vh = renderer.view.h;
    var tx = U.clamp(state.player.x - vw / 2, 0, Math.max(0, C.WORLD - vw));
    var ty = U.clamp(state.player.y - vh / 2, 0, Math.max(0, C.WORLD - vh));
    state.camera.x = U.lerp(state.camera.x, tx, 0.25);
    state.camera.y = U.lerp(state.camera.y, ty, 0.25);
    if (state.shake > 0) {
      state.camera.x += (state.rng() - 0.5) * state.shake;
      state.camera.y += (state.rng() - 0.5) * state.shake;
    }
  }

  /** One fixed step of the playing world. */
  function updateWorld(state, dt) {
    var p = state.player;
    var inp = state.shotInput || input;
    state.time += dt;
    if (p.dead) return;
    // Driving or on foot.
    if (p.inCar) E.updateDriving(state, inp, dt);
    else E.updateOnFoot(state, inp, dt);
    // Steal / leave a car.
    if (inp.actionPressed('enterCar')) {
      if (p.inCar) E.exitCar(state);
      else {
        var near = E.nearestCar(state, p.x, p.y, 60);
        if (near) E.enterCar(state, near);
      }
    }
    // Combat on foot.
    if (!p.inCar) {
      if (inp.actionPressed('punch')) E.tryPunch(state);
      if (inp.mouse.down || inp.mouse.clicked) E.tryShoot(state);
    }
    E.updateTraffic(state, dt);
    E.updatePeds(state, dt);
    E.updatePolice(state, dt);
    M.updateMissions(state, dt);
    E.updateAmbient(state, dt);
    // Engine hum follows the driven car.
    if (state.audio) {
      var driving = !!p.inCar;
      state.audio.setEngine(driving ? Math.abs(p.speed) / 560 : 0, driving);
    }
  }

  /** Menu clicks: the buttons the last render drew. */
  function handleClicks(state) {
    if (!input.mouse.clicked) return;
    var b = hitButton(state.buttons, input.mouse.x, input.mouse.y);
    if (!b) return;
    audio.unlock();
    if (state.screen === 'title') {
      if (b.label === 'HOW TO PLAY') { state.showHelp = true; return; }
      if (b.label === 'BACK') { state.showHelp = false; return; }
      if (b.label === 'CONTINUE') {
        var data = S.loadGame();
        if (data) applySave(state, data);
      } else {
        // New game: reset this same state object in place (the loop holds it).
        var fresh = newGame((Math.random() * 4294967296) >>> 0);
        for (var k in state) { if (Object.prototype.hasOwnProperty.call(state, k)) delete state[k]; }
        for (var k2 in fresh) { if (Object.prototype.hasOwnProperty.call(fresh, k2)) state[k2] = fresh[k2]; }
        window.__solmar = state;
      }
      state.screen = 'play';
      audio.startMusic();
    } else if (state.screen === 'paused') {
      if (b.label === 'RESUME') state.screen = 'play';
      else if (b.label === 'SAVE GAME') {
        S.saveGame(state);
        E.setMessage(state, 'Game saved.');
        state.screen = 'play';
      } else if (b.label === 'QUIT TO TITLE') {
        state.screen = 'title';
        state.showHelp = false;
      }
    } else if (state.screen === 'wasted') {
      if (b.label === 'GET BACK OUT THERE') {
        var idx = state.mission ? state.mission.index : 0;
        state.player.money = Math.max(0, state.player.money - 100);
        E.respawnPlayer(state);
        M.startMission(state, state.storyDone ? 99 : idx);
        state.screen = 'play';
      }
    }
  }

  /** One fixed step of the whole game, by screen. */
  function update(state, dt) {
    // Global keys.
    if (input.actionPressed('mute')) audio.toggleMute();
    if (state.screen === 'play') {
      if (input.actionPressed('pause')) { state.screen = 'paused'; input.endFrame(); return; }
      if (input.actionPressed('save')) {
        S.saveGame(state);
        E.setMessage(state, 'Game saved. (Q)');
      }
      updateWorld(state, dt);
      if (state.player.dead) {
        state.wastedT += dt;
        if (state.wastedT > 1.2) { state.screen = 'wasted'; state.wastedT = 0; }
      }
      updateCamera(state);
    } else if (state.screen === 'title') {
      // A slow drift behind the title, so the menu feels alive.
      state.time += dt;
      state.camera.x = U.clamp(1400 - renderer.view.w / 2 + Math.sin(state.time * 0.1) * 120, 0, C.WORLD - renderer.view.w);
      state.camera.y = U.clamp(1400 - renderer.view.h / 2, 0, C.WORLD - renderer.view.h);
    }
    handleClicks(state);
    // Screen-reader status line.
    if (statusEl && state.mission) {
      var text = 'Solmar Bay. ' + M.missionObjective(state) + ' Money $' + state.player.money + '. Wanted ' + state.player.wanted + ' stars.';
      if (statusEl.textContent !== text) statusEl.textContent = text;
    }
  }

  /** Paint the current screen. */
  function render(state) {
    if (state.screen === 'title') {
      R.renderGame(state, renderer);
      state.buttons = H.drawTitleScreen(renderer, S.hasSave(), state.showHelp);
    } else if (state.screen === 'paused') {
      R.renderGame(state, renderer);
      H.drawHUD(state, renderer);
      state.buttons = H.drawPauseScreen(renderer, state);
    } else if (state.screen === 'wasted') {
      R.renderGame(state, renderer);
      state.buttons = H.drawWastedScreen(renderer);
    } else {
      R.renderGame(state, renderer);
      H.drawHUD(state, renderer);
      state.buttons = [];
    }
  }

  // ---------------------------------------------------------------- boot

  // First gesture unlocks audio (browsers require it).
  window.addEventListener('pointerdown', function () { audio.unlock(); }, { once: true });
  window.addEventListener('keydown', function () { audio.unlock(); }, { once: true });

  // Screenshot staging: skip the title, play the scene, then signal readiness.
  if (shot) {
    stageShot(state, shot);
    state.shotReady = false;
  }

  /** The frame loop: fixed steps, then one paint. */
  var last = performance.now();
  var acc = 0;
  function frame(now) {
    var elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    acc += elapsed;
    var guard = 0;
    while (acc >= STEP && guard < 8) {
      update(state, STEP);
      acc -= STEP;
      guard++;
    }
    if (guard === 8) acc = 0;
    render(state);
    input.endFrame();
    if (shot && !state.shotReady) {
      state.shotFrames++;
      if (state.shotFrames > 45) {
        state.shotReady = true;
        window.__shotReady = true;
      }
    }
    requestAnimationFrame(frame);
  }

  // Debug / test handle: the Playwright checks read the live state from here.
  window.__solmar = state;
  requestAnimationFrame(frame);
})();
