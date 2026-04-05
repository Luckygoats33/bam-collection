/**
 * PlayerRenderer — 8-bit Double Dribble-inspired basketball player sprites
 * Uses only ctx.fillRect for pixel art rendering.
 * Sprite size: ~16x24 pixels (scaled up by SCALE factor for visibility)
 */

const PlayerRenderer = (() => {

  const SCALE = 1; // 1:1 for NES-resolution canvas (256x240)

  // Darken a hex color by a given ratio (0-1)
  function darkenColor(hex, ratio) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.floor(r * (1 - ratio));
    g = Math.floor(g * (1 - ratio));
    b = Math.floor(b * (1 - ratio));
    return `rgb(${r},${g},${b})`;
  }

  // Draw a single scaled pixel
  function px(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
  }

  // Draw a scaled rectangle (in sprite-pixel units)
  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
  }

  // Colors
  const SKIN      = '#f4a460';
  const SKIN_DARK = '#d4824a';
  const SHOE      = '#ffffff';
  const SHOE_DARK = '#cccccc';
  const BALL      = '#ff6600';
  const BALL_DARK = '#cc4400';
  const OUTLINE   = '#111111';

  /**
   * Simple 3x5 pixel digit glyphs (column-major, 1 = filled)
   * Each digit is a flat array of 15 bits (3 cols x 5 rows, row-major)
   */
  const DIGITS = {
    '0': [1,1,1, 1,0,1, 1,0,1, 1,0,1, 1,1,1],
    '1': [0,1,0, 1,1,0, 0,1,0, 0,1,0, 1,1,1],
    '2': [1,1,1, 0,0,1, 1,1,1, 1,0,0, 1,1,1],
    '3': [1,1,1, 0,0,1, 0,1,1, 0,0,1, 1,1,1],
    '4': [1,0,1, 1,0,1, 1,1,1, 0,0,1, 0,0,1],
    '5': [1,1,1, 1,0,0, 1,1,1, 0,0,1, 1,1,1],
    '6': [1,1,1, 1,0,0, 1,1,1, 1,0,1, 1,1,1],
    '7': [1,1,1, 0,0,1, 0,1,0, 0,1,0, 0,1,0],
    '8': [1,1,1, 1,0,1, 1,1,1, 1,0,1, 1,1,1],
    '9': [1,1,1, 1,0,1, 1,1,1, 0,0,1, 1,1,1],
  };

  function drawDigit(ctx, digitChar, x, y, color) {
    const bits = DIGITS[digitChar];
    if (!bits) return;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (bits[row * 3 + col]) {
          px(ctx, x + col, y + row, color);
        }
      }
    }
  }

  /**
   * Draw a 1-2 digit number centered in the jersey body
   * x, y = top-left of jersey in sprite coords
   */
  function drawJerseyNumber(ctx, number, jerseyX, jerseyY, jerseyW) {
    const str = String(number).slice(0, 2);
    const numDigits = str.length;
    // 3px per digit + 1px gap between digits + 1px padding
    const totalW = numDigits === 1 ? 3 : 7;
    const startX = jerseyX + Math.floor((jerseyW - totalW) / 2);
    const numColor = '#ffffff';

    if (numDigits === 1) {
      drawDigit(ctx, str[0], startX, jerseyY + 1, numColor);
    } else {
      drawDigit(ctx, str[0], startX,     jerseyY + 1, numColor);
      drawDigit(ctx, str[1], startX + 4, jerseyY + 1, numColor);
    }
  }

  /**
   * Core sprite draw — origin (ox, oy) is top-left of the 16x24 sprite grid
   *
   * Sprite layout (y=0 at top):
   *  0-5   : head
   *  6-15  : torso / jersey
   * 10-14  : shorts
   * 15-23  : legs + shoes
   */
  function drawSprite(ctx, ox, oy, opts) {
    const { teamColor, direction, frame, hasBall, shooting, jerseyNumber } = opts;

    const shortsColor  = darkenColor(teamColor, 0.3);
    const jerseyShade  = darkenColor(teamColor, 0.15);

    ctx.save();
    ctx.translate(ox, oy);

    // ── HEAD ─────────────────────────────────────────────────────────────
    // 6px wide, 6px tall, centered at x=5
    const headX = 5;
    const headY = 0;

    // outline
    rect(ctx, headX,   headY,   6, 6, OUTLINE);
    // skin fill
    rect(ctx, headX+1, headY+1, 4, 4, SKIN);
    // slight shading on one side for depth
    rect(ctx, headX+4, headY+1, 1, 4, SKIN_DARK);

    // Eyes — two tiny dots
    px(ctx, headX + 1, headY + 2, OUTLINE);
    px(ctx, headX + 3, headY + 2, OUTLINE);

    // Mouth
    px(ctx, headX + 2, headY + 4, OUTLINE);

    // Hair (dark strip across top)
    rect(ctx, headX+1, headY,   4, 1, '#2c1a0e');

    // ── BODY / JERSEY ────────────────────────────────────────────────────
    // 8px wide, 10px tall at x=4, y=6
    const bodyX = 4;
    const bodyY = 6;

    // outline
    rect(ctx, bodyX,   bodyY,   8, 10, OUTLINE);
    // jersey fill
    rect(ctx, bodyX+1, bodyY+1, 6,  8, teamColor);
    // jersey right-side shading
    rect(ctx, bodyX+6, bodyY+1, 1,  8, jerseyShade);

    // Jersey number (centered on body)
    drawJerseyNumber(ctx, jerseyNumber, bodyX + 1, bodyY + 1, 6);

    // ── SHORTS ───────────────────────────────────────────────────────────
    // Overlap lower part of jersey, slightly wider
    const shortsY = bodyY + 6;
    rect(ctx, bodyX,   shortsY,   8, 4, OUTLINE);
    rect(ctx, bodyX+1, shortsY+1, 6, 3, shortsColor);
    // shorts stripe
    rect(ctx, bodyX+1, shortsY+1, 6, 1, teamColor);

    // ── ARMS ─────────────────────────────────────────────────────────────
    if (shooting) {
      // Arms raised — one arm up each side
      // Left arm up
      rect(ctx, bodyX - 2, bodyY,     2, 6, OUTLINE);
      rect(ctx, bodyX - 1, bodyY + 1, 1, 4, SKIN);
      // Right arm up
      rect(ctx, bodyX + 8, bodyY,     2, 6, OUTLINE);
      rect(ctx, bodyX + 8, bodyY + 1, 1, 4, SKIN);
      // Hands at top
      px(ctx, bodyX - 1, bodyY,     SKIN);
      px(ctx, bodyX + 8, bodyY,     SKIN);
    } else {
      // Arms at sides, slight swing per frame
      const armSwing = (frame === 1 || frame === 3) ? 1 : 0;
      // Left arm
      rect(ctx, bodyX - 2, bodyY + 1 + armSwing, 2, 5, OUTLINE);
      rect(ctx, bodyX - 1, bodyY + 2 + armSwing, 1, 3, SKIN);
      // Right arm (opposite swing)
      rect(ctx, bodyX + 8, bodyY + 1 + (1 - armSwing), 2, 5, OUTLINE);
      rect(ctx, bodyX + 8, bodyY + 2 + (1 - armSwing), 1, 3, SKIN);
    }

    // ── LEGS ─────────────────────────────────────────────────────────────
    // Two legs below shorts, walk animation driven by frame
    const legTopY = shortsY + 4;

    // frame 0,2: neutral  frame 1: left forward  frame 3: right forward
    let leftLegOffset  = 0;
    let rightLegOffset = 0;
    if (frame === 1) { leftLegOffset  = -1; rightLegOffset = 1; }
    if (frame === 3) { leftLegOffset  =  1; rightLegOffset = -1; }

    // Left leg
    const lx = bodyX + 1;
    rect(ctx, lx,   legTopY + leftLegOffset,  3, 4, OUTLINE);
    rect(ctx, lx+1, legTopY + leftLegOffset+1,1, 2, SKIN);

    // Right leg
    const rx = bodyX + 4;
    rect(ctx, rx,   legTopY + rightLegOffset,  3, 4, OUTLINE);
    rect(ctx, rx+1, legTopY + rightLegOffset+1,1, 2, SKIN);

    // ── SHOES ────────────────────────────────────────────────────────────
    const shoeY = legTopY + 4;
    // Left shoe
    rect(ctx, lx - 1, shoeY + leftLegOffset,  4, 2, OUTLINE);
    rect(ctx, lx,     shoeY + leftLegOffset,  3, 1, SHOE);
    px(ctx,   lx + 2, shoeY + leftLegOffset,  SHOE_DARK);

    // Right shoe
    rect(ctx, rx - 1, shoeY + rightLegOffset, 4, 2, OUTLINE);
    rect(ctx, rx,     shoeY + rightLegOffset, 3, 1, SHOE);
    px(ctx,   rx + 2, shoeY + rightLegOffset, SHOE_DARK);

    // ── BALL ─────────────────────────────────────────────────────────────
    if (hasBall && !shooting) {
      // Ball dribbling at side — position based on direction
      let ballX, ballY;
      switch (direction) {
        case 'right': ballX = bodyX + 9; ballY = shortsY + 3; break;
        case 'left':  ballX = bodyX - 5; ballY = shortsY + 3; break;
        case 'up':    ballX = bodyX + 9; ballY = shortsY + 3; break;
        case 'down':
        default:      ballX = bodyX + 9; ballY = shortsY + 3; break;
      }
      // Ball bounce per frame
      const ballBounce = (frame === 1 || frame === 3) ? 1 : 0;
      ballY += ballBounce;

      rect(ctx, ballX,   ballY,   4, 4, OUTLINE);
      rect(ctx, ballX+1, ballY+1, 2, 2, BALL);
      px(ctx,   ballX+2, ballY+1,       BALL_DARK);
      // seam lines
      px(ctx,   ballX+1, ballY+2,       BALL_DARK);
    }

    if (hasBall && shooting) {
      // Ball held overhead during shot
      px(ctx, headX + 2, headY - 3, OUTLINE);
      rect(ctx, headX + 1, headY - 4, 4, 4, OUTLINE);
      rect(ctx, headX + 2, headY - 3, 2, 2, BALL);
      px(ctx,   headX + 3, headY - 3,       BALL_DARK);
    }

    // ── DIRECTION INDICATOR (subtle facing shadow) ────────────────────────
    // For up/down we tweak the face details slightly
    if (direction === 'up') {
      // Draw hair covering most of face (back of head)
      rect(ctx, headX+1, headY, 4, 5, '#2c1a0e');
      px(ctx, headX+1, headY+5, '#2c1a0e');
      px(ctx, headX+4, headY+5, '#2c1a0e');
    }

    ctx.restore();
  }

  /**
   * Public API
   */
  function drawPlayer(ctx, x, y, teamColor, direction, frame, hasBall, shooting) {
    // Assign jersey number by team color (home = red uses #23, away = blue uses #11)
    const isHome = (teamColor === '#ff1744' || teamColor.toLowerCase() === '#ff1744');
    const jerseyNumber = isHome ? 23 : 11;

    drawSprite(ctx, x, y, {
      teamColor,
      direction:     direction  || 'down',
      frame:         (frame     || 0) % 4,
      hasBall:       !!hasBall,
      shooting:      !!shooting,
      jerseyNumber,
    });
  }

  return { drawPlayer, SCALE };

})();

