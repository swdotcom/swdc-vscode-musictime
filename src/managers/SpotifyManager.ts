import { CodyConfig, getUserProfile, setConfig } from "cody-music";
import { window } from "vscode";
import { app_endpoint, YES_LABEL } from "../Constants";
import { isResponseOk, softwareGet } from "../HttpClient";
import SoftwareIntegration from "../model/SoftwareIntegration";
import { isMac, launchWebUrl, getItem, setItem } from "../Util";
import { SpotifyUser } from "cody-music/dist/lib/profile";
import { getCachedSpotifyIntegrations, getUser } from "./UserStatusManager";

let spotifyUser: SpotifyUser = null;
let spotifyClientId: string = "";
let spotifyClientSecret: string = "";
let spotifyAccessToken: string = "";
let spotifyRefreshToken: string = ""


export async function getConnectedSpotifyUser() {
  if (!spotifyUser || !spotifyUser.id) {
    spotifyUser = await getUserProfile();
  }
  return spotifyUser;
}

export function hasSpotifyUser() {
  return !!(spotifyUser && spotifyUser.product);
}

export async function getSoftwareTop40() {
  const data = await softwareGet("/music/top40");
  return isResponseOk(data) ? data.data : null;
}

export async function isPremiumUser() {
  if (spotifyUser?.id && spotifyUser.product !== "premium") {
    // check 1 more time
    await populateSpotifyUser(true);
  }
  return !!(spotifyUser?.id && spotifyUser.product === "premium");
}

export async function updateSpotifyClientInfo() {
  const resp = await softwareGet("/auth/spotify/clientInfo");
  if (isResponseOk(resp)) {
    // get the clientId and clientSecret
    spotifyClientId = resp.data.clientId;
    spotifyClientSecret = resp.data.clientSecret;

    // TODO: use the access token and expires at value
    spotifyAccessToken = resp.data.access_token;
    spotifyRefreshToken = resp.data.refresh_token;
    if (resp.data.expires_at) {
      // start the timer
      refetchSpotifyAccessTokenTimer(resp.data.expires_at);
    }
  }
}

function refetchSpotifyAccessTokenTimer(expires_at: number) {
  // get the milliseconds until the expiration time minus a 5 second buffer
  const timeoutMillis = (new Date(expires_at * 1000)).getTime() - (new Date()).getTime() - (5000);
  setTimeout(() => {
    updateSpotifyClientInfo();
  }, timeoutMillis);
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

  if (!spotifyClientId) {
    await updateSpotifyClientInfo();
  }

  const codyConfig: CodyConfig = new CodyConfig();
  codyConfig.enableItunesDesktop = false;
  codyConfig.enableItunesDesktopSongTracking = isMac();
  codyConfig.enableSpotifyDesktop = isMac();
  codyConfig.spotifyClientId = spotifyClientId;
  codyConfig.spotifyAccessToken = spotifyAccessToken;
  codyConfig.spotifyRefreshToken = spotifyRefreshToken;
  codyConfig.spotifyClientSecret = spotifyClientSecret;
  setConfig(codyConfig);
}
