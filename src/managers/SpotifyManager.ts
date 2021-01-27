import { CodyConfig, getUserProfile, setConfig } from "cody-music";
import { commands, window } from "vscode";
import { api_endpoint, YES_LABEL } from "../Constants";
import { isResponseOk, softwareGet, softwarePut } from "../HttpClient";
import SoftwareIntegration from "../model/SoftwareIntegration";
import {
  getPluginId,
  getPluginType,
  getVersion,
  isMac,
  launchWebUrl,
} from "../Util";
import { SpotifyUser } from "cody-music/dist/lib/profile";
import { MusicDataManager } from "../music/MusicDataManager";
import { MusicCommandManager } from "../music/MusicCommandManager";
import { getAuthCallbackState, getIntegrations, getItem, getPluginUuid, setAuthCallbackState, setItem } from "./FileManager";
import { getUser, getUserRegistrationState, updateUserInfoIfRegistered } from "./UserStatusManager";
import { clearSpotifyIntegrations, updateSlackIntegrations, updateSpotifyIntegrations } from "./IntegrationManager";
import { MusicManager } from "../music/MusicManager";

const queryString = require("query-string");

let spotifyUser: SpotifyUser = null;
let spotifyClientId: string = "";
let spotifyClientSecret: string = "";

export function getConnectedSpotifyUser() {
  return spotifyUser;
}

export function hasSpotifyUser() {
  return !!(spotifyUser && spotifyUser.product);
}

export function isPremiumUser() {
  return !!(spotifyUser && spotifyUser.product === "premium");
}

export async function updateSpotifyClientInfo() {
  const resp = await softwareGet("/auth/spotify/clientInfo", getItem("jwt"));
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
  });

  const endpoint = `${api_endpoint}/auth/spotify?${queryStr}`;
  launchWebUrl(endpoint);

  setTimeout(() => {
    refetchSpotifyConnectStatusLazily(40);
  }, 10000);
}

async function refetchSpotifyConnectStatusLazily(tryCountUntilFound) {
  let registrationState = await getUserRegistrationState();
  if (!registrationState.connected) {
    // try again if the count is not zero
    if (tryCountUntilFound > 0) {
      tryCountUntilFound -= 1;
      refetchSpotifyConnectStatusLazily(tryCountUntilFound);
    } else {
      // clear the auth callback state
      setAuthCallbackState(null);
    }
  } else {
    // clear the auth callback state
    setAuthCallbackState(null);

    setItem("requiresSpotifyReAuth", false);

    updateUserInfoIfRegistered(registrationState.user);

    // update the login status
    window.showInformationMessage(`Successfully connected to Spotify. Loading playlists...`);

    // first get the spotify user
    await populateSpotifyUser();

    // clear existing spotify integrations
    clearSpotifyIntegrations();

    await updateSpotifyIntegrations(registrationState.user);
    await updateSlackIntegrations(registrationState.user);

    // initialize spotify and playlists
    await MusicManager.getInstance().initializeSpotify();

    // initiate the playlist build
    setTimeout(() => {
      commands.executeCommand("musictime.hardRefreshPlaylist");
    }, 2000);
  }
}

export async function populateSpotifyUser() {
  const spotifyIntegration = getSpotifyIntegration();
  if (spotifyIntegration && (!spotifyUser || !spotifyUser.id)) {
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
  const spotifyIntegrations: SoftwareIntegration[] = getIntegrations().filter(
    (n) => n.name.toLowerCase() === "spotify" && n.status.toLowerCase() === "active"
  );
  if (spotifyIntegrations?.length) {
    // get the last one in case we have more than one.
    // the last one is the the latest one created.
    return spotifyIntegrations[spotifyIntegrations.length - 1];
  }
  return null;
}

export function removeSpotifyIntegration() {
  clearSpotifyIntegrations();

  // clear the tokens from cody config
  updateCodyConfig();
  // update the spotify user to null
  spotifyUser = null;
}

export async function disconnectSpotify(confirmDisconnect = true) {
  const selection = confirmDisconnect
    ? await window.showInformationMessage(`Are you sure you would like to disconnect Spotify?`, ...[YES_LABEL])
    : YES_LABEL;

  if (selection === YES_LABEL) {
    await softwarePut(`/auth/spotify/disconnect`, {}, getItem("jwt"));

    // remove the integration
    removeSpotifyIntegration();

    // clear the spotify playlists
    MusicDataManager.getInstance().disconnect();

    setTimeout(() => {
      commands.executeCommand("musictime.refreshPlaylist");
      commands.executeCommand("musictime.refreshRecommendations");
    }, 1000);

    // update the status bar
    MusicCommandManager.syncControls(MusicDataManager.getInstance().runningTrack, false);

    if (confirmDisconnect) {
      window.showInformationMessage(`Successfully disconnected your Spotify connection.`);
    }
  }
}

/**
 * Update the cody config settings for cody-music
 */
export async function updateCodyConfig() {
  const spotifyIntegration: SoftwareIntegration = getSpotifyIntegration();

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
      const user = await getUser(getItem("jwt"));
      if (user) {
        // update the integrations
        await updateSpotifyIntegrations(user);
        updateCodyConfig();
      }
    }
  }
}
