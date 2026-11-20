// Particles, skid marks and floating score texts: the game's effects layer.
// A fixed pool of short-lived particles (smoke, sparks, muzzle flash, dust),
// a trail of fading skid marks left by hard cornering, and little floating
// texts ("+$50", "WANTED +1") that rise and fade. No drawing of the world
// itself here — render.js asks this module what to paint.

export function createParticles() {
  const pool = [];
  for (let i = 0; i < 160; i++) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#fff', grow: 0, gravity: 0 });
  }
  const skids = [];
  const floats = [];

  function free() {
    for (const p of pool) if (!p.active) return p;
    return null;
  }

  function spawn(x, y, vx, vy, life, size, color, grow = 0, gravity = 0) {
    const p = free();
    if (!p) return;
    p.active = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life; p.size = size; p.color = color;
    p.grow = grow; p.gravity = gravity;
  }

  function smoke(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      spawn(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 30, -20 - Math.random() * 30,
        0.5 + Math.random() * 0.5, 4 + Math.random() * 5, 'rgba(120,120,120,0.55)', 14, -30);
    }
  }

  function sparks(x, y, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 120 + Math.random() * 260;
      spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.25 + Math.random() * 0.25, 2 + Math.random() * 2, '#ffd94a', 0, 300);
    }
  }

  function muzzle(x, y, angle) {
    spawn(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, Math.cos(angle) * 60, Math.sin(angle) * 60, 0.07, 9, '#ffe9a3');
    spawn(x, y, 0, 0, 0.05, 14, 'rgba(255, 220, 120, 0.6)');
  }

  function dust(x, y, n = 3) {
    for (let i = 0; i < n; i++) {
      spawn(x + (Math.random() - 0.5) * 16, y + (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40,
        0.4 + Math.random() * 0.3, 3 + Math.random() * 4, 'rgba(210, 190, 150, 0.5)', 10, 0);
    }
  }

  function skid(x, y, angle) {
    skids.push({ x, y, angle, life: 4 });
    if (skids.length > 220) skids.shift();
  }

  function floatText(x, y, text, color = '#f2c94c') {
    floats.push({ x, y, text, color, life: 1.4 });
    if (floats.length > 24) floats.shift();
  }

  function step(dt) {
    for (const p of pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
    }
    for (let i = skids.length - 1; i >= 0; i--) {
      skids[i].life -= dt;
      if (skids[i].life <= 0) skids.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
  }

  return { spawn, smoke, sparks, muzzle, dust, skid, floatText, step, pool, skids, floats };
}
