import { workspace, extensions, window, WorkspaceFolder, commands } from "vscode";
import {
  MUSIC_TIME_EXT_ID,
  launch_url,
  MUSIC_TIME_PLUGIN_ID,
  MUSIC_TIME_TYPE,
  SOFTWARE_TOP_40_PLAYLIST_ID,
  SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
  SOFTWARE_FOLDER,
} from "./Constants";
import { PlaylistItem, TrackStatus, CodyResponse, CodyResponseType } from "cody-music";
import * as path from "path";
import { getItem } from "./managers/FileManager";
import { isGitProject } from './repo/GitUtil';
import { execSync } from 'child_process';
import { execCmd } from './managers/ExecManager';

const fileIt = require("file-it");
const moment = require("moment-timezone");
const open = require("open");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const resourcePath: string = path.join(__dirname, "resources");

export const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const DASHBOARD_LABEL_WIDTH = 25;
export const DASHBOARD_VALUE_WIDTH = 25;
export const MARKER_WIDTH = 4;

const NUMBER_IN_EMAIL_REGEX = new RegExp("^\\d+\\+");
const dayFormat = "YYYY-MM-DD";
const dayTimeFormat = "LLLL";

export function getPluginId() {
  return MUSIC_TIME_PLUGIN_ID;
}

export function getPluginName() {
  return MUSIC_TIME_EXT_ID;
}

export function getPluginType() {
  return MUSIC_TIME_TYPE;
}

export function getVersion() {
  const extension = extensions.getExtension(MUSIC_TIME_EXT_ID);
  return extension.packageJSON.version;
}

export function isCodeTimeMetricsFile(fileName) {
  fileName = fileName || "";
  if (fileName.includes(SOFTWARE_FOLDER) && fileName.includes("CodeTime")) {
    return true;
  }
  return false;
}

export function musicTimeExtInstalled() {
  const musicTimeExt = extensions.getExtension(MUSIC_TIME_EXT_ID);
  return musicTimeExt ? true : false;
}

/**
 * These will return the workspace folders.
 * use the uri.fsPath to get the full path
 * use the name to get the folder name
 */
export function getWorkspaceFolders(): WorkspaceFolder[] {
  let folders = [];
  if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
    for (let i = 0; i < workspace.workspaceFolders.length; i++) {
      let workspaceFolder = workspace.workspaceFolders[i];
      let folderUri = workspaceFolder.uri;
      if (folderUri && folderUri.fsPath) {
        folders.push(workspaceFolder);
      }
    }
  }
  return folders;
}

export function getActiveProjectWorkspace(): WorkspaceFolder {
  const activeDocPath = findFirstActiveDirectoryOrWorkspaceDirectory();
  if (activeDocPath) {
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
      for (let i = 0; i < workspace.workspaceFolders.length; i++) {
        const workspaceFolder = workspace.workspaceFolders[i];
        const folderPath = workspaceFolder.uri.fsPath;
        if (activeDocPath.indexOf(folderPath) !== -1) {
          return workspaceFolder;
        }
      }
    }
  }
  return null;
}

export function findFirstActiveDirectoryOrWorkspaceDirectory(): string {
  if (getNumberOfTextDocumentsOpen() > 0) {
    // check if the .software/CodeTime has already been opened
    for (let i = 0; i < workspace.textDocuments.length; i++) {
      let docObj = workspace.textDocuments[i];
      if (docObj.fileName) {
        const dir = getRootPathForFile(docObj.fileName);
        if (dir) {
          return dir;
        }
      }
    }
  }
  const folder: WorkspaceFolder = getFirstWorkspaceFolder();
  if (folder) {
    return folder.uri.fsPath;
  }
  return "";
}

export function getFirstWorkspaceFolder(): WorkspaceFolder {
  const workspaceFolders: WorkspaceFolder[] = getWorkspaceFolders();
  if (workspaceFolders && workspaceFolders.length) {
    return workspaceFolders[0];
  }
  return null;
}

export function getRootPaths() {
  let paths = [];
  if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
    for (let i = 0; i < workspace.workspaceFolders.length; i++) {
      let workspaceFolder = workspace.workspaceFolders[i];
      let folderUri = workspaceFolder.uri;
      if (folderUri && folderUri.fsPath) {
        paths.push(folderUri.fsPath);
      }
    }
  }
  return paths;
}

export function getNumberOfTextDocumentsOpen() {
  return workspace.textDocuments ? workspace.textDocuments.length : 0;
}

export function getRootPathForFile(fileName) {
  let folder = getProjectFolder(fileName);
  if (folder) {
    return folder.uri.fsPath;
  }
  return null;
}

