import { commands, window } from "vscode";
import { api_endpoint, launch_url } from "../Constants";
import { isResponseOk, softwareGet } from "../HttpClient";
import { showQuickPick } from "../MenuManager";
import { launchWebUrl, getPluginType, getVersion, getPluginId } from "../Util";
import { initializeWebsockets } from '../websockets';
import { getAuthCallbackState, getItem, getPluginUuid, setAuthCallbackState, setItem } from "./FileManager";

const queryString = require("query-string");

export async function getUser(jwt) {
  if (jwt) {
    let api = `/users/me`;
    let resp = await softwareGet(api, jwt);
    if (isResponseOk(resp)) {
      if (resp && resp.data && resp.data.data) {
        const user = resp.data.data;
        return user;
      }
    }
  }
  return null;
}

export function showLogInMenuOptions() {
  showAuthMenuOptions("Log in", false /*isSignup*/);
}

export function showSignUpMenuOptions() {
  showAuthMenuOptions("Sign in", true /*isSignup*/);
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
    plugin: getPluginType(),
    pluginVersion: getVersion(),
    plugin_id: getPluginId(),
    pluigin_uuid: getPluginUuid(),
    auth_callback_state,
    login: true,
  };

  if (!name) {
    obj["plugin_token"] = jwt;
  }

  if (loginType === "github") {
    // github signup/login flow
    obj["redirect"] = launch_url;
    url = `${api_endpoint}/auth/github`;
  } else if (loginType === "google") {
    // google signup/login flow
    obj["redirect"] = launch_url;
    url = `${api_endpoint}/auth/google`;
  } else {
    // email login
    obj["token"] = getItem("jwt");
    obj["auth"] = "software";
    if (switching_account) {
      obj["login"] = true;
      url = `${launch_url}/onboarding`;
    } else {
      url = `${launch_url}/email-signup`;
    }
  }

  const qryStr = queryString.stringify(obj);

  url = `${url}?${qryStr}`;

  launchWebUrl(url);
}

export function authenticationCompleteHandler(user) {
  // clear the auth callback state
  setAuthCallbackState(null);

  // set the email and jwt
  if (user?.registered === 1) {
    if (user.plugin_jwt) {
      setItem("jwt", user.plugin_jwt);
    }
    setItem("name", user.email);
  }

  try {
    initializeWebsockets();
  } catch (e) {
    console.error("Failed to initialize codetime websockets", e);
  }

  // update the login status
  window.showInformationMessage(`Successfully registered.`);

  // initiate the playlist build
  setTimeout(() => {
    commands.executeCommand("musictime.hardRefreshPlaylist");
  }, 1000);
}
