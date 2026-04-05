/** GameState.js — converted from ES module to IIFE for browser globals */
const GameState = (() => {
  class _GameState {
    constructor(options = {}) {
      this.homeTeam = options.homeTeam || 'HEAT';
      this.awayTeam = options.awayTeam || 'CELTICS';
      this.homeScore = 0;
      this.awayScore = 0;
      this.QUARTER_FRAMES = 5400; // 90 seconds at 60fps (faster for fun)
      this.SHOT_CLOCK_FRAMES = 1440;
      this.TOTAL_QUARTERS = 4;
      this.quarter = 1;
      this.quarterTime = this.QUARTER_FRAMES;
      this.shotClock = this.SHOT_CLOCK_FRAMES;
      this.possession = 'home';
      this.gameState = 'tipoff';
      this.lastScorer = null;
      this.lastPoints = 0;
      this._scoredHoldFrames = 120;
      this._scoredHoldRemaining = 0;
      this._quarterEndHoldFrames = 180;
      this._quarterEndHoldRemaining = 0;
      this._overtimePlayed = 0;
    }
    update() {
      switch (this.gameState) {
        case 'playing': this._tickClocks(); break;
        case 'scored':
          this._scoredHoldRemaining--;
          if (this._scoredHoldRemaining <= 0) this.gameState = 'playing';
          break;
        case 'quarterEnd': case 'halftime':
          this._quarterEndHoldRemaining--;
          if (this._quarterEndHoldRemaining <= 0) this._advanceQuarter();
          break;
      }
    }
    _tickClocks() {
      if (this.shotClock > 0) {
        this.shotClock--;
        if (this.shotClock === 0) { this.onShotClockViolation(); return; }
      }
      if (this.quarterTime > 0) {
        this.quarterTime--;
        if (this.quarterTime === 0) this._endQuarter();
      }
    }
    onScore(team, points) {
      if (this.gameState === 'gameover') return;
      points = Math.max(1, Math.min(3, points));
      if (team === 'home') this.homeScore += points; else this.awayScore += points;
      this.lastScorer = team;
      this.lastPoints = points;
      this.shotClock = this.SHOT_CLOCK_FRAMES;
      this.possession = team === 'home' ? 'away' : 'home';
      this.gameState = 'scored';
      this._scoredHoldRemaining = this._scoredHoldFrames;
    }
    onTurnover(newPoss) {
      if (this.gameState !== 'playing') return;
      this.possession = newPoss;
      this.shotClock = this.SHOT_CLOCK_FRAMES;
    }
    onShotClockViolation() {
      if (this.gameState !== 'playing') return;
      this.onTurnover(this.possession === 'home' ? 'away' : 'home');
    }
    startQuarter() {
      this.quarterTime = this.QUARTER_FRAMES;
      this.shotClock = this.SHOT_CLOCK_FRAMES;
      this.gameState = 'playing';
    }
    _endQuarter() {
      if (this.quarter === 2) {
        this.gameState = 'halftime';
        this._quarterEndHoldRemaining = this._quarterEndHoldFrames;
      } else if (this.quarter >= this.TOTAL_QUARTERS) {
        if (this.homeScore !== this.awayScore) this.gameState = 'gameover';
        else { this.TOTAL_QUARTERS++; this._overtimePlayed++; this.gameState = 'quarterEnd'; this._quarterEndHoldRemaining = this._quarterEndHoldFrames; }
      } else {
        this.gameState = 'quarterEnd';
        this._quarterEndHoldRemaining = this._quarterEndHoldFrames;
      }
    }
    _advanceQuarter() {
      this.quarter++;
      this.possession = this.quarter % 2 === 0 ? 'away' : 'home';
      this.startQuarter();
    }
    isGameOver() { return this.gameState === 'gameover'; }
    getTimeString() {
      const s = Math.ceil(this.quarterTime / 60);
      const m = Math.floor(s / 60);
      const sec = s % 60;
      let label = this._overtimePlayed > 0 && this.quarter > 4
        ? (this._overtimePlayed === 1 ? 'OT' : 'OT' + this._overtimePlayed)
        : 'Q' + this.quarter;
      return label + ' ' + m + ':' + String(sec).padStart(2, '0');
    }
    getShotClockString() { return String(Math.ceil(this.shotClock / 60)).padStart(2, ' '); }
    drawHUD(ctx, W, H) {
      const BAR = 24;
      ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, W, BAR + 10);
      ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, W * 0.35, BAR);
      ctx.fillStyle = '#2e1a1a'; ctx.fillRect(W * 0.65, 0, W * 0.35, BAR);
      ctx.fillStyle = '#0e0e1e'; ctx.fillRect(W * 0.35, 0, W * 0.30, BAR);
      ctx.fillStyle = '#444'; ctx.fillRect(0, BAR, W, 1);
      const my = BAR / 2 + 1;
      ctx.textBaseline = 'middle';
      ctx.font = '8px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#88c'; ctx.fillText(this.awayTeam, 4, my);
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.fillText(String(this.awayScore), W * 0.35 - 8, my);
      ctx.textAlign = 'left'; ctx.fillText(String(this.homeScore), W * 0.65 + 8, my);
      ctx.font = '8px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#c88'; ctx.fillText(this.homeTeam, W - 4, my);
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fd4'; ctx.fillText(this.getTimeString(), W / 2, my);
      // Shot clock
      const sc = Math.ceil(this.shotClock / 60);
      ctx.fillStyle = sc <= 5 ? '#f33' : sc <= 10 ? '#fa2' : '#4c8';
      ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText(sc, W / 2, BAR + 7);
      // Scored flash
      if (this.gameState === 'scored') {
        ctx.fillStyle = 'rgba(255,255,0,0.15)'; ctx.fillRect(0, 0, W, BAR);
      }
    }
  }
  return { create: (opts) => new _GameState(opts) };
})();
