import { CodyConfig, getRunningTrack, getUserProfile, setConfig } from "cody-music";
import { commands, window } from "vscode";
import { api_endpoint, YES_LABEL } from "../Constants";
import { isResponseOk, softwareGet, softwarePut } from "../HttpClient";
import SoftwareIntegration from "../model/SoftwareIntegration";
import { getPluginId, getPluginType, getVersion, isMac, launchWebUrl } from "../Util";
import { SpotifyUser } from "cody-music/dist/lib/profile";
import { MusicCommandManager } from "../music/MusicCommandManager";
import { getAuthCallbackState, getItem, getPluginUuid, setItem } from "./FileManager";
import { getCachedSpotifyIntegrations, getUser } from "./UserStatusManager";
import { processNewSpotifyIntegration } from "./UserStatusManager";
import { clearAllData } from "./PlaylistDataManager";

const queryString = require("query-string");

let spotifyUser: SpotifyUser = null;
let spotifyClientId: string = "";
let spotifyClientSecret: string = "";
let addedNewIntegration: boolean = false;

export function updateAddedNewIntegration(val: boolean) {
  addedNewIntegration = val;
}

export function getConnectedSpotifyUser() {
  return spotifyUser;
}

export function hasSpotifyUser() {
  return !!(spotifyUser && spotifyUser.product);
}

export function getSpotifyEmail() {
  const spotifyIntegration = getSpotifyIntegration();
  return spotifyIntegration?.value;
}

export async function getSoftwareTop40() {
  const data = await softwareGet("/music/top40");
  return isResponseOk(data) ? data.data : null;
}

export async function isPremiumUser() {
  if (spotifyUser && spotifyUser.product !== "premium") {
    // check 1 more time
    await populateSpotifyUser(true);
  }
  return !!(spotifyUser && spotifyUser.product === "premium");
}

export async function updateSpotifyClientInfo() {
  const resp = await softwareGet("/auth/spotify/clientInfo");
  if (isResponseOk(resp)) {
    // get the clientId and clientSecret
    spotifyClientId = resp.data.clientId;
    spotifyClientSecret = resp.data.clientSecret;
  }
}

export async function connectSpotify() {
  // check if they're already connected, if so then ask if they would
  // like to continue as we'll need to disconnect the current connection
  const spotifyIntegration = getSpotifyIntegration();
  if (spotifyIntegration) {
    // disconnectSpotify
    const selection = await window.showInformationMessage(`Connect with a different Spotify account?`, ...[YES_LABEL]);
    if (!selection || selection !== YES_LABEL) {
      return;
    }
    // disconnect the current connection
    await disconnectSpotify(false /*confirmDisconnect*/);
  }

  const auth_callback_state = getAuthCallbackState();

  let queryStr = queryString.stringify({
    plugin: getPluginType(),
    plugin_uuid: getPluginUuid(),
    pluginVersion: getVersion(),
    plugin_id: getPluginId(),
    mac: isMac(),
    auth_callback_state,
    plugin_token: getItem("jwt"),
  });

  const endpoint = `${api_endpoint}/auth/spotify?${queryStr}`;
  launchWebUrl(endpoint);
  addedNewIntegration = false;
  setTimeout(() => {
    lazilyPollForSpotifyConnection();
  }, 25000);
}

export async function lazilyPollForSpotifyConnection(tries: number = 10) {
  if (addedNewIntegration) {
    return;
  }

  await getUser(getItem("jwt"))
  const spotifyIntegrations = getCachedSpotifyIntegrations();
  if (!spotifyIntegrations || spotifyIntegrations.length === 0) {
    // try again
    tries--;
    setTimeout(() => {
      lazilyPollForSpotifyConnection(tries);
    }, 15000);
  } else {
    // reload the playlists
    processNewSpotifyIntegration();
  }
}

export async function populateSpotifyUser(hardRefresh = false) {
  let spotifyIntegration = getSpotifyIntegration();
  if (!spotifyIntegration) {
    // get the user
    const user = await getUser(getItem("jwt"));
    if (user) {
      // update the integrations
      updateCodyConfig();
    }
    spotifyIntegration = getSpotifyIntegration();
  }

  if (spotifyIntegration && (hardRefresh || !spotifyUser || !spotifyUser.id)) {
    // get the user
    spotifyUser = await getUserProfile();
  }
}

export async function switchSpotifyAccount() {
  const selection = await window.showInformationMessage(`Are you sure you would like to connect to a different Spotify account?`, ...[YES_LABEL]);
  if (selection === YES_LABEL) {
    await disconnectSpotify(false);
    connectSpotify();
  }
}

export function getSpotifyIntegration(): SoftwareIntegration {
  const spotifyIntegrations: SoftwareIntegration[] = getCachedSpotifyIntegrations();
  if (spotifyIntegrations?.length) {
    // get the last one in case we have more than one.
    // the last one is the the latest one created.
    return spotifyIntegrations[spotifyIntegrations.length - 1];
  }
  return null;
}

export async function disconnectSpotify(confirmDisconnect = true) {
  const selection = confirmDisconnect
    ? await window.showInformationMessage(`Are you sure you would like to disconnect Spotify?`, ...[YES_LABEL])
    : YES_LABEL;

  if (selection === YES_LABEL) {
    await softwarePut(`/auth/spotify/disconnect`, {});
    await getUser(getItem("jwt"));
    // clear the tokens from cody config
    updateCodyConfig();
    // update the spotify user to null
    spotifyUser = null;

    // clear the spotify playlists
    clearAllData();

    setTimeout(() => {
      commands.executeCommand("musictime.refreshMusicTimeView");
    }, 1000);

    // update the status bar
    MusicCommandManager.syncControls(await getRunningTrack(), false);

    if (confirmDisconnect) {
      window.showInformationMessage(`Successfully disconnected your Spotify connection.`);
    }
  }
}

/**
 * Update the cody config settings for cody-music
 */
export async function updateCodyConfig() {
  const spotifyIntegration: SoftwareIntegration = await getSpotifyIntegration();

  if (!spotifyIntegration) {
    spotifyUser = null;
  }

  const codyConfig: CodyConfig = new CodyConfig();
  codyConfig.enableItunesDesktop = false;
  codyConfig.enableItunesDesktopSongTracking = isMac();
  codyConfig.enableSpotifyDesktop = isMac();
  codyConfig.spotifyClientId = spotifyClientId;
  codyConfig.spotifyAccessToken = spotifyIntegration ? spotifyIntegration.access_token : null;
  codyConfig.spotifyRefreshToken = spotifyIntegration ? spotifyIntegration.refresh_token : null;
  codyConfig.spotifyClientSecret = spotifyClientSecret;
  setConfig(codyConfig);
}

export async function migrateAccessInfo() {
  if (!getSpotifyIntegration()) {
    const legacyAccessToken = getItem("spotify_access_token");
    if (legacyAccessToken) {
      // get the user
      await getUser(getItem("jwt"));
      updateCodyConfig();
    }

    // remove the legacy spotify_access_token to so we don't have to check
    // if the user needs to migrate any longer
    setItem("spotify_access_token", null);
  }
}
