import { workspace, window, commands } from "vscode";
import { softwareGet, isResponseOk } from "./HttpClient";
import {
    getItem,
    setItem,
    setAuthCallbackState,
    getAuthCallbackState,
    getIntegrations,
    syncIntegrations,
} from "./Util";
import {
    getSpotifyLikedSongs,
    PlayerName,
    getPlaylists,
    getSpotifyDevices,
    PlayerContext,
    getSpotifyPlayerContext,
    getUserProfile,
    PlayerDevice
} from "cody-music";
import { MusicManager } from "./music/MusicManager";
import { MusicDataManager } from "./music/MusicDataManager";
import { MusicCommandUtil } from "./music/MusicCommandUtil";
import { MusicCommandManager } from "./music/MusicCommandManager";
import { MusicStateManager } from "./music/MusicStateManager";
import { requiresSpotifyAccess } from "./music/MusicUtil";
const { WebClient } = require("@slack/web-api");

const moment = require("moment-timezone");

let loggedInCacheState = null;
let toggleFileEventLogging = null;

let spotifyFetchTimeout = null;
let currentDayHour = null;

export function isNewHour() {
    const dayHr = moment().format("YYYY-MM-DD-HH");

    if (!currentDayHour || dayHr !== currentDayHour) {
        currentDayHour = dayHr;
        return true;
    }

    return false;
}

export function getLoggedInCacheState() {
    return loggedInCacheState;
}

export function getToggleFileEventLoggingState() {
    if (toggleFileEventLogging === null) {
        toggleFileEventLogging = workspace
            .getConfiguration()
            .get("toggleFileEventLogging");
    }
    return toggleFileEventLogging;
}

export async function serverIsAvailable() {
    let serverAvailable = await softwareGet("/ping", null)
        .then((result) => {
            return isResponseOk(result);
        })
        .catch((e) => {
            return false;
        });
    return serverAvailable;
}

export async function getSlackOauth(user = null) {
    let foundNewIntegration = false;
    const currentIntegrations = getIntegrations();
    user = !user ? await getUser(getItem("jwt")) : user;
    if (user?.integrations?.length) {
      // find the slack auth
      for (const integration of user.integrations) {
        // {access_token, name, plugin_uuid, scopes, pluginId, authId, refresh_token, scopes}
        if (integration.name.toLowerCase() === "slack") {
          // check if it exists
          const foundIntegration = currentIntegrations.find((n) => n.authId === integration.authId);
          if (!foundIntegration) {
            // get the workspace domain using the authId
            const web = new WebClient(integration.access_token);
            const usersIdentify = await web.users.identity((e) => {
              console.log("error fetching slack team info: ", e.message);
              return null;
            });
            // usersIdentity returns
            // {team: {id, name, domain, image_102, image_132, ....}...}
            // set the domain
            integration["team_domain"] = usersIdentify?.team?.domain;
            integration["team_name"] = usersIdentify?.team?.name;
            // add it
            currentIntegrations.push(integration);
  
            foundNewIntegration = true;
          }
        }
      }
    }
    // update the integrations if we found any new ones
    syncIntegrations(currentIntegrations);

    return foundNewIntegration;
}

