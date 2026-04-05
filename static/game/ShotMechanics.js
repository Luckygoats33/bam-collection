/**
 * ShotMechanics.js
 * Shot system for a Double Dribble-style 8-bit basketball game.
 * Court: 256x240. Left hoop: (24, 120). Right hoop: (232, 120).
 */

const ShotMechanics = (() => {

  // --- Constants ---

  const LAYUP_RANGE     = 30;   // px from hoop
  const MIDRANGE_MAX    = 80;   // px from hoop
  const CONTEST_RADIUS  = 20;   // px from shooter to defender

  const BASE_PCT = {
    layup:    { open: 0.70, contested: 0.40 },
    midrange: { open: 0.45, contested: 0.25 },
    three:    { open: 0.33, contested: 0.18 },
  };

  const RELEASE_QUALITY_RANGE = 0.15; // ±15% swing
  const PERFECT_RELEASE       = 0.5;  // sweet spot

  // Shot meter dimensions (pixels, NES-style)
  const METER_WIDTH   = 6;
  const METER_HEIGHT  = 32;
  const METER_OFFSET_X = 10; // to the right of shooter
  const METER_OFFSET_Y = -METER_HEIGHT; // above shooter

  const GREEN_ZONE_LO = 0.4;
  const GREEN_ZONE_HI = 0.6;

  // Rebound scatter
  const REBOUND_MIN = 20;
  const REBOUND_MAX = 50;

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  function dist(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function randFloat(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  /**
   * initShot(player, targetHoopX, targetHoopY)
   *
   * player   — { x, y }   shooter position
   * targetHoopX/Y         hoop center coordinates
   *
   * Returns a shot object ready to be updated by the game loop.
   */
  function initShot(player, targetHoopX, targetHoopY) {
    const d = dist(player.x, player.y, targetHoopX, targetHoopY);

    let type;
    if (d < LAYUP_RANGE) {
      type = 'layup';
    } else if (d < MIDRANGE_MAX) {
      type = 'midrange';
    } else {
      type = 'three';
    }

    return {
      fromX:          player.x,
      fromY:          player.y,
      toX:            targetHoopX,
      toY:            targetHoopY,
      distance:       d,
      type:           type,
      releaseQuality: null,   // set by game loop when player releases (0-1)
      power:          0,      // 0-1, updated each frame while button held
      contested:      false,  // updated by game loop via isContested()
    };
  }

  /**
   * getShotPercentage(shot, isContested)
   *
   * Returns make probability 0-1.
   * releaseQuality: 0.5 = perfect (+15%), 0 or 1 = worst (-15%).
   */
  function getShotPercentage(shot, contested) {
    const base = contested
      ? BASE_PCT[shot.type].contested
      : BASE_PCT[shot.type].open;

    // releaseQuality modifier: distance from 0.5 scaled to ±RELEASE_QUALITY_RANGE
    let releaseMod = 0;
    if (shot.releaseQuality !== null) {
      // deviation from perfect (0 = perfect, 0.5 = worst)
      const deviation = Math.abs(shot.releaseQuality - PERFECT_RELEASE);
      // deviation 0 → +RANGE, deviation 0.5 → -RANGE
      releaseMod = RELEASE_QUALITY_RANGE - deviation * (RELEASE_QUALITY_RANGE * 2 / 0.5);
    }

    return clamp(base + releaseMod, 0, 1);
  }

  /**
   * isContested(shooter, defenders)
   *
   * shooter   — { x, y }
   * defenders — array of { x, y }
   *
   * Returns true if any defender is within CONTEST_RADIUS of shooter.
   */
  function isContested(shooter, defenders) {
    for (const def of defenders) {
      if (dist(shooter.x, shooter.y, def.x, def.y) < CONTEST_RADIUS) {
        return true;
      }
    }
    return false;
  }

  /**
   * attemptShot(shot)
   *
   * Rolls against getShotPercentage and returns 'made' or 'missed'.
   * Also attaches rebound position to shot on miss (shot.reboundX/Y).
   */
  function attemptShot(shot) {
    const pct = getShotPercentage(shot, shot.contested);
    const roll = Math.random();

    if (roll < pct) {
      return 'made';
    } else {
      const rb = getMissRebound(shot.toX, shot.toY);
      shot.reboundX = rb.x;
      shot.reboundY = rb.y;
      return 'missed';
    }
  }

  /**
   * getMissRebound(hoopX, hoopY)
   *
   * Returns { x, y } where the ball lands after a miss.
   * Random angle, distance 20-50px from hoop, clamped to court bounds.
   */
  function getMissRebound(hoopX, hoopY) {
    const angle = randFloat(0, Math.PI * 2);
    const d     = randFloat(REBOUND_MIN, REBOUND_MAX);

    const rx = clamp(hoopX + Math.cos(angle) * d, 0, 256);
    const ry = clamp(hoopY + Math.sin(angle) * d, 0, 240);

    return { x: Math.round(rx), y: Math.round(ry) };
  }

  /**
   * drawShotMeter(ctx, x, y, power)
   *
   * ctx   — CanvasRenderingContext2D
   * x, y  — shooter's screen position (center-bottom)
   * power — 0-1 (filled amount)
   *
   * Draws a vertical NES-style shot meter:
   *   - Black outline
   *   - Red fill for out-of-green-zone power
   *   - Green fill for power within 0.4-0.6
   *   - White tick marks at green zone boundaries
   */
  function drawShotMeter(ctx, x, y, power) {
    const mx = Math.round(x + METER_OFFSET_X);
    const my = Math.round(y + METER_OFFSET_Y);
    const p  = clamp(power, 0, 1);

    ctx.save();

    // Background / border
    ctx.fillStyle = '#000000';
    ctx.fillRect(mx - 1, my - 1, METER_WIDTH + 2, METER_HEIGHT + 2);

    // Empty meter (dark gray)
    ctx.fillStyle = '#222222';
    ctx.fillRect(mx, my, METER_WIDTH, METER_HEIGHT);

    // Filled portion (grows upward from bottom)
    const fillHeight = Math.round(p * METER_HEIGHT);
    const fillY      = my + METER_HEIGHT - fillHeight;

    const inGreenZone = p >= GREEN_ZONE_LO && p <= GREEN_ZONE_HI;
    ctx.fillStyle = inGreenZone ? '#00cc00' : '#cc2200';
    ctx.fillRect(mx, fillY, METER_WIDTH, fillHeight);

    // Green zone bracket lines (white ticks on both edges)
    const greenLoY = Math.round(my + METER_HEIGHT - GREEN_ZONE_HI * METER_HEIGHT);
    const greenHiY = Math.round(my + METER_HEIGHT - GREEN_ZONE_LO * METER_HEIGHT);

    ctx.fillStyle = '#ffffff';
    // Top tick of green zone
    ctx.fillRect(mx - 2, greenLoY, METER_WIDTH + 4, 1);
    // Bottom tick of green zone
    ctx.fillRect(mx - 2, greenHiY, METER_WIDTH + 4, 1);

    ctx.restore();
  }

  // -------------------------------------------------------------------
  // Expose public API
  // -------------------------------------------------------------------

  return {
    initShot,
    getShotPercentage,
    isContested,
    attemptShot,
    getMissRebound,
    drawShotMeter,
  };

})();

// CommonJS + ESM dual export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShotMechanics;
}
