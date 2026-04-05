// court.js — 8-bit NES Double Dribble style basketball court
// Target resolution: 256x240 (NES native), scaled up for display

const Court = (() => {

  // ── helpers ──────────────────────────────────────────────────────────────

  function fillRect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // Draw a 1-pixel-wide horizontal line using fillRect (no ctx.stroke)
  function hline(ctx, x, y, len, color) {
    fillRect(ctx, x, y, len, 1, color);
  }

  // Draw a 1-pixel-wide vertical line
  function vline(ctx, x, y, len, color) {
    fillRect(ctx, x, y, 1, len, color);
  }

  // Pixel-art circle outline using midpoint algorithm, 1px thick
  function pixelCircle(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    let x = 0;
    let y = r;
    let d = 1 - r;
    const plot = (px, py) => {
      ctx.fillRect(Math.round(cx + px), Math.round(cy + py), 1, 1);
      ctx.fillRect(Math.round(cx - px), Math.round(cy + py), 1, 1);
      ctx.fillRect(Math.round(cx + px), Math.round(cy - py), 1, 1);
      ctx.fillRect(Math.round(cx - px), Math.round(cy - py), 1, 1);
      ctx.fillRect(Math.round(cx + py), Math.round(cy + px), 1, 1);
      ctx.fillRect(Math.round(cx - py), Math.round(cy + px), 1, 1);
      ctx.fillRect(Math.round(cx + py), Math.round(cy - px), 1, 1);
      ctx.fillRect(Math.round(cx - py), Math.round(cy - px), 1, 1);
    };
    plot(x, y);
    while (x < y) {
      x++;
      if (d < 0) {
        d += 2 * x + 1;
      } else {
        y--;
        d += 2 * (x - y) + 1;
      }
      plot(x, y);
    }
  }

  // Pixel-art arc — only plots points within [startAngle, endAngle] (radians)
  function pixelArc(ctx, cx, cy, r, startAngle, endAngle, color) {
    ctx.fillStyle = color;
    // Walk the full circle via midpoint, only draw pixels in range
    const inRange = (angle) => {
      let a = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let s = ((startAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let e = ((endAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (s <= e) return a >= s && a <= e;
      return a >= s || a <= e;
    };
    const plot = (px, py) => {
      const pts = [
        [cx + px, cy + py, Math.atan2(py, px)],
        [cx - px, cy + py, Math.atan2(py, -px)],
        [cx + px, cy - py, Math.atan2(-py, px)],
        [cx - px, cy - py, Math.atan2(-py, -px)],
        [cx + py, cy + px, Math.atan2(px, py)],
        [cx - py, cy + px, Math.atan2(px, -py)],
        [cx + py, cy - px, Math.atan2(-px, py)],
        [cx - py, cy - px, Math.atan2(-px, -py)],
      ];
      for (const [x, y, a] of pts) {
        if (inRange(a)) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    };
    let x = 0, y = r, d = 1 - r;
    plot(x, y);
    while (x < y) {
      x++;
      if (d < 0) d += 2 * x + 1;
      else { y--; d += 2 * (x - y) + 1; }
      plot(x, y);
    }
  }

  // ── main draw function ───────────────────────────────────────────────────

  function draw(ctx, W, H) {
    // ── 0. Palette ──────────────────────────────────────────────────────────
    const C = {
      oob:        '#2a1a08',   // out-of-bounds dark surround
      plankA:     '#c67e38',   // hardwood plank color A
      plankB:     '#b8722f',   // hardwood plank color B
      plankC:     '#d4894a',   // hardwood plank highlight
      line:       '#ffffff',   // court lines
      key:        '#b06030',   // painted key/lane area (slightly different)
      keyLine:    '#ffffff',
      rimOuter:   '#ff8800',   // orange rim
      rimInner:   '#000000',   // rim hole
      backboard:  '#ffffff',
      scoreTable: '#4a3010',   // scorer's table
      scoreFace:  '#2a1800',
      // NES-style shadow on plank edges
      plankEdge:  '#9a5a20',
    };

    // ── 1. Court geometry (all in logical 256x240 pixels) ──────────────────
    // Court rectangle sits centered with an out-of-bounds border
    const OOB_X   = 8;          // left/right OOB margin
    const OOB_Y   = 16;         // top/bottom OOB margin
    const CW      = W - OOB_X * 2;   // 240px court width
    const CH      = H - OOB_Y * 2;   // 208px court height
    const CX      = OOB_X;           // court left x
    const CY      = OOB_Y;           // court top y

    const MX      = Math.round(CX + CW / 2);   // mid x
    const MY      = Math.round(CY + CH / 2);   // mid y

    // Key / paint box dimensions (scaled to 256x240 NES proportions)
    const KEY_W   = 44;    // depth of the key from baseline
    const KEY_H   = 62;    // width of the key (free throw lane)
    const FT_RADIUS = 24;  // free throw circle radius

    // Basket position: center of hoop, sitting on baseline
    const BASKET_INSET = 8;   // how far hoop center is from baseline edge
    const HOOP_R_OUT  = 5;
    const HOOP_R_IN   = 3;

    // 3-point arc radius (NES-scale approximation)
    const ARC3_R  = 52;

    // ── 2. Out-of-bounds fill ───────────────────────────────────────────────
    fillRect(ctx, 0, 0, W, H, C.oob);

    // ── 3. Hardwood planks ─────────────────────────────────────────────────
    // Planks run vertically (left-right) across the court — horizontal grain
    const PLANK_H = 4;   // each plank is 4px tall
    for (let row = 0; row < Math.ceil(CH / PLANK_H); row++) {
      const py = CY + row * PLANK_H;
      const ph = Math.min(PLANK_H, CY + CH - py);
      // Alternate plank colors in a NES-style pattern
      let base;
      if (row % 3 === 0)      base = C.plankC;
      else if (row % 3 === 1) base = C.plankA;
      else                    base = C.plankB;

      fillRect(ctx, CX, py, CW, ph, base);

      // Plank edge shadow (bottom 1px of each plank)
      if (ph >= PLANK_H) {
        fillRect(ctx, CX, py + PLANK_H - 1, CW, 1, C.plankEdge);
      }

      // Vertical board seams every ~32px, offset per row for staggered look
      const seamOffset = (row % 2 === 0) ? 0 : 16;
      for (let sx = CX + seamOffset; sx < CX + CW; sx += 32) {
        fillRect(ctx, sx, py, 1, ph, C.plankEdge);
      }
    }

    // ── 4. Painted key areas (both ends) ───────────────────────────────────
    // Left key
    fillRect(ctx,
      CX,
      MY - KEY_H / 2,
      KEY_W,
      KEY_H,
      C.key
    );
    // Right key
    fillRect(ctx,
      CX + CW - KEY_W,
      MY - KEY_H / 2,
      KEY_W,
      KEY_H,
      C.key
    );

    // ── 5. Court boundary lines ─────────────────────────────────────────────
    // Top boundary
    hline(ctx, CX, CY,        CW, C.line);
    // Bottom boundary
    hline(ctx, CX, CY + CH - 1, CW, C.line);
    // Left boundary
    vline(ctx, CX,        CY, CH, C.line);
    // Right boundary
    vline(ctx, CX + CW - 1, CY, CH, C.line);

    // ── 6. Half-court line ──────────────────────────────────────────────────
    vline(ctx, MX, CY, CH, C.line);

    // ── 7. Center circle ───────────────────────────────────────────────────
    pixelCircle(ctx, MX, MY, 16, C.line);   // outer
    pixelCircle(ctx, MX, MY,  3, C.line);   // center dot ring
    fillRect(ctx, MX - 1, MY - 1, 3, 3, C.line);  // solid center dot

    // ── 8. Free throw lanes (both ends) ────────────────────────────────────
    const keyY  = MY - KEY_H / 2;

    // Left lane lines
    hline(ctx, CX,         keyY,            KEY_W + 1, C.line);  // top lane
    hline(ctx, CX,         keyY + KEY_H,    KEY_W + 1, C.line);  // bottom lane
    vline(ctx, CX + KEY_W, keyY,            KEY_H + 1, C.line);  // far end

    // Right lane lines
    hline(ctx, CX + CW - KEY_W - 1, keyY,         KEY_W + 1, C.line);
    hline(ctx, CX + CW - KEY_W - 1, keyY + KEY_H, KEY_W + 1, C.line);
    vline(ctx, CX + CW - KEY_W - 1, keyY,         KEY_H + 1, C.line);

    // Lane tick marks (hash marks on the key sides) — 4 pairs each side
    const TICK_POSITIONS = [10, 20, 32, 44]; // px from baseline along lane
    const TICK_LEN = 4;

    for (const t of TICK_POSITIONS) {
      // Left key — top side ticks
      hline(ctx, CX + t, keyY - TICK_LEN,     TICK_LEN, C.line);
      // Left key — bottom side ticks
      hline(ctx, CX + t, keyY + KEY_H + 1,    TICK_LEN, C.line);
      // Right key — top side ticks
      hline(ctx, CX + CW - t - TICK_LEN, keyY - TICK_LEN,  TICK_LEN, C.line);
      // Right key — bottom side ticks
      hline(ctx, CX + CW - t - TICK_LEN, keyY + KEY_H + 1, TICK_LEN, C.line);
    }

    // ── 9. Free throw circles ───────────────────────────────────────────────
    const ftLX = CX + KEY_W;          // left FT line center x
    const ftRX = CX + CW - KEY_W;     // right FT line center x

    pixelCircle(ctx, ftLX, MY, FT_RADIUS, C.line);
    pixelCircle(ctx, ftRX, MY, FT_RADIUS, C.line);

    // Erase the half of the circle that is inside the key (so it looks like a D)
    // Left — erase left half of circle (inside the key)
    fillRect(ctx, CX, MY - FT_RADIUS - 1, KEY_W, FT_RADIUS * 2 + 3, C.key);
    // Re-draw the lane boundary lines on top
    hline(ctx, CX, keyY,         KEY_W + 1, C.line);
    hline(ctx, CX, keyY + KEY_H, KEY_W + 1, C.line);
    vline(ctx, CX, keyY,         KEY_H + 1, C.line);

    // Right — erase right half of circle
    fillRect(ctx, CX + CW - KEY_W, MY - FT_RADIUS - 1, KEY_W, FT_RADIUS * 2 + 3, C.key);
    hline(ctx, CX + CW - KEY_W - 1, keyY,         KEY_W + 1, C.line);
    hline(ctx, CX + CW - KEY_W - 1, keyY + KEY_H, KEY_W + 1, C.line);
    vline(ctx, CX + CW - 1,         keyY,          KEY_H + 1, C.line);

    // ── 10. 3-point arcs ───────────────────────────────────────────────────
    // Left basket arc — opens to the right (covers ~200 degrees)
    // The arc is a semicircle + corner lines on the NES court
    // Center of arc = basket center
    const bLX = CX + BASKET_INSET;   // left basket hoop center x
    const bRX = CX + CW - BASKET_INSET; // right basket hoop center x

    // Left 3pt arc: right-opening semicircle, angles from ~-70° to +70° (in radians)
    // plus straight sideline segments to the baseline
    const ARC3_ANGLE = Math.PI * 0.72;  // ~130° half-sweep = 260° total arc

    pixelArc(ctx, bLX, MY, ARC3_R, -ARC3_ANGLE, ARC3_ANGLE, C.line);

    // Straight parts of 3pt line (top and bottom, running to baseline)
    const arc3TopY = MY - Math.round(Math.sin(ARC3_ANGLE) * ARC3_R);
    const arc3BotY = MY + Math.round(Math.sin(ARC3_ANGLE) * ARC3_R);
    const arc3EndX = bLX + Math.round(Math.cos(ARC3_ANGLE) * ARC3_R);

    vline(ctx, CX, CY,                  arc3TopY - CY,           C.line); // left top corner — already drawn by boundary
    hline(ctx, CX, arc3TopY,            arc3EndX - CX,           C.line);
    hline(ctx, CX, arc3BotY,            arc3EndX - CX,           C.line);

    // Right 3pt arc
    pixelArc(ctx, bRX, MY, ARC3_R, Math.PI - ARC3_ANGLE, Math.PI + ARC3_ANGLE, C.line);

    const arc3REndX = bRX - Math.round(Math.cos(ARC3_ANGLE) * ARC3_R);
    hline(ctx, arc3REndX, arc3TopY,     CX + CW - arc3REndX,     C.line);
    hline(ctx, arc3REndX, arc3BotY,     CX + CW - arc3REndX,     C.line);

    // ── 11. Restricted area arcs (small no-charge semi-circles) ────────────
    pixelArc(ctx, bLX, MY, 8, -Math.PI / 2, Math.PI / 2, C.line);
    pixelArc(ctx, bRX, MY, 8,  Math.PI / 2, Math.PI * 1.5, C.line);

    // ── 12. Backboards ─────────────────────────────────────────────────────
    // Left backboard — vertical 2px wide rectangle just inside baseline
    const BB_W = 2;
    const BB_H = 18;
    fillRect(ctx, CX + 2, MY - BB_H / 2, BB_W, BB_H, C.backboard);

    // Right backboard
    fillRect(ctx, CX + CW - 4, MY - BB_H / 2, BB_W, BB_H, C.backboard);

    // ── 13. Hoops (rims) ───────────────────────────────────────────────────
    // Left hoop — orange ring, black center
    pixelCircle(ctx, bLX + 4, MY, HOOP_R_OUT, C.rimOuter);
    fillRect(ctx, bLX + 4 - HOOP_R_IN + 1, MY - HOOP_R_IN + 1,
                  HOOP_R_IN * 2 - 1, HOOP_R_IN * 2 - 1, C.rimInner);

    // Right hoop
    pixelCircle(ctx, bRX - 4, MY, HOOP_R_OUT, C.rimOuter);
    fillRect(ctx, bRX - 4 - HOOP_R_IN + 1, MY - HOOP_R_IN + 1,
                  HOOP_R_IN * 2 - 1, HOOP_R_IN * 2 - 1, C.rimInner);

    // ── 14. Scorer's table at half-court (top sideline) ────────────────────
    const TABLE_W = 28;
    const TABLE_H = 5;
    const tableX  = MX - TABLE_W / 2;
    const tableY  = CY - TABLE_H;          // sits just outside the top boundary

    fillRect(ctx, tableX,     tableY,     TABLE_W,     TABLE_H,     C.scoreTable);
    fillRect(ctx, tableX + 1, tableY + 1, TABLE_W - 2, TABLE_H - 2, C.scoreFace);
    // Score display pixels (two tiny 3px scoreclock blocks)
    fillRect(ctx, tableX +  4, tableY + 2, 4, 2, '#00ff00');
    fillRect(ctx, tableX + 20, tableY + 2, 4, 2, '#00ff00');

    // ── 15. Out-of-bounds re-fill (clean up any overdrawn pixels) ──────────
    // Top OOB strip (above court)
    fillRect(ctx, 0, 0, W, CY, C.oob);
    // Bottom OOB strip
    fillRect(ctx, 0, CY + CH, W, H - (CY + CH), C.oob);
    // Left OOB
    fillRect(ctx, 0, 0, CX, H, C.oob);
    // Right OOB
    fillRect(ctx, CX + CW, 0, W - (CX + CW), H, C.oob);

    // Re-draw scorer's table (sits in OOB area — draw after OOB refill)
    fillRect(ctx, tableX,     tableY,     TABLE_W,     TABLE_H,     C.scoreTable);
    fillRect(ctx, tableX + 1, tableY + 1, TABLE_W - 2, TABLE_H - 2, C.scoreFace);
    fillRect(ctx, tableX +  4, tableY + 2, 4, 2, '#00ff00');
    fillRect(ctx, tableX + 20, tableY + 2, 4, 2, '#00ff00');

    // ── 16. Re-draw court boundary on top of everything ────────────────────
    hline(ctx, CX, CY,          CW, C.line);
    hline(ctx, CX, CY + CH - 1, CW, C.line);
    vline(ctx, CX,          CY, CH, C.line);
    vline(ctx, CX + CW - 1, CY, CH, C.line);
  }

  // ── public API ────────────────────────────────────────────────────────────
  return { draw };

})();

// Allow CommonJS / ES module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Court;
}