export async function getMusicTimeUserStatus() {
    // We don't have a user yet, check the users via the plugin/state
    const jwt = getItem("jwt");
    const auth_callback_state = getAuthCallbackState();
    const token = (auth_callback_state) ? auth_callback_state : jwt;

    if (token) {
        const api = "/users/plugin/state";
        const resp = await softwareGet(api, token);
        if (isResponseOk(resp) && resp.data) {
            // NOT_FOUND, ANONYMOUS, OK, UNKNOWN
            const state = resp.data.state ? resp.data.state : "UNKNOWN";
            if (state === "OK") {
                // clear the auth callback state
                setItem("switching_account", false);
                setAuthCallbackState(null);

                /**
                 * stateData only contains:
                 * {email, jwt, state}
                 */
                const stateData = resp.data;
                if (stateData.email) {
                    setItem("name", stateData.email);
                }
                // check the jwt
                if (stateData.jwt) {
                    // update it
                    setItem("jwt", stateData.jwt);
                }

                // get the user from the payload
                const user = resp.data.user;
                let foundSpotifyAuth = false;

                const musicMgr: MusicManager = MusicManager.getInstance();

                // add any new slack integrations
                await getSlackOauth(user);

                if (user.auths && user.auths.length > 0) {
                    for (let i = 0; i < user.auths.length; i++) {
                        const auth = user.auths[i];

                        // update the spotify access info if the auth matches
                        if (auth.type === "spotify" && auth.access_token) {
                            foundSpotifyAuth = true;
                            // update spotify access info
                            await musicMgr.updateSpotifyAccessInfo(auth);
                        }
                    }
                }

                return { loggedOn: foundSpotifyAuth, state };
            }
            // return the state that is returned
            return { loggedOn: false, state };
        }
    }
    return { loggedOn: false, state: "UNKNOWN" };
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

export async function refetchSlackConnectStatusLazily(tryCountUntilFoundUser = 40) {
  const slackAuth = await getSlackOauth();
  if (!slackAuth) {
    // try again if the count is not zero
    if (tryCountUntilFoundUser > 0) {
      tryCountUntilFoundUser -= 1;
      setTimeout(() => {
        refetchSlackConnectStatusLazily(tryCountUntilFoundUser);
      }, 10000);
    } else {
      // clear the auth callback state
      setAuthCallbackState(null);
    }
  } else {
    // clear the auth callback state
    setAuthCallbackState(null);
    window.showInformationMessage("Successfully connected to Slack");

    // commands.executeCommand("codetime.refreshFlowTree");

    setTimeout(() => {
      // commands.executeCommand("codetime.refreshCodetimeMenuTree");
    }, 1000);
  }
}

export function refetchSpotifyConnectStatusLazily(tryCountUntilFound = 40) {
    if (spotifyFetchTimeout) {
        return;
    }
    spotifyFetchTimeout = setTimeout(() => {
        spotifyFetchTimeout = null;
        spotifyConnectStatusHandler(tryCountUntilFound);
    }, 10000);
}

async function spotifyConnectStatusHandler(tryCountUntilFound) {
    let oauthResult = await getMusicTimeUserStatus();
    if (!oauthResult.loggedOn) {
        // try again if the count is not zero
        if (tryCountUntilFound > 0) {
            tryCountUntilFound -= 1;
            refetchSpotifyConnectStatusLazily(tryCountUntilFound);
        } else {
            // clear the auth callback state
            setItem("switching_account", false);
            setAuthCallbackState(null);
        }
    } else {
        // clear the auth callback state
        setItem("switching_account", false);
        setAuthCallbackState(null);

        setItem("requiresSpotifyReAuth", false);

        // update the login status
        // await getUserStatus(serverIsOnline, true /*ignoreCache*/);
        window.showInformationMessage(
            `Successfully connected to Spotify. Loading playlists...`
        );
        // first get the spotify user
        await populateSpotifyUser();

        // only add the "Liked Songs" playlist if there are tracks found in that playlist
        await populateLikedSongs();

        // initiate the playlist build
        setTimeout(() => {
            commands.executeCommand("musictime.hardRefreshPlaylist");
        }, 2000);
    }
}

export async function populateSpotifyUser() {
    const dataMgr: MusicDataManager = MusicDataManager.getInstance();
    if (
        !requiresSpotifyAccess() &&
        (!dataMgr.spotifyUser || !dataMgr.spotifyUser.id)
    ) {
        // get the user
        dataMgr.spotifyUser = await getUserProfile();
        await MusicCommandUtil.getInstance().checkIfAccessExpired(
            dataMgr.spotifyUser
        );
    }
}

export async function populateLikedSongs() {
    MusicDataManager.getInstance().spotifyLikedSongs = await getSpotifyLikedSongs();
}

export async function populatePlayerContext() {
    const spotifyContext: PlayerContext = await getSpotifyPlayerContext();
    MusicDataManager.getInstance().spotifyContext = spotifyContext;
    MusicCommandManager.syncControls(
        MusicDataManager.getInstance().runningTrack,
        false
    );
}

export async function populateSpotifyPlaylists() {
    const dataMgr: MusicDataManager = MusicDataManager.getInstance();

    // reconcile playlists
    dataMgr.reconcilePlaylists();

    // clear out the raw and orig playlists
    dataMgr.origRawPlaylistOrder = [];
    dataMgr.rawPlaylists = [];

    // fetch music time app saved playlists
    await dataMgr.fetchSavedPlaylists();

    // fetch the playlists from spotify
    const rawPlaylists = await MusicCommandUtil.getInstance().runSpotifyCommand(
        getPlaylists,
        [
            PlayerName.SpotifyWeb,
            {
                all: true,
            },
        ]
    );

    // set the list of playlistIds based on this current order
    if (rawPlaylists && rawPlaylists.status && rawPlaylists.status >= 400) {
        // try again in a few seconds
        setTimeout(() => {
            populateSpotifyPlaylists();
        }, 3000);
    } else {
        dataMgr.origRawPlaylistOrder = [...rawPlaylists];
        dataMgr.rawPlaylists = rawPlaylists;
    }

    // populate generated playlists
    await dataMgr.populateGeneratedPlaylists();

    // populate player context
    await populatePlayerContext();
}

export async function populateSpotifyDevices(isDeviceLaunch = false) {
    const devices = await MusicCommandUtil.getInstance().runSpotifyCommand(
        getSpotifyDevices
    );

    if (devices.status && devices.status === 429 && !isDeviceLaunch) {
        // try one more time in lazily since its not a device launch request.
        // the device launch requests retries a few times every couple seconds.
        setTimeout(() => {
            // use true to specify its a device launch so this doens't try continuously
            populateSpotifyDevices(true);
        }, 8000);
        return;
    }

    const currDevices = MusicDataManager.getInstance().currentDevices;

    const fetchedDeviceIds = [];
    if (devices.length) {
        devices.forEach((el: PlayerDevice) => {
            fetchedDeviceIds.push(el.id);
        });
    }

    let diffDevices = [];
    if (currDevices.length) {
        // get any differences from the fetched devices if any
        diffDevices = currDevices.filter((n: PlayerDevice) => !fetchedDeviceIds.includes(n.id));
    } else if (fetchedDeviceIds.length) {
        // no current devices, set diff to whatever we fetched
        diffDevices = [
            ...devices
        ]
    }

    if (diffDevices.length || currDevices.length !== diffDevices.length) {
        // new devices available or setting to empty
        MusicDataManager.getInstance().currentDevices = devices;

        setTimeout(() => {
            // refresh the playlist to show the device button update
            commands.executeCommand("musictime.refreshPlaylist");
        }, 1000);

        setTimeout(() => {
            MusicStateManager.getInstance().fetchTrack();
        }, 3000);
    }
}
