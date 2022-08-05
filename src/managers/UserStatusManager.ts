import { commands, window } from "vscode";
import { app_endpoint } from "../Constants";
import { appGet, isResponseOk } from "../HttpClient";
import { showQuickPick } from "../MenuManager";
import { launchWebUrl, getMusicTimePluginId, codeTimeExtInstalled, editorOpsExtInstalled, getAuthCallbackState, getItem, getPluginUuid, setAuthCallbackState, setItem } from "../Util";
import { initializeWebsockets } from "../websockets";
import { initializeSpotify } from "./PlaylistDataManager";
import { updateCodyConfig } from './SpotifyManager';

const queryString = require("query-string");

let currentUser: any | null = null;
let lastUserFetch: number = 0;

export function getCachedUser() {
  return currentUser;
}

export async function getUser() {
  const nowMillis: number = new Date().getTime();
  if (currentUser && nowMillis - lastUserFetch < 2000) {
    updateCodyConfig();
    return currentUser;
  }

  const resp = await appGet('/api/v1/user');
  if (isResponseOk(resp) && resp.data) {
    currentUser = resp.data;
    lastUserFetch = nowMillis;
    updateCodyConfig();
    return currentUser;
  }

  return null;
}

export function showLogInMenuOptions() {
  showAuthMenuOptions("Log in", false /*isSignup*/);
}

export function showSignUpMenuOptions() {
  showAuthMenuOptions("Sign up", true /*isSignup*/);
}

function showAuthMenuOptions(authText: string, isSignup: boolean = true) {
  const items = [];
  const placeholder = `${authText} using...`;
  items.push({
    label: `${authText} with Google`,
    command: "musictime.googleLogin",
    commandArgs: [null /*KpmItem*/, true /*switching_account*/],
  });
  items.push({
    label: `${authText} with GitHub`,
    command: "musictime.githubLogin",
    commandArgs: [null /*KpmItem*/, true /*switching_account*/],
  });
  if (isSignup) {
    items.push({
      label: `${authText} with Email`,
      command: "musictime.emailSignup",
      commandArgs: [null /*KpmItem*/, true /*switching_account*/],
    });
  } else {
    items.push({
      label: `${authText} with Email`,
      command: "musictime.emailLogin",
      commandArgs: [null /*KpmItem*/, true /*switching_account*/],
    });
  }
  const menuOptions = {
    items,
    placeholder,
  };
  showQuickPick(menuOptions);
}

export async function launchLogin(loginType: string = "software", switching_account: boolean = false) {
  setItem("authType", loginType);
  setItem("switching_account", switching_account);

  const jwt = getItem("jwt");
  const name = getItem("name");

  const auth_callback_state = getAuthCallbackState(true);

  let url = "";

  let obj = {
    plugin_id: getMusicTimePluginId(),
    plugin_uuid: getPluginUuid(),
    auth_callback_state,
    login: true,
  };

  if (!name) {
    obj["plugin_token"] = jwt;
  }

  if (loginType === "github") {
    // github signup/login flow
    url = `${app_endpoint}/auth/github`;
  } else if (loginType === "google") {
    // google signup/login flow
    url = `${app_endpoint}/auth/google`;
  } else {
    // email login
    obj["token"] = getItem("jwt");
    obj["auth"] = "software";
    if (switching_account) {
      obj["login"] = true;
      url = `${app_endpoint}/onboarding`;
    } else {
      url = `${app_endpoint}/email-signup`;
    }
  }

  const qryStr = queryString.stringify(obj);

  url = `${url}?${qryStr}`;

  launchWebUrl(url);
}

export async function authenticationCompleteHandler(user) {
  // clear the auth callback state
  setAuthCallbackState(null);

  // set the email and jwt
  if (user?.registered === 1) {
    currentUser = user;

    if (user.plugin_jwt) {
      setItem("jwt", user.plugin_jwt);
    }
    setItem('name', user.email);

    window.showInformationMessage(`Successfully registered`);

    try {
      initializeWebsockets();
    } catch (e) {
      console.error("Failed to initialize websockets", e);
    }

    await getUser();

    // this will reload the playlist for both slack and spotify
    await processNewSpotifyIntegration(false);

    if (codeTimeExtInstalled()) {
      setTimeout(() => {
        commands.executeCommand("codetime.refreshCodeTimeView");
      }, 1000);
    }
    if (editorOpsExtInstalled()) {
      setTimeout(() => {
        commands.executeCommand("editorOps.refreshEditorOpsView");
      }, 1000);
    }
  }
}

export async function processNewSpotifyIntegration(showSuccess = true) {
  setItem("requiresSpotifyReAuth", false);

  if (showSuccess) {
    // update the login status
    window.showInformationMessage(`Successfully connected to Spotify. Loading playlists...`);
  }

  // initialize spotify and playlists
  await initializeSpotify();
}

export async function getCachedSlackIntegrations() {
  if (!currentUser) {
    currentUser = await getUser();
  }
  if (currentUser?.integration_connections?.length) {
    return currentUser?.integration_connections?.filter(
      (integration: any) => integration.status === 'ACTIVE' && (integration.integration_type_id === 14));
  }
  return [];
}

export function getCachedSpotifyIntegrations() {
  if (currentUser?.integration_connections?.length) {
    return currentUser?.integration_connections?.filter(
      (integration: any) => integration.status === 'ACTIVE' && (integration.integration_type_id === 12));
  }
  return [];
}

export async function getLatestSpotifyIntegration() {
  const spotifyIntegrations: any[] = getCachedSpotifyIntegrations();
  if (spotifyIntegrations?.length) {
    const sorted = spotifyIntegrations.sort((a, b) => {
      const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.updated_at).getTime();
      const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.updated_at).getTime();
      if (aDate > bDate) return 1;
      if (aDate < bDate) return -1;
      return 0;
    });
    return sorted[0];
  }
  return null;
}

export function isActiveIntegration(type: string, integration: any) {
  if (integration && integration.status.toLowerCase() === "active") {
    if (integration.integration_type) {
      return !!(integration.integration_type.type.toLowerCase() === type.toLowerCase())
    }
    return !!(integration.name.toLowerCase() === type.toLowerCase())
  }
  return false;
}
