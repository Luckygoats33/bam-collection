/**
 * AIController.js
 * Double Dribble-style 8-bit basketball AI for the away team.
 *
 * Court: 256x240px
 *   Left hoop:  x~24,  y~120  (home basket — AI attacks this)
 *   Right hoop: x~232, y~120  (away basket — AI defends this)
 *
 * Each frame: call update() → receive 5 action objects [{dx, dy, action}, ...]
 */

const AIController = (() => {
  // ─── Constants ────────────────────────────────────────────────────────────
  const COURT_W = 256;
  const COURT_H = 240;

  const HOME_HOOP  = { x: 24,  y: 120 };  // AI attacks
  const AWAY_HOOP  = { x: 232, y: 120 };  // AI defends

  const SPEED          = 1.2;   // px/frame, as specified
  const SHOOT_RANGE    = 60;    // px from hoop — within this, consider shooting
  const THREE_RANGE    = 90;    // px from hoop — beyond this is a 3-pointer
  const CLOSE_RANGE    = 12;    // px — close enough to attempt a steal
  const PASS_RANGE     = 40;    // px — defender this close triggers a pass look
  const SCREEN_RANGE   = 20;    // px — close enough to set a pick
  const CONTEST_RANGE  = 50;    // px — defender rushes toward shooter

  // Mid-range shooting accuracy ~40%, three-point ~30%
  const SHOOT_CHANCE_MID   = 0.40;
  const SHOOT_CHANCE_THREE = 0.30;
  const STEAL_CHANCE       = 0.10;  // per frame when within CLOSE_RANGE

  // Shot-clock threshold — shoot if under this many frames (~4 s at 60fps)
  const SHOT_CLOCK_PANIC   = 240;

  // Offensive floor spacing positions (relative to left hoop AI attacks)
  // Indexed by role: 0=ball handler (dynamic), 1=wing-left, 2=wing-right,
  //                  3=corner-left, 4=corner-right
  const FLOOR_SPOTS = [
    null,                        // ball handler — computed dynamically
    { x: 80,  y: 60  },         // high wing left
    { x: 80,  y: 180 },         // high wing right
    { x: 130, y: 40  },         // corner / three-point left
    { x: 130, y: 200 },         // corner / three-point right
  ];

  // Defensive positions shift toward protected hoop
  const DEF_BASKET_X_OFFSET = 20; // how far toward away basket to shade

  // ─── Internal State ───────────────────────────────────────────────────────
  let frameCount      = 0;
  let pickRollTicker  = 0;       // counts down; when 0 consider a new pick play
  let pickManIdx      = -1;      // which AI player is setting the screen
  let lastBallHolder  = -1;      // index into homePlayers of last ball holder (defense)
  let transitionTimer = 0;       // frames remaining in transition movement

  // ─── Utilities ────────────────────────────────────────────────────────────

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Return a {dx, dy} unit-ish vector clamped to -1/0/1 per axis. */
  function dirTo(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return { dx: 0, dy: 0 };
    return {
      dx: Math.sign(dx),
      dy: Math.sign(dy),
    };
  }

  /** Clamp a value between lo and hi. */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /** Random boolean with probability p. */
  function chance(p) { return Math.random() < p; }

  /**
   * Find the most open teammate: lowest ratio of (dist to teammate) / (dist defender to teammate).
   * Lower = defender is farther relative to us — more open.
   * Returns index into awayPlayers, excluding `excludeIdx`.
   */
  function mostOpenTeammate(awayPlayers, homePlayers, excludeIdx) {
    let bestIdx   = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < awayPlayers.length; i++) {
      if (i === excludeIdx) continue;
      const tm = awayPlayers[i];

      // Find closest home defender to this teammate
      let minDefDist = Infinity;
      for (const hp of homePlayers) {
        const d = dist(tm, hp);
        if (d < minDefDist) minDefDist = d;
      }

      // Higher score = more open
      const score = minDefDist;
      if (score > bestScore) {
        bestScore = score;
        bestIdx   = i;
      }
    }
    return bestIdx;
  }

  /**
   * Find which AI player has the ball (ball.holder === player id, or closest).
   * Returns index into awayPlayers, or -1 if home team has ball.
   */
  function findBallHandler(awayPlayers, ball) {
    // If ball has an explicit holder reference, use it
    if (ball.holder !== undefined && ball.holder !== null) {
      // Try to match by player id
      const idx = awayPlayers.findIndex(p => p.id === ball.holder);
      if (idx !== -1) return idx;
    }
    // Fallback: if ball is very close to an away player and moving slowly, assume possession
    let closest = -1;
    let closestD = Infinity;
    for (let i = 0; i < awayPlayers.length; i++) {
      const d = dist(awayPlayers[i], ball);
      if (d < closestD) { closestD = d; closest = i; }
    }
    if (closestD < 10) return closest;
    return -1;
  }

  /** True if ball is controlled by home team. */
  function homeHasBall(homePlayers, ball) {
    if (ball.holder !== undefined && ball.holder !== null) {
      return homePlayers.some(p => p.id === ball.holder);
    }
    let closest = null;
    let closestD = Infinity;
    const allPlayers = [...homePlayers]; // only check home side
    for (const p of allPlayers) {
      const d = dist(p, ball);
      if (d < closestD) { closestD = d; closest = p; }
    }
    return closestD < 10;
  }

  // ─── Offense Logic ────────────────────────────────────────────────────────

  /**
   * Compute actions for the ball handler.
   * Returns action object for this player.
   */
  function offenseBallHandler(player, awayPlayers, homePlayers, ball, shotClock, handlerIdx) {
    const distToHoop    = dist(player, HOME_HOOP);
    const isThreeRange  = distToHoop > THREE_RANGE;

    // Find closest defender to ball handler
    let closestDefDist = Infinity;
    for (const hp of homePlayers) {
      const d = dist(player, hp);
      if (d < closestDefDist) closestDefDist = d;
    }

    const panicShoot = shotClock !== undefined && shotClock < SHOT_CLOCK_PANIC;

    // --- Shoot decision ---
    if (distToHoop <= SHOOT_RANGE) {
      const shootChance = isThreeRange ? SHOOT_CHANCE_THREE : SHOOT_CHANCE_MID;
      // More likely to shoot if open; less likely if tightly guarded
      const openBonus  = closestDefDist > 25 ? 1.4 : 1.0;
      const panicBonus = panicShoot ? 2.0 : 1.0;
      const effective  = shootChance * openBonus * panicBonus;

      // Only shoot every ~10 frames to avoid spamming (simulate hold-up / release)
      if (frameCount % 10 === 0 && chance(effective)) {
        return { dx: 0, dy: 0, action: 'shoot' };
      }
    }

    // --- Pass decision ---
    if (closestDefDist < PASS_RANGE && !panicShoot) {
      // Defender is close — look to pass
      const openIdx = mostOpenTeammate(awayPlayers, homePlayers, handlerIdx);
      if (openIdx !== -1 && chance(0.35)) {
        return { dx: 0, dy: 0, action: 'pass' };
      }
    }

    // --- Pick-and-roll: if screener is nearby, use the screen ---
    if (pickManIdx !== -1 && pickManIdx !== handlerIdx) {
      const screener = awayPlayers[pickManIdx];
      if (screener && dist(player, screener) < SCREEN_RANGE * 2) {
        // Drive off the screen toward the hoop
        const dir = dirTo(player, HOME_HOOP);
        return { dx: dir.dx, dy: dir.dy, action: null };
      }
    }

    // --- Drive toward hoop ---
    // Add minor jitter for "dribble moves" every few frames
    const jitter = (frameCount % 20 < 5) ? { x: player.x, y: player.y + (Math.random() > 0.5 ? 8 : -8) } : null;
    const target  = jitter || HOME_HOOP;
    const dir     = dirTo(player, target);

    return { dx: dir.dx, dy: dir.dy, action: null };
  }

  /**
   * Compute actions for off-ball offensive players.
   */
  function offenseSpacing(player, playerIdx, handlerIdx, awayPlayers, homePlayers) {
    const spot = FLOOR_SPOTS[playerIdx];
    if (!spot) return { dx: 0, dy: 0, action: null };

    // Pick-and-roll screener
    if (playerIdx === pickManIdx && handlerIdx !== -1) {
      const handler = awayPlayers[handlerIdx];
      if (!handler) return moveTo(player, spot);

      // Move to set a screen between handler and hoop
      const screenPos = {
        x: (handler.x + HOME_HOOP.x) / 2 + 10,
        y: handler.y,
      };
      return moveTo(player, screenPos);
    }

    // Drift toward open floor spot — with small randomness so they don't bunch
    const driftTarget = {
      x: spot.x + (Math.sin(frameCount * 0.05 + playerIdx) * 8),
      y: spot.y + (Math.cos(frameCount * 0.04 + playerIdx) * 8),
    };

    // If a defender is on top of them, cut backdoor or away
    let closestDef = null;
    let closestDefDist = Infinity;
    for (const hp of homePlayers) {
      const d = dist(player, hp);
      if (d < closestDefDist) { closestDefDist = d; closestDef = hp; }
    }

    if (closestDef && closestDefDist < 18) {
      // Cut toward hoop (backdoor) or away
      const cut = frameCount % 60 < 30
        ? { x: HOME_HOOP.x + 30, y: player.y > 120 ? 160 : 80 }
        : driftTarget;
      return moveTo(player, cut);
    }

    return moveTo(player, driftTarget);
  }

  function moveTo(player, target) {
    const dir = dirTo(player, target);
    // Stop moving if very close to target to avoid jitter
    if (dist(player, target) < 3) return { dx: 0, dy: 0, action: null };
    return { dx: dir.dx, dy: dir.dy, action: null };
  }

  // ─── Defense Logic ────────────────────────────────────────────────────────

  /**
   * Man-to-man: AI player at `playerIdx` guards `homePlayers[playerIdx]`.
   * Stays between their man and the away basket.
   */
  function defenseManToMan(player, playerIdx, homePlayers, ball) {
    const man = homePlayers[playerIdx];
    if (!man) return { dx: 0, dy: 0, action: null };

    const isBallHandler = dist(man, ball) < 14;

    // Attempt steal if very close to ball handler
    if (isBallHandler && dist(player, man) < CLOSE_RANGE) {
      if (chance(STEAL_CHANCE)) {
        return { dx: 0, dy: 0, action: 'steal' };
      }
    }

    // Contest the shot: if man is in shooting range near hoop, charge at them
    const manDistToHoop = dist(man, AWAY_HOOP);
    if (manDistToHoop < CONTEST_RANGE) {
      const dir = dirTo(player, man);
      return { dx: dir.dx, dy: dir.dy, action: null };
    }

    // Stay between man and away basket (defensive shade position)
    // Weighted midpoint: 60% toward man, 40% toward basket path
    const guardPos = {
      x: man.x * 0.65 + AWAY_HOOP.x * 0.35,
      y: man.y * 0.65 + AWAY_HOOP.y * 0.35,
    };

    // Add slight sag toward lane when man is far from ball
    const ballDist = dist(man, ball);
    if (ballDist > 60) {
      guardPos.x += (AWAY_HOOP.x - guardPos.x) * 0.15;
      guardPos.y += (AWAY_HOOP.y - guardPos.y) * 0.15;
    }

    const d = dist(player, guardPos);
    if (d < 3) return { dx: 0, dy: 0, action: null };
    const dir = dirTo(player, guardPos);
    return { dx: dir.dx, dy: dir.dy, action: null };
  }

  // ─── Transition Logic ─────────────────────────────────────────────────────

  /**
   * After a score or turnover, push players toward transition spots.
   * Offense: sprint to attacking positions.
   * Defense: sprint back to protect basket.
   */
  function transitionMove(player, playerIdx, toOffense) {
    let target;
    if (toOffense) {
      // Sprint to floor spots for fast break
      target = FLOOR_SPOTS[playerIdx] || { x: 60, y: 120 };
    } else {
      // Sprint back to paint / defensive positions
      const defSpots = [
        { x: 190, y: 120 },  // center / paint
        { x: 200, y: 85  },
        { x: 200, y: 155 },
        { x: 180, y: 65  },
        { x: 180, y: 175 },
      ];
      target = defSpots[playerIdx] || { x: 180, y: 120 };
    }
    return moveTo(player, target);
  }

  // ─── Pick & Roll Management ───────────────────────────────────────────────

  function updatePickRoll(handlerIdx) {
    pickRollTicker--;
    if (pickRollTicker <= 0) {
      // Reset: pick a random non-handler to set a screen, or cancel
      pickRollTicker = 180 + Math.floor(Math.random() * 180); // 3–6 seconds at 60fps
      if (chance(0.4) && handlerIdx !== -1) {
        // Pick a random off-ball player to be the screener
        let candidates = [0, 1, 2, 3, 4].filter(i => i !== handlerIdx);
        pickManIdx = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        pickManIdx = -1;
      }
    }
  }

  // ─── Main Update ─────────────────────────────────────────────────────────

  /**
   * Called every frame by the game engine.
   *
   * @param {Array}  awayPlayers  5 objects {id, x, y}
   * @param {Array}  homePlayers  5 objects {id, x, y}
   * @param {Object} ball         {x, y, holder: id|null}
   * @param {number} awayScore
   * @param {number} homeScore
   * @param {number} shotClock    frames remaining (optional)
   * @returns {Array} 5 action objects [{dx, dy, action}, ...]
   */
  function update(awayPlayers, homePlayers, ball, awayScore, homeScore, shotClock) {
    frameCount++;

    const actions = Array(5).fill(null).map(() => ({ dx: 0, dy: 0, action: null }));

    if (!awayPlayers || awayPlayers.length === 0) return actions;

    // ── Determine possession ──────────────────────────────────────────────
    const handlerIdx   = findBallHandler(awayPlayers, ball);
    const awayHasBall  = handlerIdx !== -1;
    const homeOnOffense = !awayHasBall && homeHasBall(homePlayers, ball);

    // ── Transition detection ──────────────────────────────────────────────
    // If neither team clearly has ball (it's in the air / loose), hold positions
    const looseBall = !awayHasBall && !homeOnOffense;

    if (transitionTimer > 0) {
      transitionTimer--;
      const toOffense = awayHasBall; // heading into offense after a steal/rebound
      for (let i = 0; i < 5; i++) {
        actions[i] = transitionMove(awayPlayers[i], i, toOffense);
      }
      return actions;
    }

    // ── Pick & Roll state machine ─────────────────────────────────────────
    if (awayHasBall) {
      updatePickRoll(handlerIdx);
    }

    // ── Per-player logic ──────────────────────────────────────────────────
    for (let i = 0; i < 5; i++) {
      const player = awayPlayers[i];
      if (!player) continue;

      if (awayHasBall) {
        // ── OFFENSE ─────────────────────────────────────────────────────
        if (i === handlerIdx) {
          actions[i] = offenseBallHandler(player, awayPlayers, homePlayers, ball, shotClock, handlerIdx);
        } else {
          actions[i] = offenseSpacing(player, i, handlerIdx, awayPlayers, homePlayers);
        }

      } else if (homeOnOffense) {
        // ── DEFENSE ─────────────────────────────────────────────────────
        actions[i] = defenseManToMan(player, i, homePlayers, ball);

      } else {
        // ── LOOSE BALL / TRANSITION ──────────────────────────────────────
        if (i === 0) {
          // Have one player chase the ball
          actions[i] = moveTo(player, ball);
        } else {
          // Others crash the boards or hold position
          const reboundPos = { x: HOME_HOOP.x + 20, y: HOME_HOOP.y + (i % 2 === 0 ? -15 : 15) };
          actions[i] = moveTo(player, reboundPos);
        }
      }

      // ── Boundary clamping: keep players on court ──────────────────────
      const margin = 8;
      const futureX = player.x + actions[i].dx * SPEED;
      const futureY = player.y + actions[i].dy * SPEED;
      if (futureX < margin || futureX > COURT_W - margin) actions[i].dx = 0;
      if (futureY < margin || futureY > COURT_H - margin) actions[i].dy = 0;
    }

    return actions;
  }

  /**
   * Call this when a score, turnover, or foul occurs so the AI can
   * trigger a transition sprint. `toOffense` = true if AI is now on offense.
   */
  function notifyTransition(toOffense) {
    transitionTimer = 90; // ~1.5 seconds of transition movement at 60fps
    pickManIdx      = -1;
    pickRollTicker  = 0;
  }

  /**
   * Reset all AI state (call at game start or after halftime).
   */
  function reset() {
    frameCount      = 0;
    pickRollTicker  = 0;
    pickManIdx      = -1;
    lastBallHolder  = -1;
    transitionTimer = 0;
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  return { update, notifyTransition, reset };
})();

// CommonJS export (Node/bundler) — no-op in plain browser <script> context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIController;
}
