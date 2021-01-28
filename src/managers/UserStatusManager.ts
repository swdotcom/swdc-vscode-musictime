import { commands, window } from "vscode";
import { api_endpoint, launch_url } from "../Constants";
import { isResponseOk, softwareGet } from "../HttpClient";
import { showQuickPick } from "../MenuManager";
import { launchWebUrl, getPluginType, getVersion, getPluginId } from "../Util";
import { getAuthCallbackState, getItem, getPluginUuid, setAuthCallbackState, setItem } from "./FileManager";

const queryString = require("query-string");

export async function getUserRegistrationState(overriding_token: string = null) {
  const auth_callback_state = getAuthCallbackState(false /*autoCreate*/);

  const token = auth_callback_state ?? overriding_token;

  if (token) {
    const api = "/users/plugin/state";
    const resp = await softwareGet(api, token);
    if (isResponseOk(resp) && resp.data) {
      // NOT_FOUND, ANONYMOUS, OK, UNKNOWN
      const state = resp.data.state ? resp.data.state : "UNKNOWN";
      if (state === "OK") {
        const user = resp.data.user;
        // clear the auth callback state
        setAuthCallbackState(null);

        return { connected: true, state, user };
      }
    }
  }
  return { connected: false, state: "UNKNOWN", user: null };
}

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

  const auth_callback_state = getAuthCallbackState(true);

  let url = "";

  let obj = {
    plugin: getPluginType(),
    plugin_uuid: getPluginUuid(),
    pluginVersion: getVersion(),
    plugin_id: getPluginId(),
    auth_callback_state,
    login: true,
  };

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
  
  // use the defaults
  setTimeout(() => {
    refetchUserStatusLazily(40);
  }, 10000);
}

async function refetchUserStatusLazily(tryCountUntilFound) {
  let registrationState = await getUserRegistrationState();
  if (!registrationState.connected) {
    // try again if the count is not zero
    if (tryCountUntilFound > 0) {
      tryCountUntilFound -= 1;
      refetchUserStatusLazily(tryCountUntilFound);
    } else {
      // clear the auth callback state
      setAuthCallbackState(null);
    }
  } else {
    // clear the auth callback state
    setAuthCallbackState(null);

    // set the email and jwt
    updateUserInfoIfRegistered(registrationState.user);

    // update the login status
    window.showInformationMessage(`Successfully registered.`);

    // initiate the playlist build
    setTimeout(() => {
      commands.executeCommand("musictime.hardRefreshPlaylist");
    }, 1000);
  }
}

export function updateUserInfoIfRegistered(user) {
  // set the email and jwt
  if (user?.registered === 1) {
    if (user.plugin_jwt) {
      setItem("jwt", user.plugin_jwt);
    }
    setItem("name", user.email);
  }
}
