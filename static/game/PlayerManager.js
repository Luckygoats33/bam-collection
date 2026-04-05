/**
 * PlayerManager.js
 * Double Dribble-style 8-bit basketball game — player management module.
 *
 * Court: 256x240
 * Out of bounds: 8px border on each side (playable area: 8 < x < 248, 8 < y < 232)
 * Left hoop:  x=24,  y=120
 * Right hoop: x=232, y=120
 */

const PlayerManager = (() => {

  // ─── Constants ────────────────────────────────────────────────────────────

  const COURT_MIN_X   = 8;
  const COURT_MAX_X   = 248;
  const COURT_MIN_Y   = 8;
  const COURT_MAX_Y   = 232;

  const PLAYER_RADIUS       = 5;          // half-width for collision purposes
  const COLLISION_DISTANCE  = 10;         // push apart if closer than this
  const STEAL_RANGE         = 14;         // max px to attempt steal
  const STEAL_CHANCE        = 0.12;       // 12% base probability
  const STEAL_COOLDOWN_MAX  = 60;         // frames before the same player can steal again
  const TURBO_MULTIPLIER    = 1.5;
  const WALK_FRAME_INTERVAL = 8;          // advance animation frame every N game-frames
  const WALK_FRAME_COUNT    = 4;          // number of walk animation frames (0-3)

  const LEFT_HOOP  = { x: 24,  y: 120 };
  const RIGHT_HOOP = { x: 232, y: 120 };

  // ─── Player factory ───────────────────────────────────────────────────────

  /**
   * Create a single player object.
   * @param {number} x
   * @param {number} y
   * @param {'home'|'away'} team
   * @param {number} index  0-4
   * @returns {object}
   */
  function _makePlayer(x, y, team, index) {
    return {
      x,
      y,
      team,
      index,
      speed:         1.2,
      hasBall:       false,
      direction:     team === 'home' ? 'right' : 'left',
      frame:         0,
      frameTimer:    0,
      shooting:      false,
      shootTimer:    0,
      stealCooldown: 0,
    };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * createPlayers()
   * Returns an array of 10 players in tip-off starting positions.
   *
   * Home (left side):
   *   PG  → (60, 120)
   *   SG  → (50,  70)
   *   SF  → (50, 170)
   *   PF  → (30,  90)
   *   C   → (30, 150)
   *
   * Away (right side): x mirrored across center (256)
   *   mirror formula: x' = 256 - x
   */
  function createPlayers() {
    const homePositions = [
      { x: 60, y: 120 },  // 0 PG
      { x: 50, y:  70 },  // 1 SG
      { x: 50, y: 170 },  // 2 SF
      { x: 30, y:  90 },  // 3 PF
      { x: 30, y: 150 },  // 4 C
    ];

    const players = [];

    homePositions.forEach((pos, i) => {
      players.push(_makePlayer(pos.x, pos.y, 'home', i));
      players.push(_makePlayer(256 - pos.x, pos.y, 'away', i));
    });

    // Sort so home[0-4] come before away[0-4] for predictable indexing.
    // Order: home 0,1,2,3,4 then away 0,1,2,3,4
    players.sort((a, b) => {
      if (a.team !== b.team) return a.team === 'home' ? -1 : 1;
      return a.index - b.index;
    });

    return players;
  }

  /**
   * movePlayer(player, dx, dy, turbo)
   * Moves `player` by (dx, dy) scaled by speed (and turbo if truthy).
   * Clamps to in-bounds. Resolves collisions against all OTHER players
   * stored on the module-level roster passed as the last argument.
   *
   * Because the caller needs to pass the full roster for collision,
   * signature is: movePlayer(player, dx, dy, turbo, allPlayers)
   *
   * @param {object}   player
   * @param {number}   dx          raw x direction (-1 to 1 range typical)
   * @param {number}   dy          raw y direction
   * @param {boolean}  turbo
   * @param {object[]} allPlayers  full 10-player roster
   */
  function movePlayer(player, dx, dy, turbo, allPlayers) {
    const spd = player.speed * (turbo ? TURBO_MULTIPLIER : 1);

    let nx = player.x + dx * spd;
    let ny = player.y + dy * spd;

    // ── Bounds clamp ──────────────────────────────────────────────────────
    nx = Math.max(COURT_MIN_X + PLAYER_RADIUS, Math.min(COURT_MAX_X - PLAYER_RADIUS, nx));
    ny = Math.max(COURT_MIN_Y + PLAYER_RADIUS, Math.min(COURT_MAX_Y - PLAYER_RADIUS, ny));

    // ── Player collision (push-apart) ─────────────────────────────────────
    if (allPlayers) {
      for (const other of allPlayers) {
        if (other === player) continue;

        const ddx = nx - other.x;
        const ddy = ny - other.y;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);

        if (dist < COLLISION_DISTANCE && dist > 0) {
          // Push this player away so they don't overlap
          const overlap = COLLISION_DISTANCE - dist;
          const normX   = ddx / dist;
          const normY   = ddy / dist;
          nx += normX * overlap * 0.5;
          ny += normY * overlap * 0.5;

          // Re-clamp after push
          nx = Math.max(COURT_MIN_X + PLAYER_RADIUS, Math.min(COURT_MAX_X - PLAYER_RADIUS, nx));
          ny = Math.max(COURT_MIN_Y + PLAYER_RADIUS, Math.min(COURT_MAX_Y - PLAYER_RADIUS, ny));
        }
      }
    }

    player.x = nx;
    player.y = ny;

    // ── Direction ─────────────────────────────────────────────────────────
    const moving = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
    if (moving) {
      // 8-directional facing stored as cardinal + diagonal strings
      if (Math.abs(dx) >= Math.abs(dy)) {
        player.direction = dx > 0 ? 'right' : 'left';
      } else {
        player.direction = dy > 0 ? 'down' : 'up';
      }
    }

    // ── Walk animation ────────────────────────────────────────────────────
    if (moving) {
      player.frameTimer++;
      if (player.frameTimer >= WALK_FRAME_INTERVAL) {
        player.frameTimer = 0;
        player.frame = (player.frame + 1) % WALK_FRAME_COUNT;
      }
    } else {
      // Idle — reset to standing frame
      player.frame      = 0;
      player.frameTimer = 0;
    }

    // ── Tick cooldowns ────────────────────────────────────────────────────
    if (player.stealCooldown > 0) {
      player.stealCooldown--;
    }
  }

  /**
   * findNearestTeammate(player, players)
   * Returns the closest same-team player who does NOT currently have the ball.
   * Returns null if no valid teammate exists.
   *
   * @param {object}   player
   * @param {object[]} players
   * @returns {object|null}
   */
  function findNearestTeammate(player, players) {
    let nearest = null;
    let bestDist = Infinity;

    for (const p of players) {
      if (p === player)          continue;
      if (p.team !== player.team) continue;
      if (p.hasBall)             continue;

      const d = _dist(player, p);
      if (d < bestDist) {
        bestDist = d;
        nearest  = p;
      }
    }

    return nearest;
  }

  /**
   * findNearestOpponent(player, players)
   * Returns the closest player on the opposing team.
   * Returns null if none.
   *
   * @param {object}   player
   * @param {object[]} players
   * @returns {object|null}
   */
  function findNearestOpponent(player, players) {
    let nearest = null;
    let bestDist = Infinity;

    for (const p of players) {
      if (p.team === player.team) continue;

      const d = _dist(player, p);
      if (d < bestDist) {
        bestDist = d;
        nearest  = p;
      }
    }

    return nearest;
  }

  /**
   * attemptSteal(stealer, ballHolder)
   * Tries to steal the ball. Returns true on success.
   * Fails silently (returns false) if:
   *   - stealer is on cooldown
   *   - distance > STEAL_RANGE
   *   - random check fails (88% of the time)
   * On success, sets stealer.stealCooldown to prevent spam.
   *
   * @param {object} stealer
   * @param {object} ballHolder
   * @returns {boolean}
   */
  function attemptSteal(stealer, ballHolder) {
    if (stealer.stealCooldown > 0)           return false;
    if (!ballHolder || !ballHolder.hasBall)  return false;
    if (stealer.team === ballHolder.team)    return false;

    const d = _dist(stealer, ballHolder);
    if (d > STEAL_RANGE)                     return false;

    if (Math.random() < STEAL_CHANCE) {
      stealer.stealCooldown = STEAL_COOLDOWN_MAX;
      return true;
    }

    return false;
  }

  /**
   * switchControlled(players, currentIndex, team)
   * Returns the index (within `players`) of the next teammate to control.
   * Cycles to the teammate closest to the ball-handler, excluding the
   * current player. If no other teammate exists, returns currentIndex.
   *
   * @param {object[]} players
   * @param {number}   currentIndex  index in `players` array of current player
   * @param {'home'|'away'} team
   * @returns {number}
   */
  function switchControlled(players, currentIndex, team) {
    const current = players[currentIndex];
    if (!current) return currentIndex;

    let bestIdx  = currentIndex;
    let bestDist = Infinity;

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (i === currentIndex)    continue;
      if (p.team !== team)       continue;

      const d = _dist(current, p);
      if (d < bestDist) {
        bestDist = d;
        bestIdx  = i;
      }
    }

    return bestIdx;
  }

  /**
   * resetPositions(players, possession)
   * Snaps all players to offensive/defensive formations based on who has the ball.
   *
   * @param {object[]}      players
   * @param {'home'|'away'} possession  which team currently holds the ball
   */
  function resetPositions(players, possession) {
    // The team WITH the ball attacks the opponent's hoop.
    // Home attacks RIGHT hoop → offense on 'right'.
    // Away attacks LEFT  hoop → offense on 'left'.
    const homeOffense = possession === 'home';

    const homeSide = homeOffense ? 'right' : 'left';
    const awaySide = homeOffense ? 'left'  : 'right';

    const homeOffPos = getOffensivePositions(homeSide);
    const awayDefPos = getDefensivePositions(awaySide);

    const homePlayers = players.filter(p => p.team === 'home').sort((a, b) => a.index - b.index);
    const awayPlayers = players.filter(p => p.team === 'away').sort((a, b) => a.index - b.index);

    homePlayers.forEach((p, i) => {
      p.x = homeOffPos[i].x;
      p.y = homeOffPos[i].y;
    });

    awayPlayers.forEach((p, i) => {
      p.x = awayDefPos[i].x;
      p.y = awayDefPos[i].y;
    });
  }

  /**
   * getOffensivePositions(side)
   * Returns 5 {x, y} positions for an offensive setup on the given side.
   * 'right' = attacking the right hoop (x=232), 'left' = attacking left hoop (x=24).
   *
   * Formation: PG at top of key, SG/SF on wings, PF/C in the post.
   *
   * @param {'left'|'right'} side
   * @returns {{x:number, y:number}[]}
   */
  function getOffensivePositions(side) {
    // Defined for 'right' side (attacking x=232 hoop), then mirror for 'left'.
    const positions = [
      { x: 180, y: 120 },  // 0 PG  — top of key
      { x: 170, y:  75 },  // 1 SG  — right wing
      { x: 170, y: 165 },  // 2 SF  — left wing
      { x: 210, y:  95 },  // 3 PF  — high post right
      { x: 210, y: 145 },  // 4 C   — high post left
    ];

    if (side === 'left') {
      return positions.map(p => ({ x: 256 - p.x, y: p.y }));
    }
    return positions;
  }

  /**
   * getDefensivePositions(side)
   * Returns 5 {x, y} positions for a defensive setup guarding the given side.
   * 'left' = defending left hoop (x=24), 'right' = defending right hoop (x=232).
   *
   * Formation: man-to-man shell — players drop between ball and basket.
   *
   * @param {'left'|'right'} side
   * @returns {{x:number, y:number}[]}
   */
  function getDefensivePositions(side) {
    // Defined for 'left' side (defending x=24 hoop), then mirror for 'right'.
    const positions = [
      { x:  80, y: 120 },  // 0 PG  — top of key, pressures ball
      { x:  70, y:  80 },  // 1 SG  — wing denial
      { x:  70, y: 160 },  // 2 SF  — wing denial
      { x:  45, y:  95 },  // 3 PF  — low block help
      { x:  45, y: 145 },  // 4 C   — paint anchor
    ];

    if (side === 'right') {
      return positions.map(p => ({ x: 256 - p.x, y: p.y }));
    }
    return positions;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Euclidean distance between two players (or any {x,y} objects).
   * @param {{x:number,y:number}} a
   * @param {{x:number,y:number}} b
   * @returns {number}
   */
  function _dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ─── Exports ──────────────────────────────────────────────────────────────

  return {
    createPlayers,
    movePlayer,
    findNearestTeammate,
    findNearestOpponent,
    attemptSteal,
    switchControlled,
    resetPositions,
    getOffensivePositions,
    getDefensivePositions,

    // Expose constants so the game loop can reference them without magic numbers
    COURT_MIN_X,
    COURT_MAX_X,
    COURT_MIN_Y,
    COURT_MAX_Y,
    LEFT_HOOP,
    RIGHT_HOOP,
    STEAL_RANGE,
    STEAL_COOLDOWN_MAX,
  };

})();

// ─── CommonJS / ES module compatibility ───────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlayerManager;
}
