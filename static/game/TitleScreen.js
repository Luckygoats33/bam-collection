// TitleScreen.js — Double Dribble-style 8-bit title/menu screens
// All rendering via Canvas 2D. Uses 'Press Start 2P' for 8-bit text look.
// Assumes font is loaded externally (e.g. Google Fonts).

const TitleScreen = (() => {

  // ── pixel-font glyph data ──────────────────────────────────────────────────
  // Each letter is a 5-wide × 7-tall bit grid (1 = filled, 0 = empty).
  // Used for the big "BAM BASKETBALL" title so it looks like NES fillRect text.
  // Letters are stored as arrays of 7 rows, each row is 5 bits (MSB left).

  const GLYPHS = {
    'A': [0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
    'B': [0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110],
    'C': [0b01111,0b10000,0b10000,0b10000,0b10000,0b10000,0b01111],
    'D': [0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b11110],
    'E': [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111],
    'F': [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000],
    'G': [0b01111,0b10000,0b10000,0b10111,0b10001,0b10001,0b01111],
    'H': [0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
    'I': [0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b11111],
    'J': [0b11111,0b00010,0b00010,0b00010,0b00010,0b10010,0b01100],
    'K': [0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001],
    'L': [0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111],
    'M': [0b10001,0b11011,0b10101,0b10001,0b10001,0b10001,0b10001],
    'N': [0b10001,0b11001,0b10101,0b10011,0b10001,0b10001,0b10001],
    'O': [0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
    'P': [0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000],
    'Q': [0b01110,0b10001,0b10001,0b10001,0b10101,0b10010,0b01101],
    'R': [0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001],
    'S': [0b01111,0b10000,0b10000,0b01110,0b00001,0b00001,0b11110],
    'T': [0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100],
    'U': [0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
    'V': [0b10001,0b10001,0b10001,0b10001,0b01010,0b01010,0b00100],
    'W': [0b10001,0b10001,0b10001,0b10001,0b10101,0b11011,0b10001],
    'X': [0b10001,0b01010,0b00100,0b00100,0b00100,0b01010,0b10001],
    'Y': [0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100],
    'Z': [0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111],
    '0': [0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110],
    '1': [0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110],
    '2': [0b01110,0b10001,0b00001,0b00110,0b01000,0b10000,0b11111],
    '3': [0b11111,0b00001,0b00010,0b00110,0b00001,0b10001,0b01110],
    '4': [0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010],
    '5': [0b11111,0b10000,0b11110,0b00001,0b00001,0b10001,0b01110],
    '6': [0b01110,0b10000,0b10000,0b11110,0b10001,0b10001,0b01110],
    '7': [0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000],
    '8': [0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110],
    '9': [0b01110,0b10001,0b10001,0b01111,0b00001,0b00001,0b01110],
    ' ': [0,0,0,0,0,0,0],
    '-': [0b00000,0b00000,0b00000,0b11111,0b00000,0b00000,0b00000],
    '!': [0b00100,0b00100,0b00100,0b00100,0b00100,0b00000,0b00100],
    '.': [0b00000,0b00000,0b00000,0b00000,0b00000,0b00000,0b00100],
  };

  // ── low-level helpers ──────────────────────────────────────────────────────

  function fr(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /**
   * Draw pixel-art text using the GLYPHS table.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text  — uppercase string
   * @param {number} x     — left edge of first character
   * @param {number} y     — top edge
   * @param {number} scale — pixel block size in canvas pixels
   * @param {string} color
   */
  function drawPixelText(ctx, text, x, y, scale, color) {
    const COLS = 5;
    const ROWS = 7;
    const GAP  = 1; // gap pixels between letters (in blocks)
    let cx = x;
    for (const ch of text.toUpperCase()) {
      const glyph = GLYPHS[ch] || GLYPHS[' '];
      for (let row = 0; row < ROWS; row++) {
        const bits = glyph[row];
        for (let col = 0; col < COLS; col++) {
          if (bits & (1 << (COLS - 1 - col))) {
            fr(ctx, cx + col * scale, y + row * scale, scale, scale, color);
          }
        }
      }
      cx += (COLS + GAP) * scale;
    }
    return cx - x; // total width drawn
  }

  /**
   * Measure pixel-art text width in canvas pixels.
   */
  function measurePixelText(text, scale) {
    return text.length * (5 + 1) * scale - scale; // last letter has no trailing gap
  }

  /**
   * Draw pixel-art text centered horizontally.
   */
  function drawPixelTextCentered(ctx, text, cy, scale, color, W) {
    const w = measurePixelText(text, scale);
    const x = Math.round((W - w) / 2);
    drawPixelText(ctx, text, x, cy, scale, color);
  }

  /**
   * ctx.fillText wrapper — uses Press Start 2P for NES look.
   * @param {number} size  — font size in px
   * @param {string} align — 'left'|'center'|'right'
   */
  function nesText(ctx, text, x, y, size, color, align = 'center') {
    ctx.save();
    ctx.font = `${size}px 'Press Start 2P', monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ── animated basketball ────────────────────────────────────────────────────

  function drawBall(ctx, cx, cy, r) {
    // Body
    fr(ctx, cx - r, cy - r, r * 2, r * 2, '#c84800'); // dark base fill (square backing)
    // Orange circle approximation — draw filled pixel circle
    ctx.fillStyle = '#ff6d00';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Seam lines
    ctx.fillStyle = '#000';
    // horizontal seam
    fr(ctx, cx - r + 1, cy - 1, r * 2 - 2, 2, '#000');
    // vertical seam
    fr(ctx, cx - 1, cy - r + 1, 2, r * 2 - 2, '#000');
    // curved seam hints (just two arcs drawn as thin pixel strips)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx - 2, cy, r - 2, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 2, cy, r - 2, Math.PI * 0.4, Math.PI * 1.6);
    ctx.stroke();
    // highlight
    fr(ctx, cx - Math.round(r * 0.4), cy - Math.round(r * 0.55), Math.round(r * 0.25), Math.round(r * 0.2), 'rgba(255,255,200,0.35)');
  }

  // Shadow under ball
  function drawBallShadow(ctx, cx, groundY, r, compression) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, groundY, r * compression, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── scanline overlay (optional retro touch) ────────────────────────────────

  function drawScanlines(ctx, W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < H; y += 2) {
      ctx.fillRect(0, y, W, 1);
    }
    ctx.restore();
  }

  // ── star-field background ──────────────────────────────────────────────────
  // Pre-seeded so it doesn't jump each frame

  const STARS = Array.from({ length: 40 }, (_, i) => ({
    x: ((i * 137.508 + 23) % 1) || ((i * 137.508) % 1), // pseudo-random via golden ratio
    y: ((i * 97.331 + 11) % 1) || ((i * 97.331) % 1),
    s: 1 + (i % 3),
    b: 0.3 + (i % 5) * 0.14,
  }));

  // Recompute to proper [0,1] range
  for (let i = 0; i < STARS.length; i++) {
    STARS[i].x = ((Math.sin(i * 2.399) + 1) / 2);
    STARS[i].y = ((Math.cos(i * 3.141) + 1) / 2);
  }

  function drawStars(ctx, W, H, frame) {
    for (const st of STARS) {
      const flicker = 0.6 + 0.4 * Math.sin(frame * 0.05 + st.x * 10);
      ctx.fillStyle = `rgba(255,255,255,${(st.b * flicker).toFixed(2)})`;
      ctx.fillRect(Math.round(st.x * W), Math.round(st.y * H * 0.5), st.s, st.s);
    }
  }

  // ── color scheme ──────────────────────────────────────────────────────────

  const C = {
    bg:        '#0d0005',   // very dark court
    court:     '#1a0505',   // dark burgundy court
    red:       '#ff1744',   // Heat red
    redDark:   '#b71c1c',
    orange:    '#ff6d00',
    white:     '#ffffff',
    gray:      '#888888',
    grayDark:  '#444444',
    yellow:    '#ffd600',
    green:     '#00e676',
    black:     '#000000',
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC: drawTitle(ctx, W, H, frame)
  // ══════════════════════════════════════════════════════════════════════════

  function drawTitle(ctx, W, H, frame) {
    // ── background ──
    fr(ctx, 0, 0, W, H, C.bg);

    // Court floor strip at bottom
    fr(ctx, 0, H - 60, W, 60, '#1a0808');
    fr(ctx, 0, H - 62, W, 2, C.red);

    // Stars in top half
    drawStars(ctx, W, H, frame);

    // ── "BAM BASKETBALL" — big pixel-art title ──
    // Line 1: "BAM"
    const titleY1 = Math.round(H * 0.12);
    const scale1  = 4; // each pixel block = 4 canvas px
    // Measure and center
    const bamW = measurePixelText('BAM', scale1);
    const bamX = Math.round((W - bamW) / 2);
    // Drop shadow
    drawPixelText(ctx, 'BAM', bamX + 2, titleY1 + 2, scale1, '#7b0000');
    drawPixelText(ctx, 'BAM', bamX, titleY1, scale1, C.red);

    // Line 2: "BASKETBALL"
    const titleY2  = titleY1 + 7 * scale1 + 6;
    const scale2   = 3;
    // Drop shadow
    drawPixelTextCentered(ctx, 'BASKETBALL', titleY2 + 2, scale2, '#7b0000', W);
    drawPixelTextCentered(ctx, 'BASKETBALL', titleY2, scale2, C.red, W);

    // ── subtitle ──
    const subY = titleY2 + 7 * scale2 + 14;
    nesText(ctx, 'DOUBLE DRIBBLE STYLE', W / 2, subY, 8, C.white);

    // ── decorative divider ──
    const divY = subY + 18;
    for (let i = 0; i < Math.floor(W / 8); i++) {
      if (i % 2 === 0) fr(ctx, i * 8, divY, 6, 2, C.red);
    }

    // ── bouncing basketball ──
    const ballR    = 18;
    const groundY  = H - 60 - ballR - 2;
    const bounceH  = H * 0.22; // max height above ground
    // Use |sin| for realistic bounce (spends more time near top)
    const t        = (frame * 0.05) % (Math.PI);
    const sinT     = Math.sin(t);
    const ballY    = groundY - Math.round(sinT * sinT * bounceH);
    const ballCX   = Math.round(W / 2);
    // Squash/stretch: wider + shorter when near ground
    const nearGround = 1 - sinT; // 0 at top, 1 at ground
    // Shadow (squishes and grows as ball nears ground)
    const shadowW = ballR * (1 + nearGround * 0.8);
    drawBallShadow(ctx, ballCX, groundY + ballR * 0.3, shadowW, 1);
    // Ball (slight squash near ground)
    ctx.save();
    ctx.translate(ballCX, ballY);
    const squashX = 1 + nearGround * 0.25;
    const squashY = 1 - nearGround * 0.20;
    ctx.scale(squashX, squashY);
    drawBall(ctx, 0, 0, ballR);
    ctx.restore();

    // ── "PRESS ENTER TO START" blinking ──
    const blink = Math.floor(frame / 30) % 2 === 0;
    if (blink) {
      nesText(ctx, 'PRESS ENTER TO START', W / 2, H - 40, 8, C.yellow);
    }

    // ── scanlines ──
    drawScanlines(ctx, W, H);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC: drawPauseMenu(ctx, W, H, selectedOption)
  // selectedOption: 0=RESUME, 1=RESTART, 2=QUIT
  // ══════════════════════════════════════════════════════════════════════════

  function drawPauseMenu(ctx, W, H, selectedOption) {
    // Semi-transparent overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Panel background
    const panelW = 240;
    const panelH = 180;
    const panelX = Math.round((W - panelW) / 2);
    const panelY = Math.round((H - panelH) / 2);

    fr(ctx, panelX, panelY, panelW, panelH, '#0d0005');
    // Border
    fr(ctx, panelX,               panelY,               panelW, 3, C.red);
    fr(ctx, panelX,               panelY + panelH - 3,  panelW, 3, C.red);
    fr(ctx, panelX,               panelY,               3, panelH, C.red);
    fr(ctx, panelX + panelW - 3,  panelY,               3, panelH, C.red);
    // Inner highlight
    fr(ctx, panelX + 3,           panelY + 3,           panelW - 6, 1, '#7b0000');
    fr(ctx, panelX + 3,           panelY + 3,           1, panelH - 6, '#7b0000');

    // "PAUSED" title
    const titleScale = 3;
    drawPixelTextCentered(ctx, 'PAUSED', panelY + 18, titleScale, C.red, W);

    // Divider
    fr(ctx, panelX + 10, panelY + 18 + 7 * titleScale + 8, panelW - 20, 2, C.redDark);

    // Menu options
    const OPTIONS = ['RESUME', 'RESTART', 'QUIT'];
    const optStartY = panelY + 18 + 7 * titleScale + 18;
    const optSpacing = 36;

    OPTIONS.forEach((opt, i) => {
      const oy     = optStartY + i * optSpacing;
      const active = i === selectedOption;
      const color  = active ? C.red : C.gray;
      const scale  = active ? 2 : 2;

      if (active) {
        // Selection highlight bar
        fr(ctx, panelX + 6, oy - 4, panelW - 12, 7 * scale + 8, '#2a0010');
        // Arrow cursor
        drawPixelText(ctx, '>', panelX + 12, oy, scale, C.yellow);
      }

      drawPixelTextCentered(ctx, opt, oy, scale, color, W);
    });

    drawScanlines(ctx, W, H);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC: drawGameOver(ctx, W, H, homeScore, awayScore, frame)
  // Home = Miami Heat, Away = Boston Celtics
  // ══════════════════════════════════════════════════════════════════════════

  function drawGameOver(ctx, W, H, homeScore, awayScore, frame) {
    // Background
    fr(ctx, 0, 0, W, H, C.bg);
    drawStars(ctx, W, H, frame);

    // Court strip
    fr(ctx, 0, H - 60, W, 60, '#1a0808');
    fr(ctx, 0, H - 62, W, 2, C.red);

    // Determine winner
    const heatWin    = homeScore > awayScore;
    const celticsWin = awayScore > homeScore;
    const tied       = homeScore === awayScore;

    // "GAME OVER" — big pixel title
    const goScale = 4;
    const goY     = Math.round(H * 0.08);
    drawPixelTextCentered(ctx, 'GAME', goY + 2, goScale, '#7b0000', W);
    drawPixelTextCentered(ctx, 'GAME', goY, goScale, C.red, W);
    const overY = goY + 7 * goScale + 4;
    drawPixelTextCentered(ctx, 'OVER', overY + 2, goScale, '#7b0000', W);
    drawPixelTextCentered(ctx, 'OVER', overY, goScale, C.red, W);

    // Divider
    const divY = overY + 7 * goScale + 10;
    for (let i = 0; i < Math.floor(W / 8); i++) {
      if (i % 2 === 0) fr(ctx, i * 8, divY, 6, 2, C.redDark);
    }

    // Score display
    const scoreY  = divY + 14;
    const scoreStr = `HEAT  ${String(homeScore).padStart(2, '0')} - ${String(awayScore).padStart(2, '0')}  CELTICS`;
    nesText(ctx, scoreStr, W / 2, scoreY, 8, C.white);

    // Team logos (simple colored blocks with initials)
    // Heat — red block
    const logoY = scoreY + 22;
    // Heat block
    fr(ctx, Math.round(W * 0.15), logoY, 40, 24, '#b71c1c');
    nesText(ctx, 'MIA', Math.round(W * 0.15) + 20, logoY + 6, 6, C.white);
    // Celtics block
    fr(ctx, Math.round(W * 0.72), logoY, 40, 24, '#1b5e20');
    nesText(ctx, 'BOS', Math.round(W * 0.72) + 20, logoY + 6, 6, C.white);

    // Winner announcement — flashing colors
    const winY    = logoY + 38;
    const flashOn = Math.floor(frame / 15) % 2 === 0;

    let winText, winColor;
    if (tied) {
      winText  = "IT'S A TIE!";
      winColor = flashOn ? C.yellow : C.white;
    } else if (heatWin) {
      winText  = 'HEAT WIN!';
      winColor = flashOn ? C.red : '#ff8a80';
    } else {
      winText  = 'CELTICS WIN!';
      winColor = flashOn ? '#00e676' : '#69f0ae';
    }

    const wScale = 3;
    // Glow pass
    drawPixelTextCentered(ctx, winText, winY + 2, wScale, 'rgba(0,0,0,0.6)', W);
    drawPixelTextCentered(ctx, winText, winY, wScale, winColor, W);

    // Final score large numerals
    const numY     = winY + 7 * wScale + 14;
    const numScale = 5;
    const hStr     = String(homeScore).padStart(2, '0');
    const aStr     = String(awayScore).padStart(2, '0');
    // Position home score left of center, away right
    const spacing  = 40;
    const dashX    = Math.round(W / 2);
    const hW       = measurePixelText(hStr, numScale);
    const aW       = measurePixelText(aStr, numScale);
    drawPixelText(ctx, hStr, dashX - spacing - hW, numY, numScale, heatWin ? C.red : C.gray);
    drawPixelText(ctx, '-',  dashX - Math.round(measurePixelText('-', numScale) / 2), numY + 6, numScale, C.white);
    drawPixelText(ctx, aStr, dashX + spacing, numY, numScale, celticsWin ? '#00e676' : C.gray);

    // "PRESS ENTER TO PLAY AGAIN" blinking
    const blink = Math.floor(frame / 30) % 2 === 0;
    if (blink) {
      nesText(ctx, 'PRESS ENTER TO PLAY AGAIN', W / 2, H - 40, 6, C.yellow);
    }

    drawScanlines(ctx, W, H);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC: drawQuarterBreak(ctx, W, H, quarter)
  // quarter: 1-4 = end of that quarter; use 0 or special value for halftime
  // ══════════════════════════════════════════════════════════════════════════

  function drawQuarterBreak(ctx, W, H, quarter) {
    // Full overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Panel
    const panelW = 300;
    const panelH = 120;
    const panelX = Math.round((W - panelW) / 2);
    const panelY = Math.round((H - panelH) / 2);

    fr(ctx, panelX, panelY, panelW, panelH, '#0d0005');
    // Border
    fr(ctx, panelX,              panelY,              panelW, 3, C.red);
    fr(ctx, panelX,              panelY + panelH - 3, panelW, 3, C.red);
    fr(ctx, panelX,              panelY,              3, panelH, C.red);
    fr(ctx, panelX + panelW - 3, panelY,              3, panelH, C.red);

    const scale = 2;

    if (quarter === 2) {
      // End of Q2 = halftime
      drawPixelTextCentered(ctx, 'HALFTIME', panelY + 22, scale + 1, C.yellow, W);
      drawPixelTextCentered(ctx, 'HEAD TO THE LOCKER ROOM', panelY + 22 + 7 * (scale + 1) + 12, scale, C.white, W);
    } else {
      const isEnd = quarter >= 4;
      const line1 = isEnd ? 'END OF GAME' : `END OF QUARTER ${quarter}`;
      const line2 = isEnd ? 'FINAL WHISTLE' : `QUARTER ${quarter + 1} COMING UP`;

      drawPixelTextCentered(ctx, line1, panelY + 22, scale, C.red, W);
      drawPixelTextCentered(ctx, line2, panelY + 22 + 7 * scale + 16, scale, C.white, W);
    }

    // Small decorative corners
    const cs = 6;
    fr(ctx, panelX + 4,              panelY + 4,              cs, 2, C.redDark);
    fr(ctx, panelX + 4,              panelY + 4,              2, cs, C.redDark);
    fr(ctx, panelX + panelW - 4 - cs, panelY + 4,             cs, 2, C.redDark);
    fr(ctx, panelX + panelW - 6,     panelY + 4,              2, cs, C.redDark);
    fr(ctx, panelX + 4,              panelY + panelH - 6,     cs, 2, C.redDark);
    fr(ctx, panelX + 4,              panelY + panelH - 4 - cs, 2, cs, C.redDark);
    fr(ctx, panelX + panelW - 4 - cs, panelY + panelH - 6,   cs, 2, C.redDark);
    fr(ctx, panelX + panelW - 6,     panelY + panelH - 4 - cs, 2, cs, C.redDark);

    drawScanlines(ctx, W, H);
  }

  // ── public API ─────────────────────────────────────────────────────────────

  return {
    drawTitle,
    drawPauseMenu,
    drawGameOver,
    drawQuarterBreak,
    // Expose helpers in case game engine wants to reuse them
    drawPixelText,
    drawPixelTextCentered,
    measurePixelText,
    nesText,
    drawBall,
  };

})();

// CommonJS / ES module compatibility shim
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TitleScreen;
}
