import { isWindows, getNowTimes } from "../Util";
import { v4 as uuidv4 } from "uuid";
import { commands, Uri, ViewColumn } from "vscode";
import * as path from "path";
import { softwarePost } from "../HttpClient";
import { SOFTWARE_FOLDER } from "../Constants";

const fileIt = require("file-it");
const fs = require("fs");
const os = require("os");

let lastDayOfMonth = -1;
const NO_DATA = `MUSIC TIME
    Listen to Spotify while coding to generate this playlist`;

export function getSoftwareSessionFile() {
  return getFile("session.json");
}

export function getDeviceFile() {
  return getFile("device.json");
}

export function getIntegrationsFile() {
  return getFile("integrations.json");
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

export function getDailyReportSummaryFile() {
  return getFile("DailyReportSummary.txt");
}

export function getMusicTimeFile() {
  return getFile("MusicTime.txt");
}

export function getMusicTimeMarkdownFile() {
  return getFile("MusicTime.html");
}

export function getExtensionDisplayName() {
  return "Music Time";
}

export function getExtensionName() {
  return "music-time";
}

export function getSoftwareDir(autoCreate = true) {
  const homedir = os.homedir();

  const softwareDataDir = `${homedir}${getSeparator(SOFTWARE_FOLDER)}`;

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

export function getFileDataAsJson(file) {
  let data = fileIt.readJsonFileSync(file);
  return data;
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

export function setItem(key, value) {
  fileIt.setJsonValue(getSoftwareSessionFile(), key, value);
}

export function getItem(key) {
  return fileIt.getJsonValue(getSoftwareSessionFile(), key);
}

export function getPluginUuid() {
  let plugin_uuid = fileIt.getJsonValue(getDeviceFile(), "plugin_uuid");
  if (!plugin_uuid) {
    // set it for the 1st and only time
    plugin_uuid = uuidv4();
    fileIt.setJsonValue(getDeviceFile(), "plugin_uuid", plugin_uuid);
  }
  return plugin_uuid;
}

export function getAuthCallbackState(autoCreate = true) {
  let auth_callback_state = fileIt.getJsonValue(getDeviceFile(), "auth_callback_state");
  if (!auth_callback_state && autoCreate) {
    auth_callback_state = uuidv4();
    fileIt.setJsonValue(getDeviceFile(), "auth_callback_state", auth_callback_state);
  }
  return auth_callback_state;
}

export function setAuthCallbackState(value: string) {
  fileIt.setJsonValue(getDeviceFile(), "auth_callback_state", value);
}

export function getIntegrations() {
  let integrations = getFileDataAsJson(getIntegrationsFile());
  if (!integrations) {
    integrations = [];
    fileIt.writeJsonFileSync(getIntegrationsFile(), integrations);
  }
  const integrationsLen = integrations.length;
  // check to see if there are any [] values and remove them
  integrations = integrations.filter((n) => n && n.authId);
  if (integrations.length !== integrationsLen) {
    // update the file with the latest
    fileIt.writeJsonFileSync(getIntegrationsFile(), integrations);
  }
  return integrations;
}

export function syncSlackIntegrations(integrations) {
  const nonSlackIntegrations = getIntegrations().filter((integration) => integration.name.toLowerCase() != "slack");
  integrations = integrations?.length ? [...integrations, ...nonSlackIntegrations] : nonSlackIntegrations;
  fileIt.writeJsonFileSync(getIntegrationsFile(), integrations);
}

export function syncSpotifyIntegration(integration) {
  const nonSpotifyIntegrations = getIntegrations().filter((integration) => integration.name.toLowerCase() != "spotify");
  const integrations = integration ? [...nonSpotifyIntegrations, integration] : nonSpotifyIntegrations;
  fileIt.writeJsonFileSync(getIntegrationsFile(), integrations);
}

export function softwareSessionFileExists() {
  // don't auto create the file
  const file = getSoftwareSessionFile();
  // check if it exists
  return fs.existsSync(file);
}

export function getLocalREADMEFile() {
  const resourcePath: string = path.join(__dirname, "resources");
  const file = path.join(resourcePath, "README.md");
  return file;
}

export function displayReadmeIfNotExists(override = false) {
  const vscode_musictime_initialized = getItem("displayedMtReadme");
  if (!vscode_musictime_initialized) {
    // activate the plugin
    softwarePost("/plugins/activate", {}, getItem("jwt"));
  }

  if (!vscode_musictime_initialized || override) {
    setTimeout(() => {
      commands.executeCommand("musictime.displaySidebar");
    }, 1000);

    const readmeUri = Uri.file(getLocalREADMEFile());

    commands.executeCommand("markdown.showPreview", readmeUri, ViewColumn.One);
    setItem("displayedMtReadme", true);
  }
}

export function logIt(message) {
  console.log(`${getExtensionName()}: ${message}`);
}

export function getSoftwareSessionAsJson() {
  let data = fileIt.readJsonFileSync(getSoftwareSessionFile());
  return data ? data : {};
}

export function isNewDay() {
  const { day } = getNowTimes();
  const currentDay = getItem("currentDay");
  return currentDay !== day ? true : false;
}
