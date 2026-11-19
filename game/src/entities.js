// Solmar Bay — the living city: the player on foot and behind the wheel, traffic
// cars that follow the streets, pedestrians on the sidewalks, police interceptors
// that hunt the wanted, and the combat (punch / shoot) and wanted rules.
(function (global) {
  'use strict';
  var U = global.SBUtil;
  var C = global.SBCity;

  /** Car models: name, colour, top speed and acceleration. */
  var MODELS = [
    { name: 'Comet GT', color: '#d84040', top: 560, accel: 460 },
    { name: 'Palm Sedan', color: '#d8c8a0', top: 430, accel: 340 },
    { name: 'Bison Pickup', color: '#4a7ab8', top: 460, accel: 360 },
    { name: 'Coral Taxi', color: '#e8c832', top: 450, accel: 350 },
    { name: 'Courier Van', color: '#e8e8e8', top: 400, accel: 300 },
    { name: 'Sunset Coupe', color: '#c85a9a', top: 520, accel: 420 }
  ];
  /** Police interceptor model. */
  var POLICE_MODEL = { name: 'Interceptor', color: '#222831', top: 600, accel: 480 };

  /** Make a car entity. driver: 'player' | 'traffic' | 'police' | null (parked). */
  function makeCar(model, x, y, angle, driver) {
    return {
      kind: 'car', model: model, name: model.name, color: model.color,
      x: x, y: y, angle: angle, speed: 0, driver: driver || null,
      steer: 0, w: 44, h: 22, radius: 17,
      // Traffic brains: which street it follows and which way it is going.
      axis: 'x', dir: 1, lane: 0, wait: 0, honk: 0
    };
  }

  /** Make a pedestrian. */
  function makePed(x, y, rng) {
    var shirts = ['#e86a6a', '#6aa8e8', '#6ac86a', '#e8c86a', '#c86ae8', '#e8e8e8', '#7ad8d8'];
    return {
      kind: 'ped', x: x, y: y, angle: rng() * Math.PI * 2, speed: U.range(rng, 45, 75),
      color: U.pick(rng, shirts), radius: 11, state: 'walk',
      // Sidewalk stroll: follow a block edge, turn at the corners.
      edgeX: 0, edgeY: 0, axis: 'x', dir: 1, fleeT: 0, health: 40, shootT: 0, hostile: false
    };
  }

  /** The fresh world state: player, traffic, pedestrians, police, particles. */
  function createWorldState(seed) {
    var rng = U.makeRng(seed);
    var city = C.buildCity(seed);
    var state = {
      seed: seed, rng: rng, city: city, time: 0, night: false,
      player: {
        x: 600, y: 560, angle: -Math.PI / 2, speed: 0, health: 100,
        money: 500, wanted: 0, wantedTimer: 0, inCar: null,
        punchT: 0, shootT: 0, hurtT: 0, regenT: 0, bustedT: 0, dead: false
      },
      cars: [], peds: [], police: [], particles: [], floaters: [],
      crimeFlash: 0, shake: 0, sirenT: 0, mission: null, message: '', messageT: 0,
      stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, missionsDone: 0 }
    };
    // Parked cars from the city's parking lots and kerbside spots.
    for (var i = 0; i < city.parkedSpots.length; i++) {
      var s = city.parkedSpots[i];
      var m = MODELS[i % MODELS.length];
      state.cars.push(makeCar(m, s.x, s.y, s.angle, null));
    }
    // Traffic on the streets.
    for (var t = 0; t < 14; t++) spawnTrafficCar(state);
    // Pedestrians on the sidewalks.
    for (var p = 0; p < 26; p++) spawnPed(state);
    return state;
  }

  /** Put a new traffic car on a random street, driving along it. */
  function spawnTrafficCar(state) {
    var rng = state.rng;
    var p = C.randomRoadPoint(rng);
    var onVertical = Math.abs(p.x - C.nearestCenter(p.x)) < 5;
    var model = U.pick(rng, MODELS);
    var car = makeCar(model, p.x, p.y, 0, 'traffic');
    if (onVertical) {
      car.axis = 'y'; car.dir = rng() < 0.5 ? 1 : -1;
      car.lane = car.dir === 1 ? -22 : 22; // right-hand traffic
      car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      car.x = C.nearestCenter(p.x) + car.lane;
    } else {
      car.axis = 'x'; car.dir = rng() < 0.5 ? 1 : -1;
      car.lane = car.dir === 1 ? 22 : -22;
      car.angle = car.dir === 1 ? 0 : Math.PI;
      car.y = C.nearestCenter(p.y) + car.lane;
    }
    car.speed = U.range(rng, 90, 140);
    state.cars.push(car);
    return car;
  }

  /** Put a pedestrian on a random block edge (a sidewalk). */
  function spawnPed(state) {
    var rng = state.rng;
    var bx = U.rangeInt(rng, 0, 6), by = U.rangeInt(rng, 0, 6);
    var x0 = C.CENTERS[bx] + C.HALF + 8, y0 = C.CENTERS[by] + C.HALF + 8;
    var x1 = C.CENTERS[bx + 1] - C.HALF - 8, y1 = C.CENTERS[by + 1] - C.HALF - 8;
    var ped = makePed(0, 0, rng);
    // Walk along one of the four edges of the block.
    var edge = U.rangeInt(rng, 0, 3);
    if (edge === 0) { ped.x = U.range(rng, x0, x1); ped.y = y0; ped.axis = 'x'; ped.dir = 1; }
    else if (edge === 1) { ped.x = U.range(rng, x0, x1); ped.y = y1; ped.axis = 'x'; ped.dir = -1; }
    else if (edge === 2) { ped.x = x0; ped.y = U.range(rng, y0, y1); ped.axis = 'y'; ped.dir = 1; }
    else { ped.x = x1; ped.y = U.range(rng, y0, y1); ped.axis = 'y'; ped.dir = -1; }
    ped.edgeX = x0; ped.edgeY = y0;
    state.peds.push(ped);
    return ped;
  }

  /** Raise the wanted level (0..5) and flash the stars. */
  function addWanted(state, n, reason) {
    var p = state.player;
    var before = p.wanted;
    p.wanted = U.clamp(p.wanted + n, 0, 5);
    p.wantedTimer = 0;
    if (p.wanted > before) {
      state.crimeFlash = 1;
      setMessage(state, reason || 'The police are on to you!');
    }
  }

  /** A toast message at the top of the screen. */
  function setMessage(state, text) { state.message = text; state.messageT = 3.2; }

  /** A floating "+$50" style label in the world. */
  function addFloater(state, x, y, text, color) {
    state.floaters.push({ x: x, y: y, text: text, color: color || '#ffd94a', t: 1.4 });
  }

  /** Burst of particles (crash sparks, muzzle smoke, dust). */
  function burst(state, x, y, color, n, speed) {
    for (var i = 0; i < n; i++) {
      var a = state.rng() * Math.PI * 2, s = U.range(state.rng, speed * 0.3, speed);
      state.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.range(state.rng, 0.25, 0.7), max: 0.7, color: color, size: U.range(state.rng, 2, 5) });
    }
  }

  /** Nearest car to a point within maxDist, or null. */
  function nearestCar(state, x, y, maxDist) {
    var best = null, bd = maxDist * maxDist;
    for (var i = 0; i < state.cars.length; i++) {
      var c = state.cars[i];
      var d2 = U.dist2(x, y, c.x, c.y);
      if (d2 < bd) { bd = d2; best = c; }
    }
    return best;
  }

  /** Steal / enter a car: eject its driver if it has one, raise the wanted level. */
  function enterCar(state, car) {
    var p = state.player;
    if (car.driver === 'traffic') {
      // Yank the driver out: they become a fleeing pedestrian.
      var ped = makePed(car.x + 30, car.y + 30, state.rng);
      ped.state = 'flee'; ped.fleeT = 4;
      state.peds.push(ped);
      addWanted(state, 1, 'Car stolen! Wanted level up.');
      state.stats.carsStolen++;
    }
    car.driver = 'player';
    p.inCar = car;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    return car;
  }

  /** Step out of the car, leaving it parked where it stands. */
  function exitCar(state) {
    var p = state.player;
    var car = p.inCar;
    if (!car) return;
    car.driver = null;
    car.speed = 0;
    var side = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(side) * 34;
    p.y = car.y + Math.sin(side) * 34;
    var fixed = C.collideCircle(state.city, p.x, p.y, 12);
    p.x = fixed.x; p.y = fixed.y;
    p.inCar = null;
    p.speed = 0;
  }

  /** Hurt the player; returns true if the player just died. */
  function damagePlayer(state, amount) {
    var p = state.player;
    if (p.dead) return false;
    p.health -= amount;
    p.hurtT = 0.6; p.regenT = 0;
    state.shake = Math.max(state.shake, 6);
    if (p.health <= 0) { p.health = 0; p.dead = true; return true; }
    return false;
  }

  // ---------------------------------------------------------------- updates

  /** Drive the player's car: arcade acceleration, steering, collisions, skid. */
  function updateDriving(state, input, dt) {
    var p = state.player, car = p.inCar;
    var accel = 0;
    if (input.actionHeld('up')) accel = car.model.accel;
    if (input.actionHeld('down')) accel = car.speed > 10 ? -car.model.accel * 1.4 : -car.model.accel * 0.55;
    var steer = 0;
    if (input.actionHeld('left')) steer = -1;
    if (input.actionHeld('right')) steer = 1;
    var handbrake = input.actionHeld('handbrake');
    car.speed += accel * dt;
    // Drag and rolling resistance; handbrake slides the car.
    car.speed -= car.speed * (handbrake ? 1.6 : 0.35) * dt;
    car.speed = U.clamp(car.speed, -car.model.top * 0.35, car.model.top);
    if (Math.abs(car.speed) < 4 && accel === 0) car.speed = 0;
    var turn = steer * U.clamp(Math.abs(car.speed) / 140, 0, 1) * 2.4 * (car.speed < 0 ? -1 : 1);
    car.angle += turn * dt;
    var nx = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny = car.y + Math.sin(car.angle) * car.speed * dt;
    var fixed = C.collideCircle(state.city, nx, ny, car.radius);
    if (fixed.hit && Math.abs(car.speed) > 120) {
      burst(state, nx, ny, '#ffcf4a', 10, 160);
      state.shake = Math.max(state.shake, 5);
      if (state.audio) state.audio.crash();
      car.speed *= 0.45;
    } else if (fixed.hit) {
      car.speed *= 0.7;
    }
    car.x = fixed.x; car.y = fixed.y;
    if (handbrake && Math.abs(car.speed) > 150 && state.rng() < 0.5) {
      burst(state, car.x, car.y, '#b8b8b8', 2, 40);
    }
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
    // Running over a pedestrian is a crime (and slows the car a little).
    for (var i = 0; i < state.peds.length; i++) {
      var ped = state.peds[i];
      if (ped.state === 'down') continue;
      if (U.dist2(car.x, car.y, ped.x, ped.y) < 26 * 26 && Math.abs(car.speed) > 60) {
        ped.state = 'down';
        burst(state, ped.x, ped.y, '#e86a6a', 8, 120);
        addWanted(state, 1, 'Pedestrian hit! Wanted level up.');
        state.stats.pedsHit++;
        car.speed *= 0.8;
      }
    }
    // Bumping traffic cars: a shove, a spark, and a grumpy horn.
    for (var j = 0; j < state.cars.length; j++) {
      var other = state.cars[j];
      if (other === car || other.driver === 'police') continue;
      var d2 = U.dist2(car.x, car.y, other.x, other.y);
      if (d2 < 40 * 40) {
        var d = Math.sqrt(d2) || 1;
        var push = (40 - d) / 2;
        var px = (other.x - car.x) / d * push, py = (other.y - car.y) / d * push;
        other.x += px; other.y += py;
        car.x -= px; car.y -= py;
        if (Math.abs(car.speed) > 200) {
          burst(state, (car.x + other.x) / 2, (car.y + other.y) / 2, '#ffd94a', 6, 140);
          other.speed = car.speed * 0.3;
        }
      }
    }
  }

  /** Move the player on foot: walk / run, face the mouse, collide with the city. */
  function updateOnFoot(state, input, dt) {
    var p = state.player;
    var mx = 0, my = 0;
    if (input.actionHeld('up')) my -= 1;
    if (input.actionHeld('down')) my += 1;
    if (input.actionHeld('left')) mx -= 1;
    if (input.actionHeld('right')) mx += 1;
    var running = input.actionHeld('run');
    var speed = running ? 320 : 205;
    if (mx !== 0 || my !== 0) {
      var len = Math.sqrt(mx * mx + my * my);
      mx /= len; my /= len;
      var nx = p.x + mx * speed * dt, ny = p.y + my * speed * dt;
      var fixed = C.collideCircle(state.city, nx, ny, 12);
      p.x = fixed.x; p.y = fixed.y;
      p.speed = speed;
      p.angle = Math.atan2(my, mx);
    } else {
      p.speed = 0;
    }
    // Aim at the mouse when the player is about to shoot.
    if (input.mouse.down || input.actionHeld('punch')) {
      var wx = state.camera.x + input.mouse.x, wy = state.camera.y + input.mouse.y;
      p.angle = Math.atan2(wy - p.y, wx - p.x);
    }
  }

  /** Punch: a short-range arc in front of the player. */
  function tryPunch(state) {
    var p = state.player;
    if (p.punchT > 0 || p.inCar) return;
    p.punchT = 0.35;
    if (state.audio) state.audio.punch();
    var hx = p.x + Math.cos(p.angle) * 30, hy = p.y + Math.sin(p.angle) * 30;
    burst(state, hx, hy, '#ffffff', 4, 80);
    for (var i = 0; i < state.peds.length; i++) {
      var ped = state.peds[i];
      if (ped.state === 'down') continue;
      if (U.dist2(hx, hy, ped.x, ped.y) < 34 * 34) {
        ped.health -= 25;
        ped.state = 'flee'; ped.fleeT = 3;
        ped.x += Math.cos(p.angle) * 14; ped.y += Math.sin(p.angle) * 14;
        if (ped.health <= 0) { ped.state = 'down'; addWanted(state, 1, 'Assault! Wanted level up.'); }
      }
    }
    // Punching a cop is a very bad idea.
    for (var j = 0; j < state.police.length; j++) {
      var cop = state.police[j];
      if (U.dist2(hx, hy, cop.x, cop.y) < 40 * 40) {
        addWanted(state, 1, 'You hit a cop! Wanted level up.');
        cop.speed += 120;
      }
    }
  }

  /** Shoot toward the mouse: hitscan, tracer, and a wanted star when the cops see it. */
  function tryShoot(state) {
    var p = state.player;
    if (p.shootT > 0 || p.inCar) return;
    p.shootT = 0.22;
    state.stats.shotsFired++;
    if (state.audio) state.audio.shoot();
    var wx = state.camera.x + state.input.mouse.x, wy = state.camera.y + state.input.mouse.y;
    var a = Math.atan2(wy - p.y, wx - p.x);
    var range = 430, hitX = p.x + Math.cos(a) * range, hitY = p.y + Math.sin(a) * range;
    var hitPed = null, best = range;
    for (var i = 0; i < state.peds.length; i++) {
      var ped = state.peds[i];
      if (ped.state === 'down') continue;
      var dx = ped.x - p.x, dy = ped.y - p.y;
      var along = dx * Math.cos(a) + dy * Math.sin(a);
      if (along < 0 || along > range) continue;
      var perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
      if (perp < 16 && along < best) { best = along; hitPed = ped; }
    }
    if (hitPed) {
      hitX = hitPed.x; hitY = hitPed.y;
      hitPed.health -= 34;
      hitPed.state = 'flee'; hitPed.fleeT = 3;
      burst(state, hitX, hitY, '#e86a6a', 8, 120);
      if (hitPed.health <= 0) { hitPed.state = 'down'; addWanted(state, 1, 'Someone got shot! Wanted level up.'); }
    } else {
      burst(state, hitX, hitY, '#ffd94a', 3, 60);
    }
    // Tracer particle line from the muzzle.
    state.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.08, max: 0.08, color: '#ffe9a0', size: 3, tx: hitX, ty: hitY, tracer: true });
    var mx = p.x + Math.cos(a) * 22, my = p.y + Math.sin(a) * 22;
    burst(state, mx, my, '#fff2b0', 3, 60);
    // Firing a gun in public always draws attention.
    if (state.police.length > 0 || state.rng() < 0.5) addWanted(state, 1, 'Shots fired! Wanted level up.');
    // Nearby pedestrians flee from the noise.
    for (var j = 0; j < state.peds.length; j++) {
      var q = state.peds[j];
      if (U.dist2(p.x, p.y, q.x, q.y) < 300 * 300 && q.state !== 'down') { q.state = 'flee'; q.fleeT = 3; }
    }
  }

  /** Spawn one police interceptor on a street near the player. */
  function spawnPoliceCar(state) {
    var p = state.player;
    var rng = state.rng;
    var tries = 0, x = p.x, y = p.y;
    while (tries < 12) {
      var a = rng() * Math.PI * 2, d = U.range(rng, 420, 700);
      var cx = p.x + Math.cos(a) * d, cy = p.y + Math.sin(a) * d;
      cx = U.clamp(cx, 120, C.WORLD - 120); cy = U.clamp(cy, 120, C.WORLD - 120);
      if (C.isRoadPoint(cx, cy)) { x = C.nearestCenter(cx); y = C.nearestCenter(cy); break; }
      tries++;
    }
    var car = makeCar(POLICE_MODEL, x, y, 0, 'police');
    car.speed = 200;
    state.police.push(car);
    state.cars.push(car);
    return car;
  }

  /** Police AI: chase the player, ram them, and try to bust them on foot. */
  function updatePolice(state, dt) {
    var p = state.player;
    var want = p.wanted === 0 ? 0 : (p.wanted <= 2 ? 1 : p.wanted === 3 ? 2 : p.wanted === 4 ? 3 : 4);
    while (state.police.length < want) spawnPoliceCar(state);
    while (state.police.length > want) {
      var gone = state.police.pop();
      var idx = state.cars.indexOf(gone);
      if (idx >= 0) state.cars.splice(idx, 1);
    }
    for (var i = 0; i < state.police.length; i++) {
      var cop = state.police[i];
      var d = U.dist(cop.x, cop.y, p.x, p.y);
      var targetA = Math.atan2(p.y - cop.y, p.x - cop.x);
      var diff = U.angleDiff(cop.angle, targetA);
      cop.angle += U.clamp(diff, -2.6 * dt, 2.6 * dt);
      var wantSpeed = d > 260 ? cop.model.top : cop.model.top * 0.75;
      cop.speed += (wantSpeed - cop.speed) * dt * 0.9;
      var nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
      var ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
      var fixed = C.collideCircle(state.city, nx, ny, cop.radius);
      if (fixed.hit) cop.speed *= 0.5;
      cop.x = fixed.x; cop.y = fixed.y;
      // Ram the player's car or the player.
      if (p.inCar) {
        if (U.dist2(cop.x, cop.y, p.x, p.y) < 44 * 44) {
          p.inCar.speed *= 0.92;
          if (cop.speed > 200) {
            burst(state, (cop.x + p.x) / 2, (cop.y + p.y) / 2, '#ffd94a', 6, 140);
            state.shake = Math.max(state.shake, 4);
            damagePlayer(state, 4);
          }
        }
      } else if (d < 46) {
        // On foot and caught: the bust timer runs.
        p.bustedT += dt;
        if (p.bustedT > 2.0) {
          p.bustedT = 0;
          p.money = Math.max(0, p.money - 150);
          p.wanted = 0;
          setMessage(state, 'BUSTED! The cops took $150 and let you go.');
          if (state.audio) state.audio.busted();
          respawnPlayer(state);
        }
      } else {
        p.bustedT = Math.max(0, p.bustedT - dt);
      }
    }
    // Siren wail while any chase is on.
    state.sirenT -= dt;
    if (state.police.length > 0 && state.sirenT <= 0) {
      state.sirenT = 0.9;
      if (state.audio) state.audio.siren();
    }
  }

  /** Traffic AI: cruise its street, turn at intersections, slow for the car ahead. */
  function updateTraffic(state, dt) {
    for (var i = 0; i < state.cars.length; i++) {
      var car = state.cars[i];
      if (car.driver !== 'traffic') continue;
      // Slow down for the car directly ahead.
      var ahead = null, best = 90;
      for (var j = 0; j < state.cars.length; j++) {
        var o = state.cars[j];
        if (o === car) continue;
        var dx = o.x - car.x, dy = o.y - car.y;
        var along = car.axis === 'x' ? dx * car.dir : dy * car.dir;
        var perp = car.axis === 'x' ? Math.abs(dy) : Math.abs(dx);
        if (along > 0 && along < 90 && perp < 30 && along < best) { best = along; ahead = o; }
      }
      var target = ahead ? Math.max(0, ahead.speed) : 120;
      car.speed += (target - car.speed) * dt * 1.5;
      car.speed = U.clamp(car.speed, 0, 150);
      // At an intersection, maybe turn onto the cross street.
      var cx = C.nearestCenter(car.x), cy = C.nearestCenter(car.y);
      var nearX = Math.abs(car.x - cx) < 14, nearY = Math.abs(car.y - cy) < 14;
      if (nearX && nearY && car.wait <= 0) {
        car.wait = 0.5;
        var r = state.rng();
        if (r < 0.16) {
          // Turn: switch axis, keep the lane on the right side.
          if (car.axis === 'x') {
            car.axis = 'y'; car.dir = car.dir === 1 ? (state.rng() < 0.5 ? 1 : -1) : (state.rng() < 0.5 ? 1 : -1);
            car.lane = car.dir === 1 ? -22 : 22;
            car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
            car.x = cx + car.lane;
          } else {
            car.axis = 'x'; car.dir = state.rng() < 0.5 ? 1 : -1;
            car.lane = car.dir === 1 ? 22 : -22;
            car.angle = car.dir === 1 ? 0 : Math.PI;
            car.y = cy + car.lane;
          }
        }
      }
      car.wait -= dt;
      var nx = car.x + Math.cos(car.angle) * car.speed * dt;
      var ny = car.y + Math.sin(car.angle) * car.speed * dt;
      // Stay on the street: nudge back onto the centreline if it drifts.
      if (car.axis === 'x') ny = cy + car.lane;
      else nx = cx + car.lane;
      var fixed = C.collideCircle(state.city, nx, ny, car.radius);
      car.x = fixed.x; car.y = fixed.y;
      // Wrap around the world edge so traffic never runs out.
      if (car.x < 60) car.x = C.WORLD - 60;
      if (car.x > C.WORLD - 60) car.x = 60;
      if (car.y < 60) car.y = C.WORLD - 60;
      if (car.y > C.WORLD - 60) car.y = 60;
    }
  }

  /** Pedestrian AI: stroll the sidewalks, flee from danger, get back up slowly. */
  function updatePeds(state, dt) {
    var p = state.player;
    for (var i = 0; i < state.peds.length; i++) {
      var ped = state.peds[i];
      if (ped.state === 'down') continue;
      if (ped.state === 'flee') {
        ped.fleeT -= dt;
        var a = Math.atan2(ped.y - p.y, ped.x - p.x);
        ped.angle = a;
        ped.x += Math.cos(a) * 150 * dt;
        ped.y += Math.sin(a) * 150 * dt;
        var f = C.collideCircle(state.city, ped.x, ped.y, ped.radius);
        ped.x = f.x; ped.y = f.y;
        if (ped.fleeT <= 0) ped.state = 'walk';
        continue;
      }
      if (ped.hostile) {
        // Rival gang member: walk at the player and shoot when close.
        var d = U.dist(ped.x, ped.y, p.x, p.y);
        if (d < 380) {
          ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
          ped.shootT -= dt;
          if (d > 120) {
            ped.x += Math.cos(ped.angle) * 110 * dt;
            ped.y += Math.sin(ped.angle) * 110 * dt;
          }
          if (ped.shootT <= 0 && d < 380) {
            ped.shootT = 1.3;
            burst(state, ped.x, ped.y, '#fff2b0', 3, 60);
            if (state.rng() < 0.55) damagePlayer(state, 8);
          }
        }
        continue;
      }
      // Stroll along the block edge; turn at the corners.
      var speed = ped.speed;
      if (ped.axis === 'x') {
        ped.x += ped.dir * speed * dt;
        ped.angle = ped.dir === 1 ? 0 : Math.PI;
        var bx = Math.floor((ped.x - C.HALF) / C.PITCH);
        var edgeMax = C.CENTERS[Math.min(bx + 1, 7)] - C.HALF - 8;
        var edgeMin = C.CENTERS[Math.max(bx, 0)] + C.HALF + 8;
        if (ped.x > edgeMax || ped.x < edgeMin) { ped.dir *= -1; ped.x = U.clamp(ped.x, edgeMin, edgeMax); }
      } else {
        ped.y += ped.dir * speed * dt;
        ped.angle = ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
        var by = Math.floor((ped.y - C.HALF) / C.PITCH);
        var eMax = C.CENTERS[Math.min(by + 1, 7)] - C.HALF - 8;
        var eMin = C.CENTERS[Math.max(by, 0)] + C.HALF + 8;
        if (ped.y > eMax || ped.y < eMin) { ped.dir *= -1; ped.y = U.clamp(ped.y, eMin, eMax); }
      }
      // A fast car nearby scares pedestrians onto the sidewalk.
      if (p.inCar && Math.abs(p.speed) > 250 && U.dist2(p.x, p.y, ped.x, ped.y) < 120 * 120) {
        ped.state = 'flee'; ped.fleeT = 2;
      }
    }
  }

  /** Particles, floaters, wanted decay, health regen, timers. */
  function updateAmbient(state, dt) {
    var p = state.player;
    for (var i = state.particles.length - 1; i >= 0; i--) {
      var pt = state.particles[i];
      pt.life -= dt;
      pt.x += (pt.vx || 0) * dt; pt.y += (pt.vy || 0) * dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (var j = state.floaters.length - 1; j >= 0; j--) {
      var fl = state.floaters[j];
      fl.t -= dt; fl.y -= 30 * dt;
      if (fl.t <= 0) state.floaters.splice(j, 1);
    }
    if (state.messageT > 0) state.messageT -= dt;
    if (state.crimeFlash > 0) state.crimeFlash -= dt * 2;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);
    p.punchT = Math.max(0, p.punchT - dt);
    p.shootT = Math.max(0, p.shootT - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    // Health regens after a few calm seconds.
    p.regenT += dt;
    if (p.regenT > 5 && p.health > 0 && p.health < 100) p.health = Math.min(100, p.health + 3 * dt);
    // Wanted fades when the player keeps their nose clean and the cops lose them.
    if (p.wanted > 0) {
      p.wantedTimer += dt;
      var nearestCop = 9999;
      for (var k = 0; k < state.police.length; k++) {
        nearestCop = Math.min(nearestCop, U.dist(state.police[k].x, state.police[k].y, p.x, p.y));
      }
      if (p.wantedTimer > 18 && (state.police.length === 0 || nearestCop > 550)) {
        p.wanted--;
        p.wantedTimer = 0;
        if (p.wanted === 0) setMessage(state, 'You lost them. The heat is off.');
      }
    }
  }

  /** Send the player back to the hospital after being wasted or busted. */
  function respawnPlayer(state) {
    var p = state.player;
    if (p.inCar) { p.inCar.driver = null; p.inCar.speed = 0; p.inCar = null; }
    var h = C.PLACES.hospital;
    p.x = h.x; p.y = h.y + 60; p.angle = -Math.PI / 2;
    p.health = 100; p.dead = false; p.wanted = 0; p.bustedT = 0;
  }

  global.SBEntities = {
    MODELS: MODELS, POLICE_MODEL: POLICE_MODEL,
    createWorldState: createWorldState, makeCar: makeCar, makePed: makePed,
    spawnTrafficCar: spawnTrafficCar, spawnPed: spawnPed,
    addWanted: addWanted, setMessage: setMessage, addFloater: addFloater,
    burst: burst, nearestCar: nearestCar, enterCar: enterCar, exitCar: exitCar,
    damagePlayer: damagePlayer, tryPunch: tryPunch, tryShoot: tryShoot,
    spawnPoliceCar: spawnPoliceCar, updatePolice: updatePolice,
    updateTraffic: updateTraffic, updatePeds: updatePeds,
    updateAmbient: updateAmbient, updateDriving: updateDriving,
    updateOnFoot: updateOnFoot, respawnPlayer: respawnPlayer
  };
})(typeof window !== 'undefined' ? window : globalThis);