export function getProjectFolder(fileName) {
  let liveshareFolder = null;
  if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
    for (let i = 0; i < workspace.workspaceFolders.length; i++) {
      let workspaceFolder = workspace.workspaceFolders[i];
      if (workspaceFolder.uri) {
        let isVslsScheme = workspaceFolder.uri.scheme === "vsls" ? true : false;
        if (isVslsScheme) {
          liveshareFolder = workspaceFolder;
        }
        let folderUri = workspaceFolder.uri;
        if (folderUri && folderUri.fsPath && !isVslsScheme && fileName.includes(folderUri.fsPath)) {
          return workspaceFolder;
        }
      }
    }
  }
  // wasn't found but if liveshareFolder was found, return that
  if (liveshareFolder) {
    return liveshareFolder;
  }
  return null;
}

export function isLinux() {
  return isWindows() || isMac() ? false : true;
}

// process.platform return the following...
//   -> 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
export function isWindows() {
  return process.platform.indexOf("win32") !== -1;
}

export function isMac() {
  return process.platform.indexOf("darwin") !== -1;
}

export async function getHostname() {
  let hostname = execCmd("hostname");
  return hostname;
}

export function getOs() {
  let parts = [];
  let osType = os.type();
  if (osType) {
    parts.push(osType);
  }
  let osRelease = os.release();
  if (osRelease) {
    parts.push(osRelease);
  }
  let platform = os.platform();
  if (platform) {
    parts.push(platform);
  }
  if (parts.length > 0) {
    return parts.join("_");
  }
  return "";
}

export async function getOsUsername() {
  let username = os.userInfo().username;
  if (!username || username.trim() === "") {
    username = execCmd("whoami");
  }
  return username;
}

export async function showOfflinePrompt(addReconnectMsg = false) {
  // shows a prompt that we're not able to communicate with the app server
  let infoMsg = "Our service is temporarily unavailable. ";
  if (addReconnectMsg) {
    infoMsg += "We will try to reconnect again in 10 minutes. Your status bar will not update at this time.";
  } else {
    infoMsg += "Please try again later.";
  }
  // set the last update time so we don't try to ask too frequently
  window.showInformationMessage(infoMsg, ...["OK"]);
}

export function nowInSecs() {
  return Math.round(Date.now() / 1000);
}

export function getOffsetSeconds() {
  let d = new Date();
  return d.getTimezoneOffset() * 60;
}

export function getNowTimes() {
  const now = moment.utc();
  const now_in_sec = now.unix();
  const offset_in_sec = moment().utcOffset() * 60;
  const local_now_in_sec = now_in_sec + offset_in_sec;
  const utcDay = now.format(dayFormat);
  const day = moment().format(dayFormat);
  const localDayTime = moment().format(dayTimeFormat);

  return {
    now,
    now_in_sec,
    offset_in_sec,
    local_now_in_sec,
    utcDay,
    day,
    localDayTime,
  };
}

export function getFormattedDay(unixSeconds) {
  return moment.unix(unixSeconds).format(dayFormat);
}

export function coalesceNumber(val, defaultVal = 0) {
  if (val === null || val === undefined || isNaN(val)) {
    return defaultVal;
  }
  return val;
}

export function randomCode() {
  return crypto
    .randomBytes(16)
    .map((value) => alpha.charCodeAt(Math.floor((value * alpha.length) / 256)))
    .toString();
}

