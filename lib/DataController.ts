import { workspace, window, commands } from "vscode";
import {
    softwareGet,
    softwarePut,
    isResponseOk,
    softwarePost
} from "./HttpClient";
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
    getOffsetSecends,
    storeMusicSessionPayload
} from "./Util";
import { getSpotifyLikedSongs, Track } from "cody-music";
import { MusicManager } from "./music/MusicManager";
const moment = require("moment-timezone");

let loggedInCacheState = null;
let serverAvailable = true;
let serverAvailableLastCheck = 0;
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
    let nowSec = nowInSecs();
    let diff = nowSec - serverAvailableLastCheck;
    if (serverAvailableLastCheck === 0 || diff > 60) {
        serverAvailableLastCheck = nowInSecs();
        serverAvailable = await softwareGet("/ping", null)
            .then(result => {
                return isResponseOk(result);
            })
            .catch(e => {
                return false;
            });
    }
    return serverAvailable;
}

export async function sendBatchPayload(batch) {
    await softwarePost("/data/batch", batch, getItem("jwt")).catch(e => {
        logIt(`Unable to send plugin data batch, error: ${e.message}`);
    });
}

/**
 * send any music tracks
 */
export async function sendMusicData(trackData) {
    const serverIsOnline = await serverIsAvailable();

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

    if (serverIsOnline) {
        // logIt(`sending ${JSON.stringify(trackData)}`);
        logIt(
            `Sending Track: ${trackData.name}:${
                trackData.artist
            }, Keystrokes: ${trackData.keystrokes}, Start: ${moment
                .unix(trackData.start)
                .format()}, End: ${moment.unix(trackData.end).format()}`
        );

        // add the "local_start", "start", and "end"
        // POST the kpm to the PluginManager
        let api = `/music/session`;
        return softwarePost(api, trackData, getItem("jwt"))
            .then(resp => {
                if (!isResponseOk(resp)) {
                    return { status: "fail" };
                }
                return { status: "ok" };
            })
            .catch(e => {
                return { status: "fail" };
            });
    } else {
        // store it
        storeMusicSessionPayload(trackData);
    }
}

/**
 * get the app jwt
 */
export async function getAppJwt(serverIsOnline) {
    if (serverIsOnline) {
        // get the app jwt
        let resp = await softwareGet(
            `/data/apptoken?token=${nowInSecs()}`,
            null
        );
        if (isResponseOk(resp)) {
            return resp.data.jwt;
        }
    }
    return null;
}

