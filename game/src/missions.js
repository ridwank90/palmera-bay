// Missions and side jobs: the ten-job story of Jax Moreno, plus repeatable
// courier runs for cash. A mission is a list of stages — go somewhere, steal
// a car, clear the gunmen out, outrun the cops — and this module only knows
// the stage list and whether each stage is done. The world owns the cars, the
// enemies and the money; it calls back in through `ctx` when a stage needs
// something spawned or a reward paid out.

import { COURIER } from './config.js';
import { PLACES } from './city.js';

const MISSIONS = [
  {
    id: 'homecoming',
    title: 'Homecoming',
    reward: 100,
    briefing: 'Lena: "Jax, you\'re back. Meet me at the marina — I need a driver."',
    stages: [
      { type: 'goto', x: PLACES.marina.x, y: PLACES.marina.y, label: 'Marina Viewpoint', text: 'Drive to the marina viewpoint' },
    ],
  },
  {
    id: 'pickup',
    title: 'The Pickup',
    reward: 150,
    briefing: 'Lena: "Pick up the package in the back alley. Don\'t get seen. Bring it to the garage."',
    stages: [
      { type: 'gotoFoot', x: PLACES.alley.x, y: PLACES.alley.y, label: 'Back Alley', text: 'Pick up the package in the back alley' },
      { type: 'gotoFoot', x: PLACES.garage.x, y: PLACES.garage.y, label: 'Moreno Motors', text: 'Bring the package to Moreno Motors' },
    ],
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    reward: 250,
    briefing: 'Otis: "That red sports car at Sol Plaza? I want it. Take it — and don\'t scratch it. Much."',
    stages: [
      { type: 'enterTargetCar', x: PLACES.plaza.x, y: PLACES.plaza.y, label: 'Sol Plaza', text: 'Steal the sports car at Sol Plaza' },
      { type: 'gotoCar', x: PLACES.chopShop.x, y: PLACES.chopShop.y, label: "Otis' Chop Shop", text: 'Drive the sports car to the chop shop' },
    ],
  },
  {
    id: 'dockside',
    title: 'Dockside Payback',
    reward: 300,
    briefing: 'Lena: "Dante\'s boys are holding the docks. Clear them out — make it loud."',
    stages: [
      { type: 'goto', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Palmera Docks', text: 'Get to the docks' },
      { type: 'kill', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Palmera Docks', text: 'Clear out the Cortez crew', kills: 4 },
    ],
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    reward: 400,
    briefing: 'Otis: "Hit the Bay Trust courier at the bank, then lose the cops and get to the hideout. Fast."',
    stages: [
      { type: 'gotoFoot', x: PLACES.bank.x, y: PLACES.bank.y, label: 'Bay Trust Bank', text: 'Reach the Bay Trust Bank' },
      { type: 'escape', x: PLACES.hideout.x, y: PLACES.hideout.y, label: 'Hideout', text: 'Lose the cops — reach the hideout', seconds: 80 },
    ],
  },
  {
    id: 'bayjob',
    title: 'The Bay Job',
    reward: 600,
    briefing: 'Lena: "One last job. The cash van leaves the bank at noon. Take it, and meet me at the marina."',
    stages: [
      { type: 'goto', x: PLACES.bank.x, y: PLACES.bank.y, label: 'Bay Trust Bank', text: 'Reach the Bay Trust Bank' },
      { type: 'enterTargetCar', x: PLACES.bank.x, y: PLACES.bank.y, label: 'Cash Van', text: 'Steal the cash van' },
      { type: 'escape', x: PLACES.marina.x, y: PLACES.marina.y, label: 'Marina Viewpoint', text: 'Lose the cops — reach the marina', seconds: 100 },
    ],
  },
  // v3 jobs: the story continues after the Bay Job — smuggling, a street
  // race, a hold-the-line defence and the biggest heist in the city.
  {
    id: 'smuggling',
    title: 'Harbor Lights',
    reward: 500,
    briefing: 'Otis: "Crates from the harbor, no questions. Three drops, one quiet run to the hideout. Don\'t keep the buyers waiting."',
    // The whole run is on the clock: 110 seconds for four drops.
    timeLimit: 110,
    stages: [
      { type: 'gotoCar', x: PLACES.plaza.x, y: PLACES.plaza.y, label: 'Sol Plaza', text: 'Drop one: Sol Plaza' },
      { type: 'gotoCar', x: PLACES.park.x, y: PLACES.park.y, label: 'Palm Court Park', text: 'Drop two: Palm Court Park' },
      { type: 'gotoCar', x: PLACES.casino.x, y: PLACES.casino.y, label: 'Palmera Casino', text: 'Drop three: Palmera Casino' },
      { type: 'gotoCar', x: PLACES.hideout.x, y: PLACES.hideout.y, label: 'Hideout', text: 'Quiet run home: the hideout' },
    ],
  },
  {
    id: 'grandprix',
    title: 'Neon Grand Prix',
    reward: 450,
    briefing: 'Rico: "You call that driving, Jax? Four checkpoints, one loop of the city. Beat me to the finish line and the pot is yours."',
    stages: [
      { type: 'enterTargetCar', x: PLACES.plaza.x, y: PLACES.plaza.y, label: 'Start Line', text: 'Get in the race car at Sol Plaza' },
      {
        type: 'race',
        checkpoints: [
          { x: 2200, y: 550, label: 'East Bend' },
          { x: 2200, y: 1250, label: 'Beach Road' },
          { x: 600, y: 1250, label: 'West End' },
          { x: 600, y: 550, label: 'Finish Line' },
        ],
        timeLimit: 60,
        text: 'Neon Grand Prix — beat Rico to the finish line',
      },
    ],
  },
  {
    id: 'harbor',
    title: 'The Long Way Home',
    reward: 550,
    briefing: 'Lena: "The van is loaded and Cortez wants it back. Hold the loading bay while I finish, then drive it home yourself."',
    stages: [
      { type: 'goto', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Palmera Docks', text: 'Meet Lena at the docks' },
      { type: 'defend', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Loading Bay', kills: 8, seconds: 60, text: 'Hold the loading bay — Lena is loading the van' },
      { type: 'enterTargetCar', x: PLACES.docks.x, y: PLACES.docks.y, label: 'The Van', text: 'Get in the van' },
      { type: 'gotoCar', x: PLACES.hideout.x, y: PLACES.hideout.y, label: 'Hideout', text: 'Drive the van to the hideout' },
    ],
  },
  {
    id: 'vault',
    title: 'The Vault',
    reward: 700,
    briefing: 'Lena: "The Vault. Five guards, one big score. Case it, clear it, lose the cops, stash the cash."',
    stages: [
      { type: 'gotoFoot', x: PLACES.bank.x, y: PLACES.bank.y, label: 'Bay Trust Bank', text: 'Case the vault at Bay Trust Bank' },
      { type: 'kill', x: PLACES.bank.x, y: PLACES.bank.y, label: 'Bay Trust Bank', text: 'Clear the bank guards', kills: 5 },
      { type: 'escape', x: PLACES.chopShop.x, y: PLACES.chopShop.y, label: "Otis' Chop Shop", text: 'Lose the cops — reach the chop shop', seconds: 90 },
      { type: 'gotoCar', x: PLACES.hideout.x, y: PLACES.hideout.y, label: 'Hideout', text: 'Stash the cash at the hideout' },
    ],
  },
];

const COURIER_REWARD = COURIER.baseReward;
const COURIER_TIME = COURIER.time;

/** What the courier is carrying this run — a little flavour, cycled in order. */
const PACKAGE_LABELS = [
  'tacos for Taco Luna', 'surfboards for Kai', 'records for Palmera Records',
  'donuts for Donut Bay', 'flowers for Flower Power', 'books for Bay Books',
];

export function createMissions(doneIds = []) {
  const done = new Set(doneIds);
  let active = null; // { def, stageIndex, timer, killsAtStart }
  let courier = null; // { stage, x, y, label, timer, packageLabel }
  let courierStreak = 0;
  let packageIndex = 0;

  function nextMission() {
    for (const def of MISSIONS) if (!done.has(def.id)) return def;
    return null;
  }

  function startNext(ctx) {
    const def = nextMission();
    if (!def || active) return null;
    active = { def, stageIndex: 0, timer: null, killsAtStart: ctx.kills || 0, checkIndex: 0, wave: 1 };
    // A whole-mission clock (Harbor Lights): it starts with the first stage.
    if (def.timeLimit) active.timer = def.timeLimit;
    beginStage(ctx);
    return def;
  }

  /**
   * Start one mission at a given stage (the screenshot driver uses this to
   * stage the dock shootout and the getaway directly). Returns false when a
   * mission is already running.
   */
  function startSpecific(def, ctx, stageIndex = 0) {
    if (!def || active) return false;
    active = { def, stageIndex, timer: null, killsAtStart: ctx.kills || 0, checkIndex: 0, wave: 1 };
    if (stageIndex === 0 && def.timeLimit) active.timer = def.timeLimit;
    beginStage(ctx);
    return true;
  }

  function beginStage(ctx) {
    const stage = active.def.stages[active.stageIndex];
    if (stage.type === 'escape') {
      active.timer = stage.seconds;
      if (ctx.addWanted) ctx.addWanted(active.def.id === 'bayjob' ? 3 : 2);
    }
    if (stage.type === 'enterTargetCar') {
      const sporty = active.def.id === 'hotwheels';
      if (ctx.spawnTargetCar) ctx.spawnTargetCar(stage.x, stage.y, sporty);
    }
    if (stage.type === 'kill') {
      if (ctx.spawnEnemies) ctx.spawnEnemies(stage.x, stage.y, stage.kills);
      active.killsAtStart = ctx.kills || 0;
    }
    if (stage.type === 'defend') {
      // Hold the line: the first wave lands at once, the rest as the crew thins.
      active.timer = stage.seconds;
      active.wave = 1;
      active.killsAtStart = ctx.kills || 0;
      if (ctx.spawnEnemies) ctx.spawnEnemies(stage.x, stage.y, 3);
    }
    if (stage.type === 'race') {
      // The Grand Prix: Rico starts beside the player and races the same loop.
      active.timer = stage.timeLimit;
      active.checkIndex = 0;
      if (ctx.spawnRival) ctx.spawnRival(stage.checkpoints);
    }
  }

  function failMission(ctx, reason) {
    const title = active.def.title;
    active = null;
    if (ctx.onMissionFailed) ctx.onMissionFailed(title, reason);
  }

  /** Fail the running mission from outside (busted, wasted). No-op when none. */
  function failActive(ctx, reason) {
    if (!active) return;
    failMission(ctx, reason);
  }

  function completeMission(ctx) {
    const def = active.def;
    done.add(def.id);
    active = null;
    if (ctx.onMissionComplete) ctx.onMissionComplete(def);
  }

  function startCourier(ctx) {
    if (active || courier) return null;
    const p = ctx.randomRoadPoint ? ctx.randomRoadPoint() : { x: 1000, y: 900 };
    const packageLabel = PACKAGE_LABELS[packageIndex % PACKAGE_LABELS.length];
    packageIndex += 1;
    courier = { stage: 'pickup', x: p.x, y: p.y, label: 'Pickup', timer: COURIER_TIME, packageLabel };
    return courier;
  }

  function step(dt, ctx) {
    if (active) {
      const stage = active.def.stages[active.stageIndex];
      const px = ctx.playerInCar && ctx.playerCar ? ctx.playerCar.x : ctx.playerX;
      const py = ctx.playerInCar && ctx.playerCar ? ctx.playerCar.y : ctx.playerY;
      const dist = stage.x !== undefined ? Math.hypot(stage.x - px, stage.y - py) : Infinity;
      let doneStage = false;
      if (stage.type === 'goto') doneStage = dist < 70;
      else if (stage.type === 'gotoFoot') doneStage = !ctx.playerInCar && dist < 60;
      else if (stage.type === 'gotoCar') doneStage = !!ctx.playerInCar && dist < 80;
      else if (stage.type === 'enterTargetCar') doneStage = !!ctx.inTargetCar;
      else if (stage.type === 'kill') doneStage = (ctx.kills || 0) - active.killsAtStart >= stage.kills;
      else if (stage.type === 'escape') doneStage = dist < 80;
      else if (stage.type === 'defend') {
        // Waves land 3, then 3, then 2 — a fresh wave comes once the last one thins out.
        const kills = (ctx.kills || 0) - active.killsAtStart;
        const waves = [3, 3, 2];
        if (ctx.aliveEnemies && ctx.aliveEnemies() <= 1 && kills < stage.kills && active.wave < 3) {
          if (ctx.spawnEnemies) ctx.spawnEnemies(stage.x, stage.y, waves[active.wave]);
          active.wave += 1;
        }
        doneStage = kills >= stage.kills;
      } else if (stage.type === 'race') {
        // Rico finished first: the pot is his.
        if (ctx.rivalFinished && ctx.rivalFinished()) {
          failMission(ctx, 'Rico beat you to the finish line.');
          return;
        }
        const cp = stage.checkpoints[active.checkIndex];
        if (Math.hypot(cp.x - px, cp.y - py) < 80) {
          active.checkIndex += 1;
          if (ctx.onCheckpoint) ctx.onCheckpoint(active.checkIndex, stage.checkpoints.length);
          if (active.checkIndex >= stage.checkpoints.length) doneStage = true;
        }
      }
      // The mission clock (escape, defend, race, whole-mission limit): it
      // ticks on every timed stage, and running out fails the job.
      if (active.timer !== null && active.timer !== undefined) {
        active.timer -= dt;
        if (active.timer <= 0 && !doneStage) {
          failMission(ctx, 'Out of time — the job slipped away.');
          return;
        }
      }
      if (doneStage) {
        active.stageIndex += 1;
        if (active.stageIndex >= active.def.stages.length) completeMission(ctx);
        else beginStage(ctx);
      }
    }
    if (courier) {
      courier.timer -= dt;
      if (courier.timer <= 0) {
        courier = null;
        courierStreak = 0;
        if (ctx.onCourierFailed) ctx.onCourierFailed();
        return;
      }
      const d = Math.hypot(courier.x - ctx.playerX, courier.y - ctx.playerY);
      if (d < 60) {
        if (courier.stage === 'pickup') {
          const drop = ctx.randomPlace ? ctx.randomPlace() : { x: 1400, y: 1250, label: 'Dropoff' };
          courier = { stage: 'dropoff', x: drop.x, y: drop.y, label: drop.label, timer: courier.timer, packageLabel: courier.packageLabel };
          if (ctx.onCourierPickup) ctx.onCourierPickup();
        } else {
          // Streak bonus: each clean delivery in a row pays a little more.
          const reward = COURIER_REWARD + COURIER.streakBonus * Math.min(courierStreak, COURIER.streakMax);
          courierStreak += 1;
          courier = null;
          if (ctx.onCourierComplete) ctx.onCourierComplete(reward);
        }
      }
    }
  }

  /** What the HUD and the minimap should point at right now, or null. */
  function objective() {
    if (active) {
      const stage = active.def.stages[active.stageIndex];
      // The race points at its next checkpoint, not at a fixed stage target.
      if (stage.type === 'race') {
        const cp = stage.checkpoints[active.checkIndex];
        return {
          text: `Neon Grand Prix — checkpoint ${active.checkIndex + 1}/${stage.checkpoints.length}`,
          x: cp.x,
          y: cp.y,
          label: cp.label,
          timer: active.timer !== null && active.timer !== undefined ? Math.max(0, Math.ceil(active.timer)) : null,
          missionTitle: active.def.title,
          stageIndex: active.stageIndex + 1,
          stageCount: active.def.stages.length,
        };
      }
      return {
        text: stage.text,
        x: stage.x,
        y: stage.y,
        label: stage.label,
        timer: active.timer !== null && active.timer !== undefined ? Math.max(0, Math.ceil(active.timer)) : null,
        missionTitle: active.def.title,
        stageIndex: active.stageIndex + 1,
        stageCount: active.def.stages.length,
      };
    }
    if (courier) {
      return {
        text: courier.stage === 'pickup' ? `Courier: pick up ${courier.packageLabel}` : `Courier: deliver ${courier.packageLabel}`,
        x: courier.x,
        y: courier.y,
        label: courier.label,
        timer: Math.max(0, Math.ceil(courier.timer)),
        missionTitle: courierStreak > 0 ? `Courier Job — streak x${courierStreak}` : 'Courier Job',
        stageIndex: courier.stage === 'pickup' ? 1 : 2,
        stageCount: 2,
      };
    }
    const next = nextMission();
    if (next) {
      return {
        text: `Next job: ${next.title} — go to Moreno Motors`,
        x: PLACES.garage.x,
        y: PLACES.garage.y,
        label: 'Moreno Motors',
        timer: null,
        missionTitle: next.title,
        stageIndex: 0,
        stageCount: next.stages.length,
        startable: true,
      };
    }
    return null;
  }

  return {
    done, nextMission, startNext, startSpecific, startCourier, step, objective, failActive,
    get active() { return active; },
    get courier() { return courier; },
    get allDone() { return done.size === MISSIONS.length; },
    missionList: MISSIONS,
  };
}
