// Solmar Bay — save and load through localStorage. A save holds the money, the
// mission number, the health and the position, so CONTINUE drops the player
// back into the city where they left off.
(function (global) {
  'use strict';

  /** localStorage key for the save. */
  var SAVE_KEY = 'solmarbay.save.v1';

  /** Write the world state to a save slot. Returns true when it stuck. */
  function saveGame(state) {
    try {
      var p = state.player;
      var data = {
        version: 1,
        money: p.money,
        missionIndex: state.mission ? state.mission.index : (state.storyDone ? 99 : 0),
        health: p.health,
        x: p.x, y: p.y,
        night: state.night,
        storyDone: !!state.storyDone,
        stats: state.stats,
        savedAt: new Date().toISOString()
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  /** Read the save slot, or null when there is none / it is unreadable. */
  function loadGame() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.version !== 1) return null;
      return data;
    } catch (e) { return null; }
  }

  /** Is there a save to continue from? */
  function hasSave() { return loadGame() !== null; }

  /** Wipe the save slot. */
  function clearSave() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* no storage */ }
  }

  global.SBSave = { saveGame: saveGame, loadGame: loadGame, hasSave: hasSave, clearSave: clearSave, SAVE_KEY: SAVE_KEY };
})(typeof window !== 'undefined' ? window : globalThis);
