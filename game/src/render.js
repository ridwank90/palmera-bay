// Everything the player sees: the city (water, sand, roads, buildings, palms,
// the docks), the cars and people on it, the effects, the HUD with the wanted
// stars, health, cash, objective and minimap, and the title, pause and
// busted/wasted/story screens. Drawing only — it never changes game state.

import { BEACH, CAR, FONT, MARINA, PALETTE, PLAYER, ROADS, VIEW, WORLD } from './config.js';

const MINIMAP = { x: VIEW.width - 216, y: VIEW.height - 166, w: 200, h: 150 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, x, y, angle, color, sporty, wrecked, taxi = false, van = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const len = van ? CAR.length + 16 : sporty ? CAR.length + 6 : CAR.length;
  const wid = van ? CAR.width + 4 : CAR.width;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 4, len, wid, 8);
  ctx.fill();
  ctx.fillStyle = wrecked ? '#3a3a3a' : color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Roof panel, slightly darker than the body.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, -len * 0.18, -wid / 2 + 4, len * 0.36, wid - 8, 4);
  ctx.fill();
  // Windshield and rear window.
  ctx.fillStyle = 'rgba(20, 30, 40, 0.85)';
  roundRect(ctx, len * 0.12, -wid / 2 + 3, len * 0.22, wid - 6, 3);
  ctx.fill();
  roundRect(ctx, -len * 0.34, -wid / 2 + 3, len * 0.16, wid - 6, 3);
  ctx.fill();
  // A taxi gets its checkered band and roof sign; a sporty car, a spoiler.
  if (taxi) {
    ctx.fillStyle = PALETTE.taxiCheck;
    for (let i = 0; i < 5; i++) ctx.fillRect(-len * 0.1 + i * 6, -wid / 2, 3, 3);
    ctx.fillRect(-4, -wid / 2 - 6, 8, 5);
  }
  if (sporty) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-len / 2 - 2, -wid / 2 - 2, 4, wid + 4);
  }
  // Headlights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 4);
  ctx.fillRect(len / 2 - 2, wid / 2 - 6, 3, 4);
  ctx.restore();
}

