/**
 * InputController.js
 * Keyboard input handler for Double Dribble-style 8-bit basketball game.
 * Manages key state, edge detection (press vs hold), and movement direction.
 */

const InputController = (() => {
  // -------------------------------------------------------------------
  // Internal state
  // -------------------------------------------------------------------

  /** Raw key state: true while the key is physically held down. */
  const keys = {};

  /**
   * Keys that were newly pressed THIS frame (went down since last update).
   * Cleared at the end of every update() call.
   */
  const _justPressed = {};

  /**
   * Keys that were down on the PREVIOUS frame, used to detect rising edge
   * without relying solely on the event system.
   */
  const _prevKeys = {};

  // Keys that should have their default browser behaviour suppressed.
  const GAME_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'KeyZ', 'KeyJ', 'KeyX', 'KeyK',
    'Enter', 'Space',
  ]);

  let _onKeyDown = null;
  let _onKeyUp   = null;

  // -------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------

  function _handleKeyDown(e) {
    if (GAME_KEYS.has(e.code)) {
      e.preventDefault();
    }

    if (!keys[e.code]) {
      // Rising edge — key was up, now down.
      _justPressed[e.code] = true;
    }

    keys[e.code] = true;
  }

  function _handleKeyUp(e) {
    if (GAME_KEYS.has(e.code)) {
      e.preventDefault();
    }

    keys[e.code]       = false;
    _justPressed[e.code] = false; // can't be "just pressed" if it's up
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  /**
   * Attach keydown/keyup listeners to the document.
   * Call once during game initialisation.
   */
  function init() {
    _onKeyDown = _handleKeyDown;
    _onKeyUp   = _handleKeyUp;
    document.addEventListener('keydown', _onKeyDown);
    document.addEventListener('keyup',   _onKeyUp);
  }

  /**
   * Remove event listeners. Call on game teardown or scene change.
   */
  function destroy() {
    if (_onKeyDown) document.removeEventListener('keydown', _onKeyDown);
    if (_onKeyUp)   document.removeEventListener('keyup',   _onKeyUp);
    _onKeyDown = null;
    _onKeyUp   = null;

    // Clear all state so a re-init starts clean.
    for (const k in keys)        delete keys[k];
    for (const k in _justPressed) delete _justPressed[k];
    for (const k in _prevKeys)    delete _prevKeys[k];
  }

  /**
   * Returns a normalised movement vector.
   * Each axis is -1, 0, or 1.  Diagonal inputs are NOT normalised to unit
   * length intentionally — the game engine can do that if needed, keeping
   * this module simple and predictable.
   *
   * @returns {{ dx: number, dy: number }}
   */
  function getMovement() {
    const up    = keys['ArrowUp']    || keys['KeyW'];
    const down  = keys['ArrowDown']  || keys['KeyS'];
    const left  = keys['ArrowLeft']  || keys['KeyA'];
    const right = keys['ArrowRight'] || keys['KeyD'];

    return {
      dx: (right ? 1 : 0) - (left ? 1 : 0),
      dy: (down  ? 1 : 0) - (up   ? 1 : 0),
    };
  }

  /**
   * True ONLY on the frame the shoot / steal key first goes down.
   * On offense: triggers a shot attempt.
   * On defense: triggers a steal attempt.
   */
  function isShootPressed() {
    return !!(_justPressed['KeyZ'] || _justPressed['KeyJ']);
  }

  /**
   * True ONLY on the frame the pass / switch key first goes down.
   * On offense: pass to nearest open teammate.
   * On defense: switch controlled player.
   */
  function isPassPressed() {
    return !!(_justPressed['KeyX'] || _justPressed['KeyK']);
  }

  /**
   * True while Space is held — applies a 1.5x speed multiplier.
   */
  function isTurbo() {
    return !!keys['Space'];
  }

  /**
   * True ONLY on the frame Enter first goes down.
   */
  function isPausePressed() {
    return !!_justPressed['Enter'];
  }

  /**
   * Call once per game frame AFTER all input has been read.
   * Clears the _justPressed edge-detection set so each press fires exactly once.
   */
  function update() {
    // Snapshot current state into prev, then clear justPressed.
    for (const k in keys) {
      _prevKeys[k] = keys[k];
    }
    for (const k in _justPressed) {
      delete _justPressed[k];
    }
  }

  // -------------------------------------------------------------------
  // Exports
  // -------------------------------------------------------------------

  return {
    /** Raw key state map — read-only by convention. */
    keys,

    init,
    destroy,
    update,

    getMovement,
    isShootPressed,
    isPassPressed,
    isTurbo,
    isPausePressed,
  };
})();

// ES module export — omit if using a plain <script> tag.
// export default InputController;