export async function getSlackOauth(serverIsOnline) {
    let jwt = getItem("jwt");
    if (serverIsOnline && jwt) {
        let user = await getUser(serverIsOnline, jwt);
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

export async function getMusicTimeUserStatus(serverIsOnline) {
    // We don't have a user yet, check the users via the plugin/state
    const jwt = getItem("jwt");
    const spotify_refresh_token = getItem("spotify_refresh_token");
    if (serverIsOnline && (jwt || spotify_refresh_token)) {
        const api = "/users/plugin/state";
        const additionalHeaders = spotify_refresh_token
            ? { spotify_refresh_token }
            : null;
        const resp = await softwareGet(api, jwt, additionalHeaders);
        if (isResponseOk(resp) && resp.data) {
            // NOT_FOUND, ANONYMOUS, OK, UNKNOWN
            const state = resp.data.state ? resp.data.state : "UNKNOWN";
            if (state === "OK") {
                /**
                 * stateData only contains:
                 * {email, jwt, state}
                 */
                const stateData = resp.data;
                const sessionEmail = getItem("name");
                if (sessionEmail !== stateData.email) {
                    setItem("name", stateData.email);
                }
                // check the jwt
                if (stateData.jwt && stateData.jwt !== jwt) {
                    // update it
                    setItem("jwt", stateData.jwt);
                }

                // get the user from the payload
                const user = resp.data.user;
                let foundSpotifyAuth = false;

                if (user.auths && user.auths.length > 0) {
                    for (let i = 0; i < user.auths.length; i++) {
                        const auth = user.auths[i];

                        // update the spotify access info if the auth matches
                        if (auth.type === "spotify" && auth.access_token) {
                            foundSpotifyAuth = true;
                            // update spotify access info
                            await MusicManager.getInstance().updateSpotifyAccessInfo(
                                auth
                            );
                            break;
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

export async function getUser(serverIsOnline, jwt) {
    if (jwt && serverIsOnline) {
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
    let serverIsOnline = await serverIsAvailable();
    let oauth = await getSlackOauth(serverIsOnline);
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
    let serverIsOnline = await serverIsAvailable();
    let oauthResult = await getMusicTimeUserStatus(serverIsOnline);
    if (!oauthResult.loggedOn) {
        // try again if the count is not zero
        if (tryCountUntilFound > 0) {
            tryCountUntilFound -= 1;
            refetchSpotifyConnectStatusLazily(tryCountUntilFound);
        }
    } else {
        const musicMgr = MusicManager.getInstance();

        // update the login status
        // await getUserStatus(serverIsOnline, true /*ignoreCache*/);
        window.showInformationMessage(
            `Successfully connected to Spotify. Loading playlists...`
        );

        const likedSongs: Track[] = await getSpotifyLikedSongs();
        if (likedSongs) {
            likedSongs.forEach((track: Track) => {
                track["playlistId"] = "Liked Songs";
                track.loved = true;
                // set a convenience "spotifyTrackId" attribute based on the URI
                if (track.uri) {
                    track["spotifyTrackId"] = track.uri;
                    // make sure the trackId is the URI if it's a spotify track
                    track.id = track.uri;
                }
            });
        }
        musicMgr.spotifyLikedSongs = likedSongs;

        // send the top spotify songs from the users playlists to help seed song sessions
        seedLikedSongSessions(likedSongs);

        setTimeout(() => {
            musicMgr.clearSpotify();
            commands.executeCommand("musictime.refreshPlaylist");
        }, 1000);
    }
}

async function seedLikedSongSessions(likedSongs) {
    /**
     * album:Object {album_type: "ALBUM", artists: Array(1), available_markets: Array(79), …}
    artists:Array(1) [Object]
    available_markets:Array(79) ["AD", "AE", "AR", …]
    disc_number:1
    duration_ms:251488
    explicit:false
    external_ids:Object {isrc: "GBF088590110"}
    external_urls:Object {spotify: "https://open.spotify.com/track/4RvWPyQ5RL0ao9LPZeS…"}
    href:"https://api.spotify.com/v1/tracks/4RvWPyQ5RL0ao9LPZeSouE"

     */
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
        offset: getOffsetSecends() / 60,
        pluginId: getPluginId(),
        os: getOs(),
        version: getVersion(),
        source: [],
        repoFileCount: 0,
        repoContributorCount: 0
    };
    if (likedSongs && likedSongs.length > 0) {
        let batch = [];
        // send 20 at a time
        for (let i = 0; i < likedSongs.length; i++) {
            const track = likedSongs[i];
            track["liked"] = true;
            if (!track.playlistId) {
                track["playlistId"] = "Liked Songs";
            }
            // add the empty file metrics
            const songSession = {
                ...track,
                ...fileMetrics
            };
            batch.push(songSession);
            if (i > 0 && i % 20 === 0) {
                await sendBatchedLikedSongSessions(batch);
                batch = [];
            }
        }

        // send the remaining
        if (batch.length > 0) {
            await sendBatchedLikedSongSessions(batch);
        }
    }
}

function sendBatchedLikedSongSessions(tracksToSave) {
    const api = `/music/session/seed`;
    softwarePut(api, { tracks: tracksToSave }, getItem("jwt"))
        .then(resp => {
            if (!isResponseOk(resp)) {
                return { status: "fail" };
            }
            return { status: "ok" };
        })
        .catch(e => {
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
            editor_token: getEditorSessionToken()
        };
        let api = `/data/heartbeat`;
        softwarePost(api, heartbeat, jwt).then(async resp => {
            if (!isResponseOk(resp)) {
                logIt("unable to send heartbeat ping");
            }
        });
    }
}
