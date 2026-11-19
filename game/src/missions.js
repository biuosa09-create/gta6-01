// Solmar Bay — the story: five missions from Vera Solano that take Milo Kade from
// a nobody with no car to the crew that hits the Solmar Bank. Each mission is a
// list of steps; the controller advances them and tells the HUD what to show.
(function (global) {
  'use strict';
  var U = global.SBUtil;
  var C = global.SBCity;
  var E = global.SBEntities;

  /** The five missions, in story order. */
  function missionList() {
    return [
      {
        id: 'first-wheels', title: '1. First Wheels', reward: 300,
        briefing: "Vera: 'New in Solmar Bay, no car, no cash. Fix that. Take any car on the street — press E next to one — then bring it to my garage.'",
        steps: [
          { type: 'enterCar', label: 'Steal a car (press E next to one)' },
          { type: 'goto', place: 'garage', r: 70, label: "Drive to Vera's Garage" }
        ]
      },
      {
        id: 'the-pickup', title: '2. The Pickup', reward: 500,
        briefing: "Vera: 'A friend at the Old Port is holding a package. Pick it up, drop it at the Marina. The Dockside crew may not like it — handle them.'",
        steps: [
          { type: 'goto', place: 'port', r: 70, label: 'Meet the contact at the Old Port' },
          { type: 'pickup', place: 'port', r: 70, seconds: 1.5, label: 'Pick up the package' },
          { type: 'goto', place: 'marina', r: 70, label: 'Deliver the package to the Marina' },
          { type: 'clear', place: 'marina', r: 200, label: 'Deal with the Dockside crew' }
        ]
      },
      {
        id: 'night-run', title: '3. Night Run', reward: 700,
        briefing: "Vera: 'Three cash drops are stashed around the city. Collect them after dark. The cops are jumpy tonight — keep your head down.'",
        night: true, startWanted: 1,
        steps: [
          { type: 'collect', items: ['cashA', 'cashB', 'cashC'], r: 60, label: 'Collect the 3 cash drops (0/3)' }
        ]
      },
      {
        id: 'hot-pursuit', title: '4. Hot Pursuit', reward: 800,
        briefing: "Vera: 'You are hot — three stars and every interceptor in the city is coming. Lose them, then get to the safehouse in Palm Heights.'",
        startWanted: 3,
        steps: [
          { type: 'loseCops', label: 'Lose the cops (get your wanted level to 0)' },
          { type: 'goto', place: 'safehouse', r: 70, label: 'Reach the Safehouse' }
        ]
      },
      {
        id: 'the-big-score', title: '5. The Big Score', reward: 1500,
        briefing: "Vera: 'The Solmar Bank. Walk in, hold the vault for a few seconds, walk out rich. Then lose four stars of heat and vanish to the safehouse.'",
        steps: [
          { type: 'goto', place: 'bank', r: 70, label: 'Get to the Solmar Bank' },
          { type: 'wait', place: 'bank', r: 70, seconds: 4, label: 'Grab the cash — stay in the vault' },
          { type: 'goto', place: 'safehouse', r: 70, label: 'Escape to the Safehouse' }
        ]
      }
    ];
  }

  /** Start (or restart) mission number idx on the world state. */
  function startMission(state, idx) {
    var list = missionList();
    if (idx >= list.length) { state.mission = null; state.storyDone = true; return; }
    var def = list[idx];
    state.mission = {
      def: def, index: idx, step: 0, stepT: 0, collected: 0,
      hostiles: [], spawned: false
    };
    state.night = !!def.night;
    if (def.startWanted) {
      state.player.wanted = def.startWanted;
      state.player.wantedTimer = 0;
    }
    E.setMessage(state, def.title + ' — ' + def.briefing);
    if (def.id === 'the-big-score') {
      // Two bank guards who open fire once the vault grab starts.
      spawnHostile(state, C.PLACES.bank.x + 60, C.PLACES.bank.y - 40);
      spawnHostile(state, C.PLACES.bank.x - 60, C.PLACES.bank.y + 40);
    }
  }

  /** Spawn one hostile rival at a spot (they shoot at the player). */
  function spawnHostile(state, x, y) {
    var ped = E.makePed(x, y, state.rng);
    ped.hostile = true;
    ped.health = 60;
    ped.color = '#3a3a3a';
    ped.shootT = 1;
    state.peds.push(ped);
    if (state.mission) state.mission.hostiles.push(ped);
    return ped;
  }

  /** Where the mission marker points right now, or null. */
  function missionTarget(state) {
    var m = state.mission;
    if (!m) return null;
    var step = m.def.steps[m.step];
    if (!step) return null;
    if (step.type === 'collect') {
      for (var i = 0; i < step.items.length; i++) {
        var pl = C.PLACES[step.items[i]];
        if (!pl.taken) return { x: pl.x, y: pl.y };
      }
      return null;
    }
    if (step.place) { var p = C.PLACES[step.place]; return { x: p.x, y: p.y }; }
    return null;
  }

  /** The objective line the HUD shows. */
  function missionObjective(state) {
    var m = state.mission;
    if (!m) return state.storyDone ? 'Story complete — free roam Solmar Bay!' : 'No mission. Find Vera at the garage.';
    var step = m.def.steps[m.step];
    if (!step) return m.def.title;
    if (step.type === 'collect') return step.label.replace('(0/3)', '(' + m.collected + '/3)');
    if (step.type === 'wait') return step.label + ' (' + Math.ceil(step.seconds - m.stepT) + 's)';
    return step.label;
  }

  /** Advance the active mission one step; returns true when a mission just finished. */
  function updateMissions(state, dt) {
    var m = state.mission;
    if (!m) return false;
    var p = state.player;
    var step = m.def.steps[m.step];
    if (!step) return false;
    var place = step.place ? C.PLACES[step.place] : null;

    if (step.type === 'enterCar') {
      if (p.inCar) advance(state);
    } else if (step.type === 'goto') {
      if (place && U.dist(p.x, p.y, place.x, place.y) < step.r) advance(state);
    } else if (step.type === 'pickup' || step.type === 'wait') {
      if (place && U.dist(p.x, p.y, place.x, place.y) < step.r) {
        m.stepT += dt;
        if (m.stepT >= step.seconds) {
          if (step.type === 'wait') {
            // The vault grab trips the alarm: four stars.
            E.addWanted(state, 4, 'The alarm is tripped! Four stars!');
          }
          advance(state);
        }
      } else {
        m.stepT = 0;
      }
    } else if (step.type === 'collect') {
      for (var i = 0; i < step.items.length; i++) {
        var key = step.items[i];
        var drop = C.PLACES[key];
        if (!drop.taken && U.dist(p.x, p.y, drop.x, drop.y) < step.r) {
          drop.taken = true;
          m.collected++;
          p.money += 150;
          E.addFloater(state, drop.x, drop.y, '+$150', '#7ae87a');
          if (state.audio) state.audio.coin();
        }
      }
      if (m.collected >= step.items.length) advance(state);
    } else if (step.type === 'loseCops') {
      if (p.wanted === 0) advance(state);
    } else if (step.type === 'clear') {
      if (!m.spawned) {
        m.spawned = true;
        spawnHostile(state, place.x + 50, place.y - 30);
        spawnHostile(state, place.x - 50, place.y + 40);
        E.setMessage(state, 'Dockside crew! Deal with them.');
      }
      var alive = 0;
      for (var j = 0; j < m.hostiles.length; j++) {
        if (m.hostiles[j].state !== 'down') alive++;
      }
      if (alive === 0) advance(state);
    }
    return false;
  }

  /** Move to the next step, or finish the mission with its reward. */
  function advance(state) {
    var m = state.mission;
    m.step++;
    m.stepT = 0;
    if (m.step >= m.def.steps.length) {
      var p = state.player;
      p.money += m.def.reward;
      p.wanted = Math.max(0, p.wanted - 1);
      state.stats.missionsDone++;
      E.setMessage(state, 'Mission complete! ' + m.def.title + ' — +$' + m.def.reward);
      E.addFloater(state, p.x, p.y - 30, '+$' + m.def.reward, '#ffd94a');
      if (state.audio) state.audio.missionDone();
      if (state.audio) state.audio.pickup();
      // Clear the night-run drops for a replay.
      for (var k = 0; k < m.def.steps.length; k++) {
        var s = m.def.steps[k];
        if (s.type === 'collect') {
          for (var i = 0; i < s.items.length; i++) C.PLACES[s.items[i]].taken = false;
        }
      }
      var next = m.index + 1;
      state.night = false;
      startMission(state, next);
      if (state.storyDone) E.setMessage(state, 'STORY COMPLETE — Solmar Bay is yours. Free roam!');
    } else if (state.audio) {
      state.audio.pickup();
    }
  }

  global.SBMissions = {
    missionList: missionList, startMission: startMission,
    missionTarget: missionTarget, missionObjective: missionObjective,
    updateMissions: updateMissions, spawnHostile: spawnHostile
  };
})(typeof window !== 'undefined' ? window : globalThis);
