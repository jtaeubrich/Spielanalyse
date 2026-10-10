import { migrateGameData } from "./game-format.js";

export const GAME_FILE_TYPES = [
  {
    description: "Handball-Spiel (JSON)",
    accept: { "application/json": [".json"] }
  }
];

export function parseGameText(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ""));
  } catch {
    throw new Error("JSON konnte nicht gelesen werden.");
  }
  return migrateGameData(parsed);
}

export function defaultGameFileName(gameName, currentFileName = null) {
  if (currentFileName) return currentFileName;
  const base = String(gameName || "HandballMatch")
    .replace(/[^a-z0-9äöüß_-]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  return (base || "HandballMatch") + "_spielanalyse.json";
}

export function gameOpenPickerOptions() {
  return {
    id: "handball-spielanalyse-games",
    types: GAME_FILE_TYPES,
    multiple: false
  };
}

export function gameSavePickerOptions(fileName, currentHandle = null) {
  const options = {
    id: "handball-spielanalyse-games",
    suggestedName: fileName,
    types: GAME_FILE_TYPES
  };
  if (currentHandle) options.startIn = currentHandle;
  return options;
}

export async function writeTextFileHandle(handle, text) {
  if (!handle) throw new Error("Keine Zieldatei ausgewählt.");

  if (
    handle.queryPermission &&
    (await handle.queryPermission({ mode: "readwrite" })) !== "granted"
  ) {
    if (
      !handle.requestPermission ||
      (await handle.requestPermission({ mode: "readwrite" })) !== "granted"
    ) {
      throw new Error("Schreibzugriff auf die Datei wurde nicht erteilt.");
    }
  }

  const writable = await handle.createWritable();
  await writable.write(String(text ?? ""));
  await writable.close();
}
