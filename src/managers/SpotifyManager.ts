import { CodyConfig, getUserProfile, setConfig } from "cody-music";
import { window } from "vscode";
import { app_endpoint, YES_LABEL } from "../Constants";
import { appGet, isResponseOk } from "../HttpClient";
import SoftwareIntegration from "../model/SoftwareIntegration";
import { isMac, launchWebUrl, logIt } from "../Util";
import { SpotifyUser } from "cody-music/dist/lib/profile";
import { getCachedSpotifyIntegrations } from "./UserStatusManager";
import { initializeSpotify } from './PlaylistDataManager';

let spotifyUser: SpotifyUser = null;
let spotifyAccessToken: string = "";
let spotifyAccessTokenTimer: any = undefined;

export function clearSpotifyAccessToken() {
  if (spotifyAccessTokenTimer) {
    clearTimeout(spotifyAccessTokenTimer);
    spotifyAccessTokenTimer = null;
  }
}

export async function getConnectedSpotifyUser() {
  if (!spotifyUser || !spotifyUser.id) {
    spotifyUser = await getUserProfile();
  }
  return spotifyUser;
}

export function hasSpotifyUser() {
  return !!(spotifyUser && spotifyUser.product);
}

export async function isPremiumUser() {
  if (spotifyUser?.id && spotifyUser.product !== "premium") {
    // check 1 more time
    await populateSpotifyUser(true);
  }
  return !!(spotifyUser?.id && spotifyUser.product === "premium");
}

export async function updateSpotifyClientInfo() {
  const resp = await appGet("/api/v1/integration_connection/spotify/access_token");
  if (isResponseOk(resp)) {
    spotifyAccessToken = resp.data.access_token;
    if (resp.data.expires_at) {
      // start the timer
      refetchSpotifyAccessTokenTimer(resp.data.expires_at);
    }
  }
}

function refetchSpotifyAccessTokenTimer(expires_at: string) {
  const millisTimeout = new Date(expires_at).getTime() - new Date().getTime();
  if (spotifyAccessTokenTimer) {
    clearTimeout(spotifyAccessTokenTimer);
    spotifyAccessTokenTimer = null;
  }
  spotifyAccessTokenTimer = setTimeout(() => {
    // initialize spotify access token with cody music
    initializeSpotify(false);
  }, millisTimeout);
}

export async function populateSpotifyUser(hardRefresh = false) {
  let spotifyIntegration = await getSpotifyIntegration();
  if (!spotifyIntegration) {
    spotifyIntegration = await getSpotifyIntegration();
  }

  if (spotifyIntegration && (hardRefresh || !spotifyUser || !spotifyUser.id)) {
    // get the user
    spotifyUser = await getUserProfile();
  }
}

export async function switchSpotifyAccount() {
  const selection = await window.showInformationMessage(`Are you sure you would like to connect to a different Spotify account?`, ...[YES_LABEL]);
  if (selection === YES_LABEL) {
    launchWebUrl(`${app_endpoint}/data_sources/integration_types/spotify`);
  }
}

export async function getSpotifyIntegration(): Promise<SoftwareIntegration> {
  const spotifyIntegrations: SoftwareIntegration[] = await getCachedSpotifyIntegrations();
  if (spotifyIntegrations?.length) {
    // get the last one in case we have more than one.
    // the last one is the the latest one created.
    return spotifyIntegrations[spotifyIntegrations.length - 1];
  }
  return null;
}

/**
 * Update the cody config settings for cody-music
 */
export async function updateCodyConfig() {
  const spotifyIntegration: SoftwareIntegration = await getSpotifyIntegration();

  if (!spotifyIntegration) {
    spotifyUser = null;
  }

  if (!spotifyAccessToken) {
    await updateSpotifyClientInfo();
  }

  const codyConfig: CodyConfig = new CodyConfig();
  codyConfig.enableItunesDesktop = false;
  codyConfig.enableItunesDesktopSongTracking = isMac();
  codyConfig.enableSpotifyDesktop = isMac();
  codyConfig.spotifyAccessToken = spotifyAccessToken;
  setConfig(codyConfig);
}
