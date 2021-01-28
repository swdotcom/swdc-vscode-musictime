import { getNowTimes } from "./Util";
import { DEFAULT_SESSION_THRESHOLD_SECONDS } from "./Constants";
import { getCurrentPayloadFile, getItem, getSessionSummaryFile } from "./managers/FileManager";

const fileIt = require("file-it");

/**
 * {
    "currentDayMinutes": 2,
    "averageDailyMinutes": 1.516144578313253,
    "averageDailyKeystrokes": 280.07014725568945,
    "currentDayKeystrokes": 49,
    "liveshareMinutes": null
    }
*/
let sessionSummaryData = {
  currentDayMinutes: 0,
  averageDailyMinutes: 0,
  averageDailyKeystrokes: 0,
  currentDayKeystrokes: 0,
  liveshareMinutes: null,
  lastStart: null,
};

export function clearSessionSummaryData() {
  sessionSummaryData = {
    currentDayMinutes: 0,
    averageDailyMinutes: 0,
    averageDailyKeystrokes: 0,
    currentDayKeystrokes: 0,
    liveshareMinutes: null,
    lastStart: null,
  };

  saveSessionSummaryToDisk(sessionSummaryData);
}

export function setSessionSummaryLiveshareMinutes(minutes) {
  sessionSummaryData.liveshareMinutes = minutes;
}

export function getSessionThresholdSeconds() {
  const thresholdSeconds = getItem("sessionThresholdInSec") || DEFAULT_SESSION_THRESHOLD_SECONDS;
  return thresholdSeconds;
}

export function incrementSessionSummaryData(keystrokes) {
  // what is the gap from the previous start
  const nowTimes = getNowTimes();
  const nowInSec = nowTimes.now_in_sec;
  let incrementMinutes = 1;
  if (sessionSummaryData.lastStart) {
    const lastStart = parseInt(sessionSummaryData.lastStart, 10);
    // get the diff from the prev start
    const diffInSec = nowInSec - lastStart;
    // If it's less or equal to the session threshold seconds
    // then add to the minutes increment. But check if it's a positive
    // number in case the system clock has been moved to the future
    if (diffInSec > 0 && diffInSec <= getSessionThresholdSeconds()) {
      // it's still the same session, add the gap time in minutes
      const diffInMin = diffInSec / 60;
      incrementMinutes += diffInMin;
    }
  }
  sessionSummaryData.currentDayMinutes += incrementMinutes;
  sessionSummaryData.currentDayKeystrokes += keystrokes;
  sessionSummaryData.lastStart = nowInSec;

  saveSessionSummaryToDisk(sessionSummaryData);
}

export function getSessionSummaryData() {
  return sessionSummaryData;
}

export function saveSessionSummaryToDisk(sessionSummaryData) {
  fileIt.writeJsonFileSync(getSessionSummaryFile, sessionSummaryData, { spaces: 4 });
}

export function getSessionSummaryFileAsJson() {
  let data = fileIt.readJsonFileSync(getSessionSummaryFile());
  return data ? data : {};
}

/**
 * Fetch the data rows of a given file
 * @param file
 */
export async function getDataRows(file) {
  const payloads = fileIt.readJsonLinesSync(file);
  return payloads;
}

export function getCurrentPayload() {
  let data = fileIt.readJsonFileSync(getCurrentPayloadFile());
  return data ? data : {};
}
