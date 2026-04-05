/**
 * BallPhysics.js
 * Double Dribble-style 8-bit basketball physics module
 * Court: 256x240 (NES resolution), horizontal layout
 * Left hoop: x~20, Right hoop: x~236
 */

const BallPhysics = (() => {

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const COURT_W        = 256;
  const COURT_H        = 240;
  const GRAVITY        = 0.45;       // px/frame^2 downward on z-axis
  const FRICTION       = 0.88;       // rolling friction (loose state)
  const WALL_BOUNCE    = 0.55;       // energy kept on wall bounce
  const GROUND_BOUNCE  = 0.52;       // energy kept on ground bounce
  const PASS_SPEED     = 4.0;        // px/frame for passes
  const DRIBBLE_PEAK   = 8;          // max z height while dribbling (px)
  const DRIBBLE_SPEED  = 0.18;       // oscillation speed (radians/frame)
  const HOOP_RADIUS    = 6;          // scoring window radius (px)
  const HOOP_HEIGHT    = 16;         // z value representing the hoop rim height
  const BALL_RADIUS    = 4;          // visual radius of ball
  const BALL_COLOR     = '#E8600A';  // NES orange-ish
  const BALL_STRIPE    = '#8B2500';  // seam color (dark)
  const SHADOW_COLOR   = 'rgba(0,0,0,0.35)';
  const MIN_BOUNCE_VZ  = 1.2;        // below this vz, ball stops bouncing

  // ---------------------------------------------------------------------------
  // Ball state object
  // ---------------------------------------------------------------------------
  const ball = {
    x:      128,   // court x position
    y:      120,   // court y position (2D screen plane)
    z:      0,     // height above the ground plane (px)
    vx:     0,     // velocity x
    vy:     0,     // velocity y
    vz:     0,     // velocity z (upward positive)
    holder: null,  // reference to player object (must have .x and .y)
    state:  'held',

    // internal
    _dribblePhase:   0,     // oscillation phase for dribble animation
    _dribbleOffset:  0,     // current computed z during dribble
    _passTarget:     null,  // {x, y} destination for pass
    _passNorm:       null,  // {dx, dy} unit vector for pass
    _shotTarget:     null,  // {x, y} hoop destination for shot
    _shotDescending: false, // true once arc peak has passed
    _shotTotalTime:  0,     // total frames the shot arc spans
    _shotElapsed:    0,     // frames elapsed since shot started
    _shotStartX:     0,
    _shotStartY:     0,
    _shotVx:         0,
    _shotVy:         0,
    _scoreChecked:   false, // prevent double-scoring per shot
  };

  // ---------------------------------------------------------------------------
  // shoot(fromX, fromY, toHoopX, toHoopY)
  // Launches a parabolic arc toward the hoop.
  // Arc height scales with distance so a corner three soars higher.
  // ---------------------------------------------------------------------------
  function shoot(fromX, fromY, toHoopX, toHoopY) {
    const dx   = toHoopX - fromX;
    const dy   = toHoopY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Tune arc: farther shots get more hang time
    const frames     = Math.max(18, Math.min(40, dist * 0.28));
    const arcPeak    = Math.max(20, dist * 0.35);   // z units above hoop height

    // Horizontal velocity (constant during flight)
    const vx = dx / frames;
    const vy = dy / frames;

    // Vertical: vz must carry ball up to arcPeak then down to HOOP_HEIGHT
    // Using kinematics: peak reached at t_peak, then descends to HOOP_HEIGHT at t=frames
    // Simplified: pick vz so that z peaks nicely
    // z(t) = z0 + vz*t - 0.5*GRAVITY*t^2
    // We want z(frames) = HOOP_HEIGHT and peak somewhere in the middle
    // Solve: HOOP_HEIGHT = 0 + vz*frames - 0.5*GRAVITY*frames^2
    // vz = (HOOP_HEIGHT + 0.5*GRAVITY*frames^2) / frames
    // But we also want a visible arc above hoop, so we push vz up by arcPeak factor
    const vz = (HOOP_HEIGHT + 0.5 * GRAVITY * frames * frames + arcPeak) / frames;

    ball.x             = fromX;
    ball.y             = fromY;
    ball.z             = 0;
    ball.vx            = vx;
    ball.vy            = vy;
    ball.vz            = vz;
    ball.holder        = null;
    ball.state         = 'shooting';
    ball._shotTarget   = { x: toHoopX, y: toHoopY };
    ball._shotDescending = false;
    ball._shotTotalTime  = frames;
    ball._shotElapsed    = 0;
    ball._shotStartX     = fromX;
    ball._shotStartY     = fromY;
    ball._shotVx         = vx;
    ball._shotVy         = vy;
    ball._scoreChecked   = false;
  }

  // ---------------------------------------------------------------------------
  // pass(fromX, fromY, toX, toY)
  // Sends the ball in a straight line at PASS_SPEED.
  // ---------------------------------------------------------------------------
  function pass(fromX, fromY, toX, toY) {
    const dx   = toX - fromX;
    const dy   = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx   = dx / dist;
    const ny   = dy / dist;

    ball.x            = fromX;
    ball.y            = fromY;
    ball.z            = 4;      // slight elevation so pass looks clean
    ball.vx           = nx * PASS_SPEED;
    ball.vy           = ny * PASS_SPEED;
    ball.vz           = 0;
    ball.holder       = null;
    ball.state        = 'passing';
    ball._passTarget  = { x: toX, y: toY };
    ball._passNorm    = { dx: nx, dy: ny };
    ball._scoreChecked = false;
  }

  // ---------------------------------------------------------------------------
  // checkScore(hoopX, hoopY)
  // Returns true if the ball is in a valid scoring position:
  //   - state is 'shooting'
  //   - within HOOP_RADIUS of the hoop center (x,y)
  //   - z is near HOOP_HEIGHT (within ±4px)
  //   - ball is descending (vz < 0)
  // ---------------------------------------------------------------------------
  function checkScore(hoopX, hoopY) {
    if (ball._scoreChecked) return false;
    if (ball.state !== 'shooting') return false;

    const dx   = ball.x - hoopX;
    const dy   = ball.y - hoopY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const zNearHoop = Math.abs(ball.z - HOOP_HEIGHT) < 4;
    const inRadius  = dist <= HOOP_RADIUS;
    const descending = ball.vz < 0;

    if (inRadius && zNearHoop && descending) {
      ball._scoreChecked = true;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // drawShadow(ctx)
  // ---------------------------------------------------------------------------
  function drawShadow(ctx) {
    if (ball.z <= 0) return;

    // Shadow shrinks and fades as ball rises
    const maxZ       = 48;
    const zClamped   = Math.min(ball.z, maxZ);
    const scale      = 1 - (zClamped / maxZ) * 0.7;
    const shadowR    = BALL_RADIUS * scale;
    const alphaScale = 1 - (zClamped / maxZ) * 0.6;

    ctx.save();
    ctx.globalAlpha = 0.35 * alphaScale;
    ctx.fillStyle   = '#000000';
    ctx.beginPath();
    ctx.ellipse(ball.x, ball.y, shadowR * 1.4, shadowR * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // drawBall(ctx)
  // Draws the basketball: orange circle with two seam arcs.
  // When z > 0 the ball is drawn offset upward by z (perspective simplification).
  // ---------------------------------------------------------------------------
  function drawBall(ctx) {
    // Shadow is drawn at ground level (ball.y), ball is drawn higher
    const drawY = ball.y - ball.z * 0.5;  // project z upward on screen

    ctx.save();

    // Main ball circle
    ctx.fillStyle = BALL_COLOR;
    ctx.beginPath();
    ctx.arc(ball.x, drawY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Simple seam lines (NES-style, just two crossing arcs)
    ctx.strokeStyle = BALL_STRIPE;
    ctx.lineWidth   = 0.8;

    // Vertical seam
    ctx.beginPath();
    ctx.arc(ball.x, drawY, BALL_RADIUS, -Math.PI * 0.7, Math.PI * 0.7);
    ctx.stroke();

    // Horizontal seam
    ctx.beginPath();
    ctx.arc(ball.x, drawY, BALL_RADIUS, Math.PI * 0.3, Math.PI * 1.7);
    ctx.stroke();

    // Highlight dot (top-left, 1px)
    ctx.fillStyle = 'rgba(255,220,160,0.7)';
    ctx.beginPath();
    ctx.arc(ball.x - 1.5, drawY - 1.5, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // update(dt)
  // dt is a delta multiplier (pass 1 for 60fps-locked, or actual delta)
  // ---------------------------------------------------------------------------
  function update(dt) {
    dt = dt || 1;

    switch (ball.state) {

      // -----------------------------------------------------------------------
      case 'held':
        if (ball.holder) {
          ball.x  = ball.holder.x;
          ball.y  = ball.holder.y;
          ball.z  = 4;   // resting at hip height
          ball.vx = 0;
          ball.vy = 0;
          ball.vz = 0;
        }
        break;

      // -----------------------------------------------------------------------
      case 'dribbling':
        if (ball.holder) {
          ball.x = ball.holder.x;
          ball.y = ball.holder.y;

          // Oscillate z between 0 and DRIBBLE_PEAK using absolute sine
          ball._dribblePhase = (ball._dribblePhase + DRIBBLE_SPEED * dt) % (Math.PI);
          ball._dribbleOffset = Math.abs(Math.sin(ball._dribblePhase)) * DRIBBLE_PEAK;
          ball.z = ball._dribbleOffset;

          // Small horizontal jitter so it looks like a real dribble pat
          ball.vx = (ball.holder.vx || 0) * 0.5;
          ball.vy = (ball.holder.vy || 0) * 0.5;
        }
        break;

      // -----------------------------------------------------------------------
      case 'passing': {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // Slight arc: z oscillates a little then decays
        ball.z = Math.max(0, ball.z - 0.12 * dt);

        // Check if we overshot the target
        if (ball._passTarget) {
          const dx = ball._passTarget.x - ball.x;
          const dy = ball._passTarget.y - ball.y;
          // Dot product with original direction: negative means we passed it
          const dot = dx * ball._passNorm.dx + dy * ball._passNorm.dy;
          if (dot <= 0) {
            // Arrived — snap to target, go loose so a player can pick it up
            ball.x    = ball._passTarget.x;
            ball.y    = ball._passTarget.y;
            ball.z    = 0;
            ball.vx   = 0;
            ball.vy   = 0;
            ball.state = 'loose';
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      case 'shooting': {
        ball._shotElapsed += dt;

        // Integrate position
        ball.x  += ball.vx * dt;
        ball.y  += ball.vy * dt;
        ball.z  += ball.vz * dt;
        ball.vz -= GRAVITY * dt;

        // Track whether we have passed the arc peak
        if (ball.vz < 0) {
          ball._shotDescending = true;
        }

        // If ball hits ground before reaching hoop it's a miss — go loose
        if (ball.z <= 0 && ball._shotElapsed > 2) {
          ball.z  = 0;
          ball.vz = 0;
          ball.state = 'loose';
        }
        break;
      }

      // -----------------------------------------------------------------------
      case 'loose': {
        // Apply friction
        ball.vx *= FRICTION;
        ball.vy *= FRICTION;

        // Gravity pulls toward ground
        if (ball.z > 0) {
          ball.vz -= GRAVITY * dt;
        } else {
          ball.z = 0;
          if (ball.vz < 0) {
            const bounce = -ball.vz * GROUND_BOUNCE;
            ball.vz = bounce > MIN_BOUNCE_VZ ? bounce : 0;
          }
        }

        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.z += ball.vz * dt;

        // Wall collisions (left/right)
        if (ball.x - BALL_RADIUS < 0) {
          ball.x  = BALL_RADIUS;
          ball.vx = Math.abs(ball.vx) * WALL_BOUNCE;
        } else if (ball.x + BALL_RADIUS > COURT_W) {
          ball.x  = COURT_W - BALL_RADIUS;
          ball.vx = -Math.abs(ball.vx) * WALL_BOUNCE;
        }

        // Wall collisions (top/bottom of court)
        if (ball.y - BALL_RADIUS < 0) {
          ball.y  = BALL_RADIUS;
          ball.vy = Math.abs(ball.vy) * WALL_BOUNCE;
        } else if (ball.y + BALL_RADIUS > COURT_H) {
          ball.y  = COURT_H - BALL_RADIUS;
          ball.vy = -Math.abs(ball.vy) * WALL_BOUNCE;
        }

        // Stop rolling once very slow
        if (Math.abs(ball.vx) < 0.05) ball.vx = 0;
        if (Math.abs(ball.vy) < 0.05) ball.vy = 0;
        break;
      }

      // -----------------------------------------------------------------------
      case 'dead':
        // Ball is out of play — do nothing
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Convenience helpers exposed on the module
  // ---------------------------------------------------------------------------

  /** Pick up the ball (player grabs it) */
  function pickup(player) {
    ball.holder = player;
    ball.state  = 'held';
    ball.vx     = 0;
    ball.vy     = 0;
    ball.vz     = 0;
  }

  /** Start dribbling (must be holding first) */
  function startDribble(player) {
    ball.holder       = player;
    ball.state        = 'dribbling';
    ball._dribblePhase = 0;
  }

  /** Release ball as loose (e.g. turnover, tip) */
  function release(vx, vy) {
    ball.holder = null;
    ball.state  = 'loose';
    ball.vx     = vx || 0;
    ball.vy     = vy || 0;
    ball.vz     = 0.5;
  }

  /** Reset ball to center court, held by no one */
  function reset(x, y) {
    ball.x             = x !== undefined ? x : COURT_W / 2;
    ball.y             = y !== undefined ? y : COURT_H / 2;
    ball.z             = 0;
    ball.vx            = 0;
    ball.vy            = 0;
    ball.vz            = 0;
    ball.holder        = null;
    ball.state         = 'loose';
    ball._scoreChecked = false;
    ball._dribblePhase = 0;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  return {
    ball,
    update,
    shoot,
    pass,
    checkScore,
    drawBall,
    drawShadow,
    // helpers
    pickup,
    startDribble,
    release,
    reset,
    // expose constants for external use
    COURT_W,
    COURT_H,
    HOOP_HEIGHT,
    HOOP_RADIUS,
    BALL_RADIUS,
  };

})();

// CommonJS + ES module dual export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BallPhysics;
}