function drawPersonShape(ctx, x, y, angle, shirt, isPlayer, isEnemy, health01, size = 11, hat = false, hatColor = '#888') {
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, size, size * 0.64, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // A hat for the sun — a brim and a dome, drawn before the facing nub.
  if (hat) {
    ctx.fillStyle = hatColor;
    ctx.beginPath();
    ctx.arc(0, 0, size + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, size - 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player gets a white ring, so Jax never blends into the crowd.
  if (isPlayer) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, size + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Facing nub: a gun for enemies, a cap brim for the player.
  if (isEnemy) {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 12, 4);
  } else if (isPlayer) {
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(6, -8, 8, 16);
  }
  ctx.restore();
  if (isEnemy && health01 !== undefined) {
    const bw = size * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - bw / 2, y - size - 13, bw, 4);
    ctx.fillStyle = health01 > 0.5 ? '#58d68d' : '#e5534b';
    ctx.fillRect(x - bw / 2, y - size - 13, bw * health01, 4);
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawCity(world) {
    const city = world.city;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // Parks: darker grass.
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.grassDark;
      ctx.fillRect(park.x0, park.y0, park.x1 - park.x0, park.y1 - park.y0);
    }
    // Beach sand and the sea.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, BEACH.top, WORLD.width, BEACH.waterTop - BEACH.top);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, BEACH.waterTop, WORLD.width, WORLD.height - BEACH.waterTop);
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(0, BEACH.waterTop + 26, WORLD.width, 10);
    // The bay, east of the marina.
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(2350, 0, WORLD.width - 2350, MARINA.y1);
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(2350, 0, 12, MARINA.y1);
    // Animated wave lines on the sea and the bay, drifting with the clock.
    const waveT = world.state.time;
    ctx.strokeStyle = PALETTE.waterShine;
    ctx.lineWidth = 2;
    for (let wy = BEACH.waterTop + 8; wy < WORLD.height - 4; wy += 18) {
      ctx.beginPath();
      for (let wx = 0; wx <= WORLD.width; wx += 40) {
        const yy = wy + Math.sin(wx * 0.012 + waveT * 1.4 + wy * 0.05) * 3;
        if (wx === 0) ctx.moveTo(wx, yy);
        else ctx.lineTo(wx, yy);
      }
      ctx.stroke();
    }
    for (let wx = 2362; wx < WORLD.width - 4; wx += 18) {
      ctx.beginPath();
      for (let wy = 0; wy <= MARINA.y1; wy += 40) {
        const xx = wx + Math.sin(wy * 0.012 + waveT * 1.2 + wx * 0.05) * 3;
        if (wy === 0) ctx.moveTo(xx, wy);
        else ctx.lineTo(xx, wy);
      }
      ctx.stroke();
    }
    // Beach umbrellas with a towel beside each one.
    for (const u of city.umbrellas) {
      ctx.fillStyle = '#f1faee';
      ctx.fillRect(u.x - 14, u.y + 12, 12, 20);
      ctx.strokeStyle = '#8a6b4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(u.x, u.y - 16);
      ctx.stroke();
      ctx.fillStyle = u.color;
      ctx.beginPath();
      ctx.arc(u.x, u.y - 16, 15, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Boardwalk along the beach.
    ctx.fillStyle = '#c9a06c';
    ctx.fillRect(0, BEACH.top - 18, WORLD.width, 18);
    // Sidewalks, then roads.
    const half = ROADS.width / 2;
    ctx.fillStyle = PALETTE.sidewalk;
    for (const vx of ROADS.vertical) ctx.fillRect(vx - half - 12, 0, ROADS.width + 24, BEACH.top + 12);
    for (const hy of ROADS.horizontal) ctx.fillRect(0, hy - half - 12, WORLD.width, ROADS.width + 24);
    ctx.fillStyle = PALETTE.road;
    for (const vx of ROADS.vertical) ctx.fillRect(vx - half, 0, ROADS.width, BEACH.top);
    for (const hy of ROADS.horizontal) ctx.fillRect(0, hy - half, WORLD.width, ROADS.width);
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const vx of ROADS.vertical) {
      for (let y = 20; y < BEACH.top; y += 56) ctx.fillRect(vx - 2, y, 4, 28);
    }
    for (const hy of ROADS.horizontal) {
      for (let x = 20; x < WORLD.width; x += 56) ctx.fillRect(x, hy - 2, 28, 4);
    }
    // Crosswalks: zebra stripes across every intersection.
    ctx.fillStyle = PALETTE.crosswalk;
    for (const vx of ROADS.vertical) {
      for (const hy of ROADS.horizontal) {
        for (let i = -3; i <= 3; i++) {
          ctx.fillRect(vx - 40 + i * 12, hy - 46, 6, 14);
          ctx.fillRect(vx - 40 + i * 12, hy + 32, 6, 14);
        }
      }
    }
    // Streetlamps along the vertical roads.
    for (const lamp of city.lamps) {
      ctx.strokeStyle = '#2c2f38';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lamp.x, lamp.y);
      ctx.lineTo(lamp.x, lamp.y - 16);
      ctx.stroke();
      ctx.fillStyle = '#ffe9a3';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y - 18, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Docks: wooden piers into the bay, with moored boats.
    for (const pier of city.piers) {
      ctx.fillStyle = '#8a6b4a';
      ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
      ctx.fillStyle = '#6d5439';
      for (let x = pier.x + 8; x < pier.x + pier.w; x += 24) ctx.fillRect(x, pier.y, 2, pier.h);
    }
    const boats = [
      { x: 2420, y: 300, a: 0.2 }, { x: 2460, y: 470, a: -0.15 }, { x: 2410, y: 610, a: 0.1 }, { x: 2500, y: 180, a: 0.4 },
    ];
    for (const boat of boats) {
      ctx.save();
      ctx.translate(boat.x, boat.y);
      ctx.rotate(boat.a);
      ctx.fillStyle = '#f1faee';
      roundRect(ctx, -34, -10, 68, 20, 8);
      ctx.fill();
      ctx.fillStyle = '#3d7ea6';
      roundRect(ctx, -12, -7, 24, 14, 4);
      ctx.fill();
      ctx.restore();
    }
    // Buildings: shadow, roof, roof detail — the sun hits the top and left edges.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + b.height * 0.4, b.y + b.height * 0.4, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, Math.min(14, b.h / 4));
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x, b.y, b.w, 3);
      ctx.fillRect(b.x, b.y, 3, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h - 12, 16, 12);
      // Rooftop life: a pool, a garden, or an air-con unit.
      if (b.roof === 'pool' && b.w > 60 && b.h > 50) {
        ctx.fillStyle = '#3d7ea6';
        roundRect(ctx, b.x + b.w / 2 - 18, b.y + b.h / 2 - 12, 36, 24, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        roundRect(ctx, b.x + b.w / 2 - 14, b.y + b.h / 2 - 8, 28, 5, 2);
        ctx.fill();
      } else if (b.roof === 'garden') {
        ctx.fillStyle = '#5d8a5a';
        ctx.fillRect(b.x + 10, b.y + 10, Math.max(10, b.w - 20), Math.min(16, b.h - 20));
        ctx.fillStyle = '#3f8f4f';
        for (let gx = b.x + 16; gx < b.x + b.w - 12; gx += 14) ctx.fillRect(gx, b.y + 13, 5, 5);
      } else if (b.roof === 'ac') {
        ctx.fillStyle = '#8a8f98';
        ctx.fillRect(b.x + b.w - 22, b.y + 10, 12, 12);
        ctx.fillRect(b.x + 10, b.y + b.h - 22, 12, 12);
      }
    }
    // Shopfronts: a striped awning and the shop's name over the door.
    for (const shop of city.shops) {
      ctx.fillStyle = shop.color;
      ctx.fillRect(shop.x, shop.y, shop.w, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let sx = shop.x; sx < shop.x + shop.w; sx += 16) ctx.fillRect(sx, shop.y, 8, 10);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(shop.name, shop.x + shop.w / 2, shop.y - 6);
      ctx.textAlign = 'left';
    }
    // Warm sun glow from the north-west, over the whole city.
    const glow = ctx.createRadialGradient(200, 100, 100, 200, 100, 1600);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // Palms.
    for (const palm of city.palms) {
      ctx.strokeStyle = PALETTE.palmTrunk;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + 3, palm.y - 14 * palm.s);
      ctx.stroke();
      ctx.fillStyle = PALETTE.palmLeaf;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + palm.x;
        ctx.beginPath();
        ctx.ellipse(palm.x + 3 + Math.cos(a) * 9 * palm.s, palm.y - 14 * palm.s + Math.sin(a) * 6 * palm.s, 9 * palm.s, 4 * palm.s, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawMarker(world, objective) {
    if (!objective) return;
    const t = world.state.time;
    const pulse = 1 + Math.sin(t * 5) * 0.12;
    ctx.save();
    ctx.translate(objective.x, objective.y);
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.25 + Math.sin(t * 5) * 0.1;
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(0, 0, 18 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.marker;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(objective.label, 0, -36);
    ctx.restore();
  }

  function drawMinimap(world) {
    const sx = MINIMAP.w / WORLD.width;
    const sy = MINIMAP.h / WORLD.height;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 16, 24, 0.85)';
    roundRect(ctx, MINIMAP.x - 6, MINIMAP.y - 6, MINIMAP.w + 12, MINIMAP.h + 12, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    ctx.clip();
    ctx.fillStyle = '#5d8a5a';
    ctx.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(MINIMAP.x, MINIMAP.y + BEACH.waterTop * sy, MINIMAP.w, MINIMAP.h - BEACH.waterTop * sy);
    ctx.fillRect(MINIMAP.x + 2350 * sx, MINIMAP.y, MINIMAP.w - 2350 * sx, MARINA.y1 * sy);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(MINIMAP.x, MINIMAP.y + BEACH.top * sy, MINIMAP.w, (BEACH.waterTop - BEACH.top) * sy);
    ctx.strokeStyle = '#3d414c';
    ctx.lineWidth = 2;
    for (const vx of ROADS.vertical) {
      ctx.beginPath();
      ctx.moveTo(MINIMAP.x + vx * sx, MINIMAP.y);
      ctx.lineTo(MINIMAP.x + vx * sx, MINIMAP.y + BEACH.top * sy);
      ctx.stroke();
    }
    for (const hy of ROADS.horizontal) {
      ctx.beginPath();
      ctx.moveTo(MINIMAP.x, MINIMAP.y + hy * sy);
      ctx.lineTo(MINIMAP.x + MINIMAP.w, MINIMAP.y + hy * sy);
      ctx.stroke();
    }
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(MINIMAP.x + x * sx, MINIMAP.y + y * sy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    const objective = world.objective;
    if (objective) dot(objective.x, objective.y, PALETTE.marker, 5);
    for (const car of world.police.cars) if (car.active) dot(car.x, car.y, '#5aa9ff', 3);
    for (const e of world.combat.enemies) if (e.active) dot(e.x, e.y, '#e5534b', 3);
    dot(world.player.x, world.player.y, '#ffffff', 4);
    ctx.restore();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('PALMERA BAY', MINIMAP.x, MINIMAP.y - 10);
  }

  function drawHud(world) {
    const player = world.player;
    const wanted = world.police.wanted;
    // Top-left panel: wanted stars and health.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 14, 14, 250, 84, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.star;
    ctx.font = '26px sans-serif';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < wanted ? '★' : '☆';
    ctx.fillText(stars, 26, 46);
    ctx.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    ctx.fillRect(26, 58, 226 * Math.max(0, player.health / 100), 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeRect(26, 58, 226, 12);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(`JAX MORENO  •  HP ${Math.ceil(player.health)}`, 26, 88);
    // Five stars means the helicopter is overhead — say so, in red.
    if (world.police.heli && world.police.heli.active) {
      ctx.fillStyle = 'rgba(120, 20, 20, 0.9)';
      roundRect(ctx, 14, 104, 250, 26, 8);
      ctx.fill();
      ctx.fillStyle = '#ffd9d9';
      ctx.font = `bold 12px ${FONT}`;
      ctx.fillText('HELICOPTER OVERHEAD', 26, 122);
    }
    // Top-right: cash and objective.
    const objective = world.objective;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, VIEW.width - 364, 14, 350, objective ? 96 : 54, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`$${world.state.money.toLocaleString('en-US')}`, VIEW.width - 28, 44);
    if (objective) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillText(`${objective.missionTitle}${objective.stageCount > 1 ? `  (${objective.stageIndex}/${objective.stageCount})` : ''}`, VIEW.width - 28, 68);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `13px ${FONT}`;
      ctx.fillText(objective.text, VIEW.width - 28, 88);
      if (objective.timer !== null) {
        ctx.fillStyle = objective.timer < 15 ? PALETTE.red : PALETTE.gold;
        ctx.font = `bold 15px ${FONT}`;
        ctx.fillText(`${objective.timer}s`, VIEW.width - 28, 106);
      }
    }
    // Bottom-left: ammo / controls.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 14, VIEW.height - 64, 500, 50, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = 'left';
    if (player.inCar) {
      const car = player.car;
      ctx.fillText('WASD drive  •  SPACE handbrake  •  E get out', 26, VIEW.height - 44);
      ctx.fillStyle = car && car.health > 30 ? PALETTE.health : PALETTE.healthLow;
      ctx.fillRect(26, VIEW.height - 34, 150 * Math.max(0, (car ? car.health : 0) / 100), 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.strokeRect(26, VIEW.height - 34, 150, 8);
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('CAR', 182, VIEW.height - 26);
    } else {
      ctx.fillText('WASD move  •  SHIFT run  •  E steal / start job', 26, VIEW.height - 44);
      ctx.fillText('CLICK shoot  •  SPACE punch  •  R reload  •  T courier  •  H horn', 26, VIEW.height - 26);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(player.reloading ? 'RELOADING…' : `AMMO ${player.ammo}/${PLAYER.magSize}`, 502, VIEW.height - 44);
      ctx.textAlign = 'left';
    }
    // Speedometer left of the minimap, while driving (above it the
    // minimap's own label lives, so the two never overlap).
    if (player.inCar && player.car) {
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, VIEW.width - 216 - 212, MINIMAP.y - 44, 200, 32, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.stroke();
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 16px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(player.car.speed * 0.12)} mph`, VIEW.width - 28 - 212, MINIMAP.y - 22);
      ctx.textAlign = 'left';
    }
    // Toast.
    if (world.state.toastTimer > 0) {
      ctx.fillStyle = world.state.toastKind === 'bad' ? 'rgba(120, 20, 20, 0.85)' : world.state.toastKind === 'good' ? 'rgba(20, 90, 50, 0.85)' : PALETTE.panel;
      const text = world.state.toast;
      ctx.font = `14px ${FONT}`;
      const w = Math.min(VIEW.width - 40, ctx.measureText(text).width + 32);
      roundRect(ctx, (VIEW.width - w) / 2, 118, w, 34, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.textAlign = 'center';
      ctx.fillText(text, VIEW.width / 2, 140);
      ctx.textAlign = 'left';
    }
    // Off-screen objective arrow.
    if (objective) {
      const sx = objective.x - world.camera.x + VIEW.width / 2;
      const sy = objective.y - world.camera.y + VIEW.height / 2;
      if (sx < 0 || sx > VIEW.width || sy < 0 || sy > VIEW.height) {
        const cx = VIEW.width / 2;
        const cy = VIEW.height / 2;
        const angle = Math.atan2(sy - cy, sx - cx);
        const ax = cx + Math.cos(angle) * 300;
        const ay = cy + Math.sin(angle) * 200;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angle);
        ctx.fillStyle = PALETTE.marker;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    drawMinimap(world);
  }

  function drawCenterPanel(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 12, 18, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, VIEW.width / 2 - 340, VIEW.height / 2 - 190, 680, 380, 14);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 44px ${FONT}`;
    ctx.fillText(title, VIEW.width / 2, VIEW.height / 2 - 120);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `16px ${FONT}`;
    let y = VIEW.height / 2 - 70;
    for (const line of lines) {
      ctx.fillText(line, VIEW.width / 2, y);
      y += 28;
    }
    ctx.textAlign = 'left';
  }

  function drawTitle(world) {
    drawCenterPanel('PALMERA BAY', [
      'Jax Moreno is back in the city that locked him up.',
      'His sister Lena runs a garage. The Cortez crew runs everything else.',
      'Steal cars. Lose the cops. Take the Bay Job.',
      '',
      'WASD move / drive  •  E steal a car or start a job  •  CLICK shoot',
      'SPACE punch / handbrake  •  R reload  •  T courier  •  H horn  •  P pause  •  M mute',
      'New: a police helicopter at five stars, near-miss bonuses, courier streaks.',
      'Click or press SPACE to start.',
    ]);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    const bestStars = world.save.bestWanted > 0 ? '★'.repeat(world.save.bestWanted) + '☆'.repeat(5 - world.save.bestWanted) : '☆☆☆☆☆';
    ctx.fillText(`Save: $${world.state.money.toLocaleString('en-US')}  •  Jobs done: ${world.missions.done.size}/6  •  Near misses: ${world.save.nearMisses || 0}  •  Hottest heat: ${bestStars}`, VIEW.width / 2, VIEW.height / 2 + 150);
    ctx.textAlign = 'left';
  }

  function drawPause(world) {
    const done = [...world.missions.done];
    const lines = [
      'PAUSED — take a breath, Jax.',
      '',
      `Cash: $${world.state.money.toLocaleString('en-US')}  •  Cars stolen: ${world.state.carsStolen}  •  Crew down: ${world.state.kills}`,
      `Jobs done: ${done.length === 0 ? 'none yet' : done.join(', ')}`,
      '',
      'P / ESC resume  •  M mute  •  Click resume',
    ];
    drawCenterPanel('PAUSED', lines, 'rgba(255,255,255,0.35)');
  }

  function draw(world, mode) {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.save();
    ctx.translate(VIEW.width / 2 - world.camera.x, VIEW.height / 2 - world.camera.y);
    drawCity(world);
    // Skid marks.
    for (const skid of world.particles.skids) {
      ctx.save();
      ctx.translate(skid.x, skid.y);
      ctx.rotate(skid.angle);
      ctx.fillStyle = `rgba(20, 20, 20, ${Math.min(0.5, skid.life / 8)})`;
      ctx.fillRect(-14, -10, 28, 4);
      ctx.fillRect(-14, 6, 28, 4);
      ctx.restore();
    }
    // Cash pickups.
    for (const p of world.pickups) {
      if (!p.active) continue;
      const bob = Math.sin(world.state.time * 3 + p.x) * 3;
      ctx.fillStyle = PALETTE.cash;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a67c00';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#7a5c00';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', p.x, p.y + bob + 5);
      ctx.textAlign = 'left';
    }
    drawMarker(world, world.objective);
    // Traffic cars, then drivable cars, then police.
    for (const car of world.traffic.cars) {
      if (!car.active) continue;
      drawCarShape(ctx, car.x, car.y, car.angle, car.color, car.sporty, false, car.taxi, car.van);
    }
    for (const car of world.driveCars) {
      if (!car.active) continue;
      if (car.target) {
        ctx.strokeStyle = PALETTE.marker;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(car.x, car.y, 34 + Math.sin(world.state.time * 5) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      drawCarShape(ctx, car.x, car.y, car.angle, car.color, car.sporty, car.wrecked, false, false);
      if (car.wrecked) {
        ctx.fillStyle = 'rgba(120,120,120,0.6)';
        ctx.beginPath();
        ctx.arc(car.x - 10, car.y - 10, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const car of world.police.cars) {
      if (!car.active) continue;
      drawCarShape(ctx, car.x, car.y, car.angle, PALETTE.policeCar, false, false, false, false);
      // Flashing light bar.
      const phase = Math.floor(world.state.time * 6 + car.lightTimer) % 2 === 0;
      ctx.fillStyle = phase ? PALETTE.policeLightA : PALETTE.policeLightB;
      ctx.beginPath();
      ctx.arc(car.x, car.y - 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = phase ? PALETTE.policeLightB : PALETTE.policeLightA;
      ctx.beginPath();
      ctx.arc(car.x, car.y + 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a2a4a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', car.x, car.y + 3);
      ctx.textAlign = 'left';
    }
    // Pedestrians.
    for (const ped of world.traffic.peds) {
      if (!ped.active) continue;
      if (ped.downTimer > 0) {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(Math.PI / 2);
        drawPersonShape(ctx, 0, 0, 0, ped.color, false, false);
        ctx.restore();
      } else {
        drawPersonShape(ctx, ped.x, ped.y, ped.angle, ped.color, false, false, undefined, 11, ped.hat, ped.hatColor);
      }
    }
    // Officers.
    for (const officer of world.police.officers) {
      if (!officer.active) continue;
      drawPersonShape(ctx, officer.x, officer.y, officer.angle, '#1a2a4a', false, false);
    }
    // Enemies — the tough ones are bigger, with a longer health bar.
    for (const e of world.combat.enemies) {
      if (!e.active) continue;
      drawPersonShape(ctx, e.x, e.y, e.angle, PALETTE.enemy, false, true, e.health / (e.maxHealth || 3), e.tough ? 13 : 11);
    }
    // Player on foot.
    if (!world.player.inCar) {
      drawPersonShape(ctx, world.player.x, world.player.y, world.player.angle, PALETTE.player, true, false);
      if (world.player.reloading) {
        ctx.fillStyle = PALETTE.muted;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('reloading…', world.player.x, world.player.y - 22);
        ctx.textAlign = 'left';
      }
    }
    // Bullets.
    for (const b of world.combat.bullets) {
      if (!b.active) continue;
      ctx.strokeStyle = '#ffe9a3';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const p of world.particles.pool) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Floating texts.
    for (const f of world.particles.floats) {
      ctx.globalAlpha = Math.max(0, f.life / 1.4);
      ctx.fillStyle = f.color;
      ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
    // The police helicopter, above everything: shadow, spotlight, rotor blur.
    const heli = world.police.heli;
    if (heli && heli.active) {
      const hx = heli.x;
      const hy = heli.y;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(hx + 26, hy + 34, 26, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(heli.angle);
      ctx.fillStyle = 'rgba(255, 240, 160, 0.10)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(420, -90);
      ctx.lineTo(420, 90);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.heliBody;
      roundRect(ctx, -26, -11, 52, 22, 9);
      ctx.fill();
      ctx.fillStyle = PALETTE.heliGlass;
      roundRect(ctx, 8, -8, 14, 16, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
      ctx.save();
      ctx.rotate(heli.rotor);
      ctx.strokeStyle = 'rgba(20, 20, 20, 0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-44, 0);
      ctx.lineTo(44, 0);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
    ctx.restore();

    // Screen-space layers.
    if (mode === 'title') drawTitle(world);
    else if (mode === 'paused') drawPause(world);
    else {
      drawHud(world);
      if (world.state.screen === 'busted') {
        drawCenterPanel('BUSTED', ['Captain Reyes has you. The fine comes out of your cash.', 'You wake up at Palmera General.'], PALETTE.red);
      } else if (world.state.screen === 'wasted') {
        drawCenterPanel('WASTED', ['Lena dragged you to Palmera General.', 'Some of your cash is gone.'], PALETTE.red);
      } else if (world.state.screen === 'story') {
        drawCenterPanel('THE BAY JOB — DONE', [
          'The cash van is at the marina. Lena is already counting it.',
          'Jax Moreno owns Palmera Bay tonight.',
          '',
          'Free roam continues — jobs, couriers and the cops are still out there.',
        ]);
      }
    }
  }

  return { draw };
}
