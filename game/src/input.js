// Solmar Bay — keyboard and mouse input. Tracks held keys, edge-triggered presses
// (a key that went down since the last frame) and the mouse position in screen space.
(function (global) {
  'use strict';

  /** Action names the game reads, and the keys that trigger each one. */
  var KEYMAP = {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    run: ['ShiftLeft', 'ShiftRight'],
    enterCar: ['KeyE'],
    punch: ['KeyF'],
    handbrake: ['Space'],
    pause: ['KeyP', 'Escape'],
    mute: ['KeyM'],
    save: ['KeyQ']
  };

  function createInput(canvas) {
    var held = {};
    var pressed = {};
    var mouse = { x: 0, y: 0, clicked: false, down: false };

    function codeOf(e) { return e.code || e.key; }

    window.addEventListener('keydown', function (e) {
      var c = codeOf(e);
      if (!held[c]) pressed[c] = true;
      held[c] = true;
      if (c === 'Space' || c.indexOf('Arrow') === 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { held[codeOf(e)] = false; });
    window.addEventListener('blur', function () { held = {}; });
    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      mouse.down = true; mouse.clicked = true;
    });
    window.addEventListener('mouseup', function () { mouse.down = false; });

    /** Is any key of an action held right now? */
    function actionHeld(name) {
      var keys = KEYMAP[name] || [];
      for (var i = 0; i < keys.length; i++) if (held[keys[i]]) return true;
      return false;
    }
    /** Did any key of an action go down since the last frame? */
    function actionPressed(name) {
      var keys = KEYMAP[name] || [];
      for (var i = 0; i < keys.length; i++) if (pressed[keys[i]]) return true;
      return false;
    }

    return {
      mouse: mouse,
      actionHeld: actionHeld,
      actionPressed: actionPressed,
      /** Was a raw key code pressed since the last frame? */
      keyPressed: function (code) { return !!pressed[code]; },
      /** Clear edge-triggered state; call once per frame after the update. */
      endFrame: function () { pressed = {}; mouse.clicked = false; }
    };
  }

  global.SBInput = { createInput: createInput };
})(typeof window !== 'undefined' ? window : globalThis);
