// Saving and loading Palmera Bay: money, which missions are done, the best
// (most cash ever held), the sound setting and the run's stats. One JSON blob
// under one key in localStorage; a missing or broken blob just means a fresh
// start. Nothing here touches the world — main.js applies what it loads.
import { MONEY, SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    money: MONEY.start,
    missionsDone: [],
    bestMoney: MONEY.start,
    muted: false,
    carsStolen: 0,
    missionsPlayed: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaultSave();
    const save = defaultSave();
    if (typeof parsed.money === 'number') save.money = Math.max(0, Math.floor(parsed.money));
    if (Array.isArray(parsed.missionsDone)) save.missionsDone = parsed.missionsDone.filter((m) => typeof m === 'string');
    if (typeof parsed.bestMoney === 'number') save.bestMoney = Math.max(save.money, Math.floor(parsed.bestMoney));
    if (typeof parsed.muted === 'boolean') save.muted = parsed.muted;
    if (typeof parsed.carsStolen === 'number') save.carsStolen = Math.floor(parsed.carsStolen);
    if (typeof parsed.missionsPlayed === 'number') save.missionsPlayed = Math.floor(parsed.missionsPlayed);
    return save;
  } catch {
    return defaultSave();
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
}
