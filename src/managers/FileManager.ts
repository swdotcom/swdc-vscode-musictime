import {
  isWindows,
} from "../Util";
import KeystrokeStats from "../model/KeystrokeStats";
import TimeData from "../model/TimeData";

const fileIt = require("file-it");
const fs = require("fs");
const os = require("os");

let extensionName = null;
let extensionDisplayName = null; // Code Time or Music Time
let latestPayload: KeystrokeStats = null;

export function clearLastSavedKeystrokeStats() {
  latestPayload = null;
}

export function getSoftwareSessionFile() {
  return getFile("session.json");
}

export function getDeviceFile() {
  return getFile("device.json");
}

export function getSoftwareDataStoreFile() {
  return getFile("data.json");
}

export function getPluginEventsFile() {
  return getFile("events.json");
}

export function getTimeCounterFile() {
  return getFile("timeCounter.json");
}

export function getDashboardFile() {
  return getFile("CodeTime.txt");
}

export function getCommitSummaryFile() {
  return getFile("CommitSummary.txt");
}

export function getSummaryInfoFile() {
  return getFile("SummaryInfo.txt");
}

export function getProjectCodeSummaryFile() {
  return getFile("ProjectCodeSummary.txt");
}

export function getProjectContributorCodeSummaryFile() {
  return getFile("ProjectContributorCodeSummary.txt");
}

export function getDailyReportSummaryFile() {
  return getFile("DailyReportSummary.txt");
}

export function getTimeDataSummaryFile() {
  return getFile("projectTimeData.json");
}

export function getMusicTimeFile() {
  return getFile("MusicTime.txt");
}

export function getMusicTimeMarkdownFile() {
  return getFile("MusicTime.html");
}

export function getSongSessionDataFile() {
  return getFile("songSessionData.json");
}

export function getSessionSummaryFile() {
  return getFile("sessionSummary.json");
}

export function getExtensionDisplayName() {
  if (extensionDisplayName) {
    return extensionDisplayName;
  }

  const extInfoFile = `${__dirname}${getFile("extensioninfo.json")}`;

  const data = fileIt.readJsonFileSync(extInfoFile);
  if (data) {
    extensionDisplayName = data.displayName;
  }

  if (!extensionDisplayName) {
    extensionDisplayName = "Music Time";
  }
  return extensionDisplayName;
}

export function getExtensionName() {
  if (extensionName) {
    return extensionName;
  }

  const extInfoFile = `${__dirname}${getFile("extensioninfo.json")}`;

  const data = fileIt.readJsonFileSync(extInfoFile);
  if (data) {
    extensionName = data.name;
  }
  if (!extensionName) {
    extensionName = "music-time";
  }
  return extensionName;
}

export function getSoftwareDir(autoCreate = true) {
  const homedir = os.homedir();

  const softwareDataDir = `${homedir}${getSeparator(".software")}`;

  if (autoCreate && !fs.existsSync(softwareDataDir)) {
    fs.mkdirSync(softwareDataDir);
  }

  return softwareDataDir;
}

export function getFileChangeSummaryFile() {
  return getFile("fileChangeSummary.json");
}

export function getFile(name) {
  const file_path = `${getSoftwareDir()}${getSeparator(name)}`;
  return file_path;
}

function getSeparator(name) {
  if (isWindows()) {
    return `\\${name}`;
  }
  return `/${name}`;
}

export async function clearTimeDataSummary() {
  const file = getTimeDataSummaryFile();
  let payloads: TimeData[] = [];
  fileIt.writeJsonFileSync(file, payloads, { spaces: 4 });
}

export function getFileDataAsJson(file) {
  let data = fileIt.readJsonFileSync(file);
  return data;
}

export async function getLastSavedKeystrokesStats() {
  const el = fileIt.findSortedJsonElement(getSoftwareDataStoreFile(), "start", "desc");
  if (el) {
    return el;
  }
  // returns one in memory if not found in file
  return latestPayload;
}

export function getCurrentPayloadFile() {
  return getFile("latestKeystrokes.json");
}

export async function storeCurrentPayload(payload) {
  storeJsonData(this.getCurrentPayloadFile(), payload);
}

export async function storeJsonData(fileName, data) {
  fileIt.writeJsonFileSync(fileName, data);
}