// ─── DEMO ────────────────────────────────────────────────────────────────────
// Run this file directly in a browser via the included HTML scaffold below,
// or call PlayerRenderer.drawPlayer() from your own canvas loop.

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('demo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const HOME = '#ff1744';
    const AWAY = '#2196f3';

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Court color strip
    ctx.fillStyle = '#c68642';
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

    // Labels
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';

    const rows = [
      { label: 'HOME  — frames 0-3 (walk)', color: HOME,  y: 30,  hasBall: false, shooting: false },
      { label: 'HOME  — dribbling',          color: HOME,  y: 120, hasBall: true,  shooting: false },
      { label: 'HOME  — shooting',           color: HOME,  y: 210, hasBall: true,  shooting: true  },
      { label: 'AWAY  — frames 0-3 (walk)', color: AWAY,  y: 310, hasBall: false, shooting: false },
      { label: 'AWAY  — dribbling',          color: AWAY,  y: 400, hasBall: true,  shooting: false },
      { label: 'AWAY  — shooting',           color: AWAY,  y: 490, hasBall: true,  shooting: true  },
    ];

    const dirs = ['down', 'left', 'right', 'up'];

    rows.forEach(row => {
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText(row.label, 10, row.y - 5);
      dirs.forEach((dir, di) => {
        for (let f = 0; f < 4; f++) {
          const x = 20 + di * 130 + f * 30;
          PlayerRenderer.drawPlayer(ctx, x, row.y, row.color, dir, f, row.hasBall, row.shooting);
        }
        ctx.fillStyle = '#555555';
        ctx.fillText(`${dir}`, 20 + di * 130 + 18, row.y + 80);
      });
    });
  });
}
