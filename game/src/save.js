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
    // v2 stats: near misses threaded and the hottest heat ever reached.
    nearMisses: 0,
    bestWanted: 0,
    // v3 stats: Grand Prix wins, crates picked up, repairs done, blocks dodged.
    grandPrixWins: 0,
    cratesPickedUp: 0,
    repairsDone: 0,
    roadblocksDodged: 0,
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
    if (typeof parsed.nearMisses === 'number') save.nearMisses = Math.max(0, Math.floor(parsed.nearMisses));
    if (typeof parsed.bestWanted === 'number') save.bestWanted = Math.max(0, Math.min(5, Math.floor(parsed.bestWanted)));
    if (typeof parsed.grandPrixWins === 'number') save.grandPrixWins = Math.max(0, Math.floor(parsed.grandPrixWins));
    if (typeof parsed.cratesPickedUp === 'number') save.cratesPickedUp = Math.max(0, Math.floor(parsed.cratesPickedUp));
    if (typeof parsed.repairsDone === 'number') save.repairsDone = Math.max(0, Math.floor(parsed.repairsDone));
    if (typeof parsed.roadblocksDodged === 'number') save.roadblocksDodged = Math.max(0, Math.floor(parsed.roadblocksDodged));
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
