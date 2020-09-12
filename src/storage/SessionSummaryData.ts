import { SessionSummary, KeystrokeAggregate } from "../model/models";
import { getNowTimes, getItem, coalesceNumber } from "../Util";
import { DEFAULT_SESSION_THRESHOLD_SECONDS } from "../Constants";
import { getFileDataAsJson, getSessionSummaryFile } from "../managers/FileManager";

const fileIt = require("file-it");

export function getSessionThresholdSeconds() {
  const thresholdSeconds = getItem("sessionThresholdInSec") || DEFAULT_SESSION_THRESHOLD_SECONDS;
  return thresholdSeconds;
}

export function clearSessionSummaryData() {
  const sessionSummaryData = new SessionSummary();
  saveSessionSummaryToDisk(sessionSummaryData);
}

export function getSessionSummaryData(): SessionSummary {
  let sessionSummaryData = getSessionSummaryFileAsJson();
  // make sure it's a valid structure
  if (!sessionSummaryData) {
    // set the defaults
    sessionSummaryData = new SessionSummary();
  }
  // fill in missing attributes
  sessionSummaryData = coalesceMissingAttributes(sessionSummaryData);
  return sessionSummaryData;
}

function coalesceMissingAttributes(data): SessionSummary {
  // ensure all attributes are defined
  const template: SessionSummary = new SessionSummary();
  Object.keys(template).forEach((key) => {
    if (!data[key]) {
      data[key] = 0;
    }
  });
  return data;
}

export function getSessionSummaryFileAsJson(): SessionSummary {
  const file = getSessionSummaryFile();
  let sessionSummary = getFileDataAsJson(file);
  if (!sessionSummary) {
    sessionSummary = new SessionSummary();
    saveSessionSummaryToDisk(sessionSummary);
  }
  return sessionSummary;
}

export function saveSessionSummaryToDisk(sessionSummaryData) {
  const file = getSessionSummaryFile();
  fileIt.writeJsonFileSync(file, sessionSummaryData, { spaces: 4 });
}

export function setSessionSummaryLiveshareMinutes(minutes) {
  let sessionSummaryData = getSessionSummaryData();
  sessionSummaryData.liveshareMinutes = minutes;

  saveSessionSummaryToDisk(sessionSummaryData);
}

/**
 * Return {elapsedSeconds, sessionSeconds}
 * The session minutes is based on a threshold of 15 minutes
 */
export function getTimeBetweenLastPayload() {
  // default to 1 minute
  let sessionSeconds = 0;
  let elapsedSeconds = 60;

  // will be zero if its a new day
  const lastPayloadEnd = getItem("latestPayloadTimestampEndUtc");

  // the last payload end time is reset within the new day checker
  if (lastPayloadEnd && lastPayloadEnd > 0) {
    // diff from the previous end time
    elapsedSeconds = coalesceNumber(getNowTimes().now_in_sec - lastPayloadEnd);

    // if it's less than the threshold then add the minutes to the session time
    if (elapsedSeconds > 0 && elapsedSeconds <= getSessionThresholdSeconds()) {
      // it's still the same session, add the gap time in minutes
      sessionSeconds = elapsedSeconds;
    }
    sessionSeconds = coalesceNumber(sessionSeconds);
  }

  return { sessionSeconds, elapsedSeconds };
}

export async function incrementSessionSummaryData(
  aggregates: KeystrokeAggregate,
  sessionSeconds: number
) {
  let sessionSummaryData = getSessionSummaryData();
  // fill in missing attributes
  sessionSummaryData = coalesceMissingAttributes(sessionSummaryData);
  // convert to minutes
  const sessionMinutes = sessionSeconds ? sessionSeconds / 60 : 0;
  sessionSummaryData.currentDayMinutes += sessionMinutes;

  // increment the current day attributes except for the current day minutes
  sessionSummaryData.currentDayKeystrokes += aggregates.keystrokes;
  sessionSummaryData.currentDayLinesAdded += aggregates.linesAdded;
  sessionSummaryData.currentDayLinesRemoved += aggregates.linesRemoved;

  saveSessionSummaryToDisk(sessionSummaryData);
}
