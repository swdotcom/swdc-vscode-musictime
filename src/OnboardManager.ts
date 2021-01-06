import { window, ExtensionContext } from "vscode";
import {
  serverIsAvailable
} from "./DataController";
import {
  showOfflinePrompt,
  getItem,
  getOsUsername,
  getHostname,
  setItem,
  getPluginUuid,
  getAuthCallbackState,
  setAuthCallbackState
} from "./Util";
import { softwarePost, isResponseOk } from "./HttpClient";

let retry_counter = 0;
const one_min_millis = 1000 * 60;

export async function onboardPlugin(ctx: ExtensionContext, callback: any) {
  let jwt = getItem("jwt");

    const windowState = window.state;

    if (jwt) {
        // we have the jwt, call the callback that anon was not created
        return callback(ctx);
    }

    if (windowState.focused) {
        // perform primary window related work
        primaryWindowOnboarding(ctx, callback);
    } else {
        // call the secondary onboarding logic
        secondaryWindowOnboarding(ctx, callback);
    }
}

async function primaryWindowOnboarding(ctx: ExtensionContext, callback: any) {
  let serverIsOnline = await serverIsAvailable();
  if (serverIsOnline) {
      // great, it's online, create the anon user
      const jwt = await createAnonymousUser();
      if (jwt) {
          // great, it worked. call the callback
          return callback(ctx);
      }
      // else its some kind of server issue, try again in a minute
      serverIsOnline = false;
  }

  if (!serverIsOnline) {
      // not online, try again in a minute
      if (retry_counter === 0) {
          // show the prompt that we're unable connect to our app 1 time only
          showOfflinePrompt(true);
      }
      // call activate again later
      setTimeout(() => {
          retry_counter++;
          onboardPlugin(ctx, callback);
      }, one_min_millis * 2);
  }
}

/**
* This is called if there's no JWT. If it reaches a
* 6th call it will create an anon user.
* @param ctx
* @param callback
*/
async function secondaryWindowOnboarding(ctx: ExtensionContext, callback: any) {
  const serverIsOnline = await serverIsAvailable();
  if (!serverIsOnline) {
      // not online, try again later
      setTimeout(() => {
        onboardPlugin(ctx, callback);
      }, one_min_millis);
      return;
  } else if (retry_counter < 5) {
      if (serverIsOnline) {
          retry_counter++;
      }
      // call activate again in about 15 seconds
      setTimeout(() => {
        onboardPlugin(ctx, callback);
      }, 1000 * 15);
      return;
  }

  // tried enough times, create an anon user
  await createAnonymousUser();
  // call the callback
  return callback(ctx);
}

/**
 * create an anonymous user based on github email or mac addr
 */
export async function createAnonymousUser(): Promise<string> {
  const jwt = getItem("jwt");
  // check one more time before creating the anon user
  if (!jwt) {
      // this should not be undefined if its an account reset
      let plugin_uuid = getPluginUuid();
      let auth_callback_state = getAuthCallbackState();

      const username = await getOsUsername();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const hostname = await getHostname();

      const resp = await softwarePost(
          "/plugins/onboard",
          {
              timezone,
              username,
              plugin_uuid,
              hostname,
              auth_callback_state
          }
      );
      if (isResponseOk(resp) && resp.data && resp.data.jwt) {
          setItem("jwt", resp.data.jwt);
          if (!resp.data.user.registered) {
              setItem("name", null);
          }
          setAuthCallbackState(null);
          return resp.data.jwt;
      }
  }

  return null;
}
