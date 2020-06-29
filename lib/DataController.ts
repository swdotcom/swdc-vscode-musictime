import { workspace, window, commands } from "vscode";
import { softwareGet, isResponseOk, softwarePost } from "./HttpClient";
import {
    getItem,
    setItem,
    nowInSecs,
    getSessionFileCreateTime,
    getOs,
    getVersion,
    getHostname,
    getEditorSessionToken,
    logIt,
    getPluginId,
    getOffsetSeconds,
} from "./Util";
import {
    getSpotifyLikedSongs,
    PlayerName,
    getPlaylists,
    getSpotifyDevices,
    PlayerContext,
    getSpotifyPlayerContext,
    getUserProfile,
} from "cody-music";
import { MusicManager } from "./music/MusicManager";
import { MusicDataManager } from "./music/MusicDataManager";
import { MusicCommandUtil } from "./music/MusicCommandUtil";
import { MusicCommandManager } from "./music/MusicCommandManager";
import { MusicStateManager } from "./music/MusicStateManager";
import { requiresSpotifyAccess } from "./music/MusicUtil";

const moment = require("moment-timezone");


let loggedInCacheState = null;
let toggleFileEventLogging = null;

let slackFetchTimeout = null;
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

export async function sendBatchPayload(batch) {
    await softwarePost("/data/batch", batch, getItem("jwt")).catch((e) => {
        logIt(`Unable to send plugin data batch, error: ${e.message}`);
    });
}

/**
 * send any music tracks
 */
export async function sendMusicData(trackData) {
    if (trackData.available_markets) {
        delete trackData.available_markets;
    }
    if (trackData.images) {
        delete trackData.images;
    }
    if (trackData.external_urls) {
        delete trackData.external_urls;
    }
    if (trackData.href) {
        delete trackData.href;
    }

    logIt(
        `sending song session {song: ${trackData.name}, start: ${trackData.start}, end: ${trackData.end}}`
    );

    // add the "local_start", "start", and "end"
    // POST the kpm to the PluginManager
    sendSessionPayload(trackData);
}

/**
 * get the app jwt
 */
export async function getAppJwt() {
    // get the app jwt
    let resp = await softwareGet(`/data/apptoken?token=${nowInSecs()}`, null);
    if (isResponseOk(resp)) {
        return resp.data.jwt;
    }

    return null;
}

export async function getSlackOauth() {
    let jwt = getItem("jwt");
    if (jwt) {
        let user = await getUser(jwt);
        if (user && user.auths) {
            // get the one that is "slack"
            for (let i = 0; i < user.auths.length; i++) {
                if (user.auths[i].type === "slack") {
                    await MusicManager.getInstance().updateSlackAccessInfo(
                        user.auths[i]
                    );
                    return user.auths[i];
                }
            }
        }
    }
}

export async function getMusicTimeUserStatus() {
    // We don't have a user yet, check the users via the plugin/state
    const jwt = getItem("jwt");
    const spotify_refresh_token = getItem("spotify_refresh_token");

    if (jwt) {
        const api = "/users/plugin/state";
        const resp = await softwareGet(api, jwt);
        if (isResponseOk(resp) && resp.data) {
            // NOT_FOUND, ANONYMOUS, OK, UNKNOWN
            const state = resp.data.state ? resp.data.state : "UNKNOWN";
            if (state === "OK") {
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

                if (user.auths && user.auths.length > 0) {
                    for (let i = 0; i < user.auths.length; i++) {
                        const auth = user.auths[i];

                        // update the spotify access info if the auth matches
                        if (auth.type === "spotify" && auth.access_token) {
                            foundSpotifyAuth = true;
                            // update spotify access info
                            await musicMgr.updateSpotifyAccessInfo(auth);
                        } else if (user.auths[i].type === "slack") {
                            // update slack connection
                            await musicMgr.updateSlackAccessInfo(auth);
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

export function refetchSlackConnectStatusLazily(tryCountUntilFound = 40) {
    if (slackFetchTimeout) {
        return;
    }
    slackFetchTimeout = setTimeout(() => {
        slackFetchTimeout = null;
        slackConnectStatusHandler(tryCountUntilFound);
    }, 10000);
}

async function slackConnectStatusHandler(tryCountUntilFound) {
    let oauth = await getSlackOauth();
    if (!oauth) {
        // try again if the count is not zero
        if (tryCountUntilFound > 0) {
            tryCountUntilFound -= 1;
            refetchSlackConnectStatusLazily(tryCountUntilFound);
        }
    } else {
        window.showInformationMessage(`Successfully connected to Slack`);
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
        }
    } else {
        const dataMgr = MusicDataManager.getInstance();

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

        // --async-- send the top spotify songs from the users playlists to help seed song sessions
        seedLikedSongSessions();

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

    MusicDataManager.getInstance().currentDevices = devices;

    // gather music to start things off
    setTimeout(() => {
        MusicStateManager.getInstance().gatherMusicInfoRequest();
        // refresh the playlist to show the device button update
        commands.executeCommand("musictime.refreshPlaylist");
    }, 1000);
}

export function getBootstrapFileMetrics() {
    const fileMetrics = {
        add: 0,
        paste: 0,
        delete: 0,
        netkeys: 0,
        linesAdded: 0,
        linesRemoved: 0,
        open: 0,
        close: 0,
        keystrokes: 0,
        syntax: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offset: getOffsetSeconds() / 60,
        pluginId: getPluginId(),
        os: getOs(),
        version: getVersion(),
        source: [],
        repoFileCount: 0,
        repoContributorCount: 0,
    };
    return fileMetrics;
}

async function seedLikedSongSessions() {
    const pluginInfo = {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offset_minutes: getOffsetSeconds() / 60,
        pluginId: getPluginId(),
        os: getOs(),
        version: getVersion(),
    };

    const api = `/music/onboard`;
    softwarePost(api, pluginInfo, getItem("jwt"));
}

export async function sendSessionPayload(songSession) {
    let api = `/music/session`;
    return softwarePost(api, songSession, getItem("jwt"))
        .then((resp) => {
            if (!isResponseOk(resp)) {
                return { status: "fail" };
            }
            return { status: "ok" };
        })
        .catch((e) => {
            return { status: "fail" };
        });
}

export async function sendHeartbeat(reason, serverIsOnline) {
    const jwt = getItem("jwt");
    const hostname = await getHostname();
    if (serverIsOnline && jwt) {
        let heartbeat = {
            pluginId: getPluginId(),
            os: getOs(),
            start: nowInSecs(),
            version: getVersion(),
            hostname,
            session_ctime: getSessionFileCreateTime(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            trigger_annotation: reason,
            editor_token: getEditorSessionToken(),
        };
        let api = `/data/heartbeat`;
        softwarePost(api, heartbeat, jwt).then(async (resp) => {
            if (!isResponseOk(resp)) {
                logIt("unable to send heartbeat ping");
            }
        });
    }
}
