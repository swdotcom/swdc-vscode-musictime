import { commands, window } from "vscode";
import { app_endpoint } from "../Constants";
import { isResponseOk, softwareGet } from "../HttpClient";
import { showQuickPick } from "../MenuManager";
import { launchWebUrl, getPluginId } from "../Util";
import { initializeWebsockets } from "../websockets";
import { getAuthCallbackState, getItem, getPluginUuid, setAuthCallbackState, setItem } from "./FileManager";
import { initializeSpotify } from "./PlaylistDataManager";

const queryString = require("query-string");

let authAdded = false;
let currentUser: any | null = null;
const lazy_poll_millis = 20000;

export function updatedAuthAdded(val: boolean) {
  authAdded = val;
}

export async function getUser(jwt) {
  if (jwt) {
    let api = `/users/me`;
    let resp = await softwareGet(api);
    if (isResponseOk(resp)) {
      if (resp && resp.data && resp.data.data) {
        currentUser = resp.data.data;
        return currentUser;
      }
    }
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
    plugin_id: getPluginId(),
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

  updatedAuthAdded(false);

  setTimeout(() => {
    lazilyPollForAuth();
  }, lazy_poll_millis);
}

export async function lazilyPollForAuth(tries: number = 20) {
  if (authAdded) {
    return;
  }

  const foundRegisteredUser = await getUserRegistrationInfo();
  if (!foundRegisteredUser && tries > 0) {
    // try again
    tries--;
    setTimeout(() => {
      lazilyPollForAuth(tries);
    }, lazy_poll_millis);
  }
}

async function getUserRegistrationInfo() {
  const token = getAuthCallbackState(false) || getItem("jwt");
  // fetch the user
  let resp = await softwareGet("/users/plugin/state", {}, token);
  let user = isResponseOk(resp) && resp.data ? resp.data.user : null;

  // only update if its a registered, not anon user
  if (user && user.registered === 1) {
    await authenticationCompleteHandler(user);
    return true;
  }
  return false;
}

export async function authenticationCompleteHandler(user) {
  // clear the auth callback state
  setAuthCallbackState(null);

  // set the email and jwt
  if (user?.registered === 1) {
    currentUser = user;

    if (!getItem("name")) {
      if (user.plugin_jwt) {
        setItem("jwt", user.plugin_jwt);
      }
      setItem("name", user.email);
      // update the login status
      window.showInformationMessage(`Successfully registered`);

      try {
        initializeWebsockets();
      } catch (e) {
        console.error("Failed to initialize websockets", e);
      }
    }

    // this will refresh the playlist for both slack and spotify
    processNewSpotifyIntegration(false, false);

    // refresh the tree view
    setTimeout(() => {
      // refresh the playlist to show the device button update
      commands.executeCommand("musictime.refreshMusicTimeView");
    }, 1000);
  }

  // initiate the playlist build
  setTimeout(() => {
    commands.executeCommand("musictime.refreshMusicTimeView");
  }, 1000);
}

export async function processNewSpotifyIntegration(showSuccess = true, refreshPlaylist = true) {
  setItem("requiresSpotifyReAuth", false);

  if (showSuccess) {
    // update the login status
    window.showInformationMessage(`Successfully connected to Spotify. Loading playlists...`);
  }


  // initialize spotify and playlists
  await initializeSpotify();

  if (refreshPlaylist) {
    // initiate the playlist build
    setTimeout(() => {
      commands.executeCommand("musictime.refreshMusicTimeView");
    }, 2000);
  }
}

export async function getCachedSlackIntegrations() {
  if (!currentUser) {
    currentUser = await getUser(getItem("jwt"));
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
      const aDate = new Date(a.updatedAt).getTime();
      const bDate = new Date(b.updatedAt).getTime();
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
