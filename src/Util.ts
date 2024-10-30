import { extensions, window, commands } from "vscode";
import { MUSIC_TIME_EXT_ID, app_endpoint, MUSIC_TIME_PLUGIN_ID, CODE_TIME_EXT_ID, EDITOR_OPS_EXT_ID, SOFTWARE_DIRECTORY } from "./Constants";
import { CodyResponse, CodyResponseType } from "cody-music";
import { getJsonItem, setJsonItem, storeJsonData } from "./managers/FileManager";

import { formatISO } from 'date-fns';
import { v4 as uuidv4 } from "uuid";
import { initializeWebsockets, websocketAlive } from './websockets';
import { isWindows } from "./managers/DeviceManager";

import open from 'open';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const outputChannel = window.createOutputChannel('MusicTime');

export const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MARKER_WIDTH = 4;

export function getMusicTimePluginId() {
  return MUSIC_TIME_PLUGIN_ID;
}

export function getPluginName() {
  return MUSIC_TIME_EXT_ID;
}

export function getEditorName() {
  return 'vscode';
}

export function getSoftwareSessionFile() {
  return getFile("session.json");
}

export function getDeviceFile() {
  return getFile("device.json");
}

export function getSoftwareDir() {
  const homedir = os.homedir();
  const softwareDataDir = isWindows() ? `${homedir}\\${SOFTWARE_DIRECTORY}` : `${homedir}/${SOFTWARE_DIRECTORY}`;

  if (!fs.existsSync(softwareDataDir)) {
    fs.mkdirSync(softwareDataDir);
  }
  return softwareDataDir;
}

function getFile(name: string, default_data = {}) {
  const file_path = getSoftwareDir();
  const file = isWindows() ? `${file_path}\\${name}` : `${file_path}/${name}`;
  if (!fs.existsSync(file)) {
    storeJsonData(file, default_data);
  }
  return file;
}

export function setItem(key, value) {
  setJsonItem(getSoftwareSessionFile(), key, value);
}

export function getItem(key) {
  return getJsonItem(getSoftwareSessionFile(), key);
}

export function getVersion() {
  const extension = extensions.getExtension(MUSIC_TIME_EXT_ID);
  return extension.packageJSON.version;
}

export function codeTimeExtInstalled() {
  return !!extensions.getExtension(CODE_TIME_EXT_ID);
}

export function editorOpsExtInstalled() {
  return !!extensions.getExtension(EDITOR_OPS_EXT_ID);
}

export function getPluginUuid() {
  let plugin_uuid = getJsonItem(getDeviceFile(), "plugin_uuid");
  if (!plugin_uuid) {
    // set it for the 1st and only time
    plugin_uuid = uuidv4();
    setJsonItem(getDeviceFile(), "plugin_uuid", plugin_uuid);
  }
  return plugin_uuid;
}

export function getAuthCallbackState(autoCreate = true) {
  let auth_callback_state = getJsonItem(getDeviceFile(), "auth_callback_state");
  if (!auth_callback_state && autoCreate) {
    auth_callback_state = uuidv4();
    setJsonItem(getDeviceFile(), "auth_callback_state", auth_callback_state);
  }
  return auth_callback_state;
}

export function getLocalREADMEFile() {
  const resourcePath: string = path.join(__dirname, "resources");
  const file = path.join(resourcePath, "README.md");
  return file;
}

export function setAuthCallbackState(value: string) {
  setJsonItem(getDeviceFile(), "auth_callback_state", value);
}

export function getLogId() {
  return 'MusicTime';
}

export function logIt(message: string, isError: boolean = false) {
  outputChannel.appendLine(`${formatISO(new Date())} ${getLogId()}: ${message}`);
	if (isError) {
    console.error(message)
  }
}

export function getOffsetSeconds() {
  const d = new Date();
  return d.getTimezoneOffset() * 60;
}

export function getSongDisplayName(name) {
  if (!name) {
    return "";
  }
  let displayName = "";
  name = name.trim();
  if (name.length > 14) {
    const parts = name.split(" ");
    for (let i = 0; i < parts.length; i++) {
      displayName = `${displayName} ${parts[i]}`;
      if (displayName.length >= 12) {
        if (displayName.length > 14) {
          // trim it down to at least 14
          displayName = `${displayName.substring(0, 14)}`;
        }
        displayName = `${displayName}..`;
        break;
      }
    }
  } else {
    displayName = name;
  }
  return displayName.trim();
}

export function launchWebUrl(url) {
  if (!websocketAlive()) {
    try {
      initializeWebsockets();
    } catch (e) {
      console.error("Failed to initialize websockets", e);
    }
  }
  open(url);
}

export function launchMusicAnalytics() {
  const isRegistered = checkRegistration();
  if (!isRegistered) {
    return;
  }
  open(`${app_endpoint}/music`);
}

export function checkRegistration(showSignup = true) {
  if (!getItem("name")) {
    if (showSignup) {
      showModalSignupPrompt("Sign up or register for a web.com account at Software.com to view your most productive music.");
    }
    return false;
  }
  return true;
}

export function showModalSignupPrompt(msg: string) {
  window
    .showInformationMessage(
      msg,
      {
        modal: true,
      },
      "Sign up"
    )
    .then(async (selection) => {
      if (selection === "Sign up") {
        commands.executeCommand("musictime.signUpAccount");
      }
    });
}

export function showInformationMessage(message: string) {
  return window.showInformationMessage(`${message}`);
}

export function showWarningMessage(message: string) {
  return window.showWarningMessage(`${message}`);
}

export function createUriFromTrackId(track_id: string) {
  if (track_id && !track_id.includes("spotify:track:")) {
    track_id = `spotify:track:${track_id}`;
  }

  return track_id;
}

export function createUriFromPlaylistId(playlist_id: string) {
  if (playlist_id && !playlist_id.includes("spotify:playlist:")) {
    playlist_id = `spotify:playlist:${playlist_id}`;
  }

  return playlist_id;
}

export function createSpotifyIdFromUri(id: string) {
  if (id && id.indexOf("spotify:") === 0) {
    return id.substring(id.lastIndexOf(":") + 1);
  }
  return id;
}

export function getCodyErrorMessage(response: CodyResponse) {
  if (response && response.error && response.error.response) {
    return response.error.response.data.error.message;
  } else if (response.state === CodyResponseType.Failed) {
    return response.message;
  }
  return "";
}

export function getImage(name: string) {
  const resourcePath: string = path.join(__dirname, 'images');
  const file = path.join(resourcePath, name);
  return file;
}
