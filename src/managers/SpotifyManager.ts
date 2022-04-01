import { CodyConfig, getUserProfile, setConfig } from "cody-music";
import { window } from "vscode";
import { app_endpoint, YES_LABEL } from "../Constants";
import { isResponseOk, softwareGet } from "../HttpClient";
import SoftwareIntegration from "../model/SoftwareIntegration";
import { isMac, launchWebUrl } from "../Util";
import { SpotifyUser } from "cody-music/dist/lib/profile";
import { getItem, setItem } from "./FileManager";
import { getCachedSpotifyIntegrations, getCachedUser, getUser } from "./UserStatusManager";

let spotifyUser: SpotifyUser = null;
let spotifyClientId: string = "";
let spotifyClientSecret: string = "";

export async function getConnectedSpotifyUser() {
  if (!spotifyUser || !spotifyUser.id) {
    spotifyUser = await getUserProfile();
  }
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

export async function populateSpotifyUser(hardRefresh = false) {
  let spotifyIntegration = getSpotifyIntegration();
  if (!spotifyIntegration) {
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
    launchWebUrl(`${app_endpoint}/data_sources/integration_types/spotify`);
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

/**
 * Update the cody config settings for cody-music
 */
export async function updateCodyConfig() {
  const spotifyIntegration: SoftwareIntegration = await getSpotifyIntegration();

  if (!spotifyIntegration) {
    spotifyUser = null;
  }

  if (!spotifyClientId) {
    await updateSpotifyClientInfo();
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
      await getUser();
    }

    // remove the legacy spotify_access_token to so we don't have to check
    // if the user needs to migrate any longer
    setItem("spotify_access_token", null);
  }
}