export function deleteFile(file) {
  // if the file exists, get it
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

/**
 * Format pathString if it is on Windows. Convert `c:\` like string to `C:\`
 * @param pathString
 */
export function formatPathIfNecessary(pathString: string) {
  if (process.platform === "win32") {
    pathString = pathString.replace(/^([a-zA-Z])\:\\/, (_, $1) => `${$1.toUpperCase()}:\\`);
  }
  return pathString;
}

export function normalizeGithubEmail(email: string, filterOutNonEmails = true) {
  if (email) {
    if (filterOutNonEmails && (email.endsWith("github.com") || email.includes("users.noreply"))) {
      return null;
    } else {
      const found = email.match(NUMBER_IN_EMAIL_REGEX);
      if (found && email.includes("users.noreply")) {
        // filter out the ones that look like
        // 2342353345+username@users.noreply.github.com"
        return null;
      }
    }
  }

  return email;
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

export async function getGitEmail() {
  let projectDirs = getRootPaths();

  if (!projectDirs || projectDirs.length === 0) {
    return null;
  }

  for (let i = 0; i < projectDirs.length; i++) {
    let projectDir = projectDirs[i];

    if (projectDir && isGitProject(projectDir)) {
      let email = execCmd("git config user.email", projectDir);
      if (email) {
        /**
         * // normalize the email, possible github email types
         * shupac@users.noreply.github.com
         * 37358488+rick-software@users.noreply.github.com
         */
        email = normalizeGithubEmail(email);
        return email;
      }
    }
  }
  return null;
}

export function launchWebUrl(url) {
  open(url);
}

export function launchMusicAnalytics() {
  const isRegistered = checkRegistration();
  if (!isRegistered) {
    return;
  }
  open(`${launch_url}/music`);
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

/**
 * humanize the minutes
 */
export function humanizeMinutes(min) {
  min = parseInt(min, 0) || 0;
  let str = "";
  if (min === 60) {
    str = "1 hr";
  } else if (min > 60) {
    let hrs = parseFloat(min) / 60;
    if (hrs % 1 === 0) {
      str = hrs.toFixed(0) + " hrs";
    } else {
      str = (Math.round(hrs * 10) / 10).toFixed(1) + " hrs";
    }
  } else if (min === 1) {
    str = "1 min";
  } else {
    // less than 60 seconds
    str = min.toFixed(0) + " min";
  }
  return str;
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

export function getPlaylistIcon(treeItem: PlaylistItem) {
  const stateVal = treeItem.state !== TrackStatus.Playing ? "notplaying" : "playing";
  let contextValue = treeItem["contextValue"] ?? "";

  // itemType will be either: track | playlist
  // type will be either: connected | action | recommendation | label | track | playlist | itunes | spotify
  // tag will be either: action | paw | spotify | spotify-liked-songs | active

  // track/playlist/action hover contextValue matching...
  // musictime.sharePlaylist =~ /spotify-playlist-item.*/
  // musictime.shareTrack =~ /track-item.*/ || /spotify-recommendation.*/
  // musictime.addToPlaylist =~ /spotify-recommendation.*/
  // musictime.highPopularity =~ /.*-highpopularity/

  if (treeItem.tag === "action") {
    this.contextValue = "treeitem-action";
  } else if (treeItem["itemType"] === "track" || treeItem["itemType"] === "playlist") {
    if (treeItem.tag === "paw") {
      // we use the paw to show as the music time playlist, but
      // make sure the contextValue has spotify in it
      contextValue = `spotify-${treeItem.type}-item-${stateVal}`;
    } else {
      if (treeItem.tag) {
        contextValue = `${treeItem.tag}-${treeItem.type}-item-${stateVal}`;
      } else {
        contextValue = `${treeItem.type}-item-${stateVal}`;
      }
    }
  }

  if (treeItem.id === SOFTWARE_TOP_40_PLAYLIST_ID && !treeItem.loved) {
    contextValue += "-softwaretop40";
  } else if (treeItem["playlist_id"] == SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
    contextValue += "-isliked";
  }

  let lightPath = null;
  let darkPath = null;

  if (treeItem["icon"]) {
    lightPath = path.join(resourcePath, "light", treeItem["icon"]);
    darkPath = path.join(resourcePath, "dark", treeItem["icon"]);
  } else if (treeItem.type.includes("spotify") || (treeItem.tag.includes("spotify") && treeItem.itemType !== "playlist")) {
    const spotifySvg = treeItem.tag === "disabled" ? "spotify-disconnected.svg" : "spotify.svg";
    lightPath = path.join(resourcePath, "light", spotifySvg);
    darkPath = path.join(resourcePath, "dark", spotifySvg);
  } else if (treeItem.itemType === "playlist" && treeItem.tag !== "paw") {
    const playlistSvg = "playlist.svg";
    lightPath = path.join(resourcePath, "light", playlistSvg);
    darkPath = path.join(resourcePath, "dark", playlistSvg);
  } else if (treeItem.tag === "itunes" || treeItem.type === "itunes") {
    lightPath = path.join(resourcePath, "light", "itunes-logo.svg");
    darkPath = path.join(resourcePath, "dark", "itunes-logo.svg");
  } else if (treeItem.tag === "paw") {
    lightPath = path.join(resourcePath, "light", "paw.svg");
    darkPath = path.join(resourcePath, "dark", "paw.svg");
  } else if (treeItem.type === "connected") {
    lightPath = path.join(resourcePath, "light", "radio-tower.svg");
    darkPath = path.join(resourcePath, "dark", "radio-tower.svg");
  } else if (treeItem.type === "offline") {
    lightPath = path.join(resourcePath, "light", "nowifi.svg");
    darkPath = path.join(resourcePath, "dark", "nowifi.svg");
  } else if (treeItem.type === "action" || treeItem.tag === "action") {
    lightPath = path.join(resourcePath, "light", "generate.svg");
    darkPath = path.join(resourcePath, "dark", "generate.svg");
  } else if (treeItem.type === "login" || treeItem.tag === "login") {
    lightPath = path.join(resourcePath, "light", "sign-in.svg");
    darkPath = path.join(resourcePath, "dark", "sign-in.svg");
  } else if (treeItem.type === "divider") {
    lightPath = path.join(resourcePath, "light", "line.svg");
    darkPath = path.join(resourcePath, "dark", "line.svg");
  }
  return { lightPath, darkPath, contextValue };
}

export function getCodyErrorMessage(response: CodyResponse) {
  if (response && response.error && response.error.response) {
    return response.error.response.data.error.message;
  } else if (response.state === CodyResponseType.Failed) {
    return response.message;
  }
  return "";
}

export function getFileDataArray(file) {
  let payloads: any[] = fileIt.readJsonArraySync(file);
  return payloads;
}
