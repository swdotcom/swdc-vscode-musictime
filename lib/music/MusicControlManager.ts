import {
    PlayerType,
    play,
    pause,
    previous,
    next,
    PlayerName,
    Track,
    PlaylistItem,
    playTrackInContext,
    playTrack,
    saveToSpotifyLiked,
    addTracksToPlaylist,
    removeFromSpotifyLiked,
    setItunesLoved,
    repeatOn,
    repeatOff,
    PlayerDevice,
    playSpotifyMacDesktopTrack,
    playSpotifyTrack,
    playSpotifyPlaylist,
    TrackStatus
} from "cody-music";
import { window, ViewColumn, Uri, commands } from "vscode";
import { MusicCommandManager } from "./MusicCommandManager";
import { showQuickPick } from "../MenuManager";
import {
    serverIsAvailable,
    refetchSpotifyConnectStatusLazily,
    getAppJwt,
    populateLikedSongs,
    populateSpotifyPlaylists,
    populatePlayerContext
} from "../DataController";
import {
    getItem,
    getMusicTimeFile,
    isLinux,
    logIt,
    launchWebUrl,
    createSpotifyIdFromUri,
    createUriFromTrackId,
    getMusicTimeMarkdownFile,
    getSoftwareDir,
    setItem,
    isMac,
    getCodyErrorMessage,
    isWindows
} from "../Util";
import { softwareGet, softwarePut, isResponseOk } from "../HttpClient";
import {
    api_endpoint,
    REFRESH_CUSTOM_PLAYLIST_TITLE,
    GENERATE_CUSTOM_PLAYLIST_TITLE,
    REFRESH_CUSTOM_PLAYLIST_TOOLTIP,
    GENERATE_CUSTOM_PLAYLIST_TOOLTIP,
    SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
    PERSONAL_TOP_SONGS_PLID,
    YES_LABEL,
    OK_LABEL
} from "../Constants";
import { MusicStateManager } from "./MusicStateManager";
import { SocialShareManager } from "../social/SocialShareManager";
import { tmpdir } from "os";
import { connectSlack } from "../slack/SlackControlManager";
import { MusicManager } from "./MusicManager";
import { MusicPlaylistManager } from "./MusicPlaylistManager";
import {
    sortPlaylists,
    requiresSpotifyAccess,
    getDeviceSet,
    getDeviceId
} from "./MusicUtil";
import { MusicDataManager } from "./MusicDataManager";
import { MusicCommandUtil } from "./MusicCommandUtil";

const moment = require("moment-timezone");
const clipboardy = require("clipboardy");
const fs = require("fs");
const dataMgr: MusicDataManager = MusicDataManager.getInstance();

const NO_DATA = "MUSIC TIME\n\nNo data available\n";

let lastDayOfMonth = -1;
let fetchingMusicTimeMetrics = false;

export class MusicControlManager {
    private musicStateMgr: MusicStateManager = MusicStateManager.getInstance();

    private currentTrackToAdd: PlaylistItem = null;

    private static instance: MusicControlManager;
    private musicCmdUtil: MusicCommandUtil = MusicCommandUtil.getInstance();

    private constructor() {
        //
    }

    static getInstance(): MusicControlManager {
        if (!MusicControlManager.instance) {
            MusicControlManager.instance = new MusicControlManager();
        }

        return MusicControlManager.instance;
    }

    isLikedSongPlaylist() {
        return dataMgr.selectedPlaylist &&
            dataMgr.selectedPlaylist.id == SPOTIFY_LIKED_SONGS_PLAYLIST_NAME
            ? true
            : false;
    }

    async nextSong() {
        const hasSpotifyPlaybackAccess = MusicManager.getInstance().hasSpotifyPlaybackAccess();

        if (hasSpotifyPlaybackAccess) {
            if (this.isLikedSongPlaylist()) {
                await MusicManager.getInstance().playNextLikedSong();
            } else {
                const playerName = MusicManager.getInstance().getPlayerNameForPlayback();
                await next(playerName);
            }
        } else {
            if (this.isLikedSongPlaylist()) {
                await MusicManager.getInstance().playNextLikedSong();
            } else {
                next(PlayerName.SpotifyDesktop);
            }
        }
    }

    async previousSong() {
        const hasSpotifyPlaybackAccess = MusicManager.getInstance().hasSpotifyPlaybackAccess();

        if (hasSpotifyPlaybackAccess) {
            if (this.isLikedSongPlaylist()) {
                await MusicManager.getInstance().playPreviousLikedSong();
            } else {
                const playerName = MusicManager.getInstance().getPlayerNameForPlayback();
                await this.musicCmdUtil.runSpotifyCommand(previous, [
                    playerName
                ]);
            }
        } else {
            if (this.isLikedSongPlaylist()) {
                await MusicManager.getInstance().playPreviousLikedSong();
            } else {
                previous(PlayerName.SpotifyDesktop);
            }
        }
    }

    /**
     * {status, state, statusText, message, data.status, error}
     */

    async playSong() {
        const hasSpotifyPlaybackAccess = MusicManager.getInstance().hasSpotifyPlaybackAccess();

        if (hasSpotifyPlaybackAccess) {
            const result: any = await this.musicCmdUtil.runSpotifyCommand(play);
            if (result && result.status < 300) {
                MusicCommandManager.syncControls(
                    dataMgr.runningTrack,
                    true,
                    TrackStatus.Playing
                );
            }
        } else {
            play(PlayerName.SpotifyDesktop);
        }
    }

    async pauseSong() {
        const hasSpotifyPlaybackAccess = MusicManager.getInstance().hasSpotifyPlaybackAccess();

        if (hasSpotifyPlaybackAccess) {
            const result: any = await this.musicCmdUtil.runSpotifyCommand(
                pause
            );
            if (result && result.status < 300) {
                MusicCommandManager.syncControls(
                    dataMgr.runningTrack,
                    true,
                    TrackStatus.Paused
                );
            }
        } else {
            pause(PlayerName.SpotifyDesktop);
        }
    }

    async setRepeatOnOff(setToOn: boolean) {
        let result = null;
        if (setToOn) {
            result = await repeatOn(PlayerName.SpotifyWeb);
        } else {
            result = await repeatOff(PlayerName.SpotifyWeb);
        }

        setTimeout(async () => {
            // get the latest player context (repeat would be part of this data)
            await populatePlayerContext();
        }, 2000);
    }

    /**
     * Launch and play a spotify track via the web player.
     * @param isTrack boolean
     */
    async playSpotifyWebPlaylistTrack(
        isTrack: boolean,
        devices: PlayerDevice[]
    ) {
        const trackRepeating = await MusicManager.getInstance().isTrackRepeating();

        // get the selected playlist
        const selectedPlaylist = dataMgr.selectedPlaylist;
        // get the selected track
        const selectedTrack = dataMgr.selectedTrackItem;

        const isLikedSongsPlaylist =
            selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
        const playlistId = isLikedSongsPlaylist ? "" : selectedPlaylist.id;

        if (isLikedSongsPlaylist) {
            await this.playSpotifyByTrack(selectedTrack, devices);
        } else if (isTrack) {
            await this.playSpotifyByTrackAndPlaylist(
                playlistId,
                selectedTrack.id,
                devices
            );
        } else {
            // play the playlist
            await this.playSpotifyByTrackAndPlaylist(playlistId, "", devices);
        }

        setTimeout(() => {
            if (trackRepeating) {
                // make sure it set to repeat
                commands.executeCommand("musictime.repeatOn");
            } else {
                // set it to not repeat
                commands.executeCommand("musictime.repeatOff");
            }
        }, 2000);
    }

    /**
     * Helper function to play a track or playlist if we've determined to play
     * against the mac spotify desktop app.
     */
    async playSpotifyDesktopPlaylistTrack(devices: PlayerDevice[]) {
        const trackRepeating = await MusicManager.getInstance().isTrackRepeating();

        // get the selected playlist
        const selectedPlaylist = dataMgr.selectedPlaylist;
        const isPrem = await MusicManager.getInstance().isSpotifyPremium();
        const isWin = isWindows();
        // get the selected track
        const selectedTrack = dataMgr.selectedTrackItem;
        const isLikedSongsPlaylist =
            selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;

        if (isLikedSongsPlaylist) {
            if ((!isWin || isPrem) && devices && devices.length > 0) {
                // just play the 1st track
                this.playSpotifyByTrack(selectedTrack, devices);
            } else if (!isWin) {
                // try with the desktop app
                playSpotifyMacDesktopTrack(selectedTrack.id);
            } else {
                // just try to play it since it's windows and we don't have a device
                playSpotifyTrack(selectedTrack.id, "");
            }
        } else {
            if (!isWin) {
                // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
                // make sure the track has spotify:track and the playlist has spotify:playlist
                playSpotifyMacDesktopTrack(
                    selectedTrack.id,
                    selectedPlaylist.id
                );
            } else {
                this.playSpotifyByTrackAndPlaylist(
                    selectedPlaylist.id,
                    selectedTrack.id,
                    devices
                );
            }
        }

        setTimeout(() => {
            if (trackRepeating) {
                // make sure it set to repeat
                commands.executeCommand("musictime.repeatOn");
            } else {
                // set it to not repeat
                commands.executeCommand("musictime.repeatOff");
            }
        }, 2000);
    }

    async playSpotifyByTrackAndPlaylist(
        playlistId: string,
        trackId: string,
        devices: PlayerDevice[] = []
    ) {
        const {
            webPlayer,
            desktop,
            activeDevice,
            activeComputerDevice,
            activeWebPlayerDevice
        } = getDeviceSet();

        const deviceId = activeDevice ? activeDevice.id : "";
        // just play the 1st track
        await playSpotifyPlaylist(playlistId, trackId, deviceId);
    }

    async playSpotifyByTrack(
        track: PlaylistItem,
        devices: PlayerDevice[] = []
    ) {
        const deviceId = getDeviceId();

        if (deviceId) {
            playSpotifyTrack(track.id, deviceId);
        } else if (!isWindows()) {
            // try with the desktop app
            playSpotifyMacDesktopTrack(track.id);
        } else {
            // just try to play it without the device
            playSpotifyTrack(track.id, "");
        }
    }

    async setLiked(liked: boolean, overrideTrack: Track = null) {
        const serverIsOnline = await serverIsAvailable();
        const runningTrack: Track = dataMgr.runningTrack;

        const track: Track = !overrideTrack ? runningTrack : overrideTrack;

        if (!serverIsOnline || !track || !track.id) {
            window.showInformationMessage(
                `Our service is temporarily unavailable.\n\nPlease try again later.\n`
            );
            return;
        }

        if (track.playerType === PlayerType.MacItunesDesktop) {
            // await so that the stateCheckHandler fetches
            // the latest version of the itunes track
            await setItunesLoved(liked).catch(err => {
                logIt(`Error updating itunes loved state: ${err.message}`);
            });
        } else {
            // save the spotify track to the users liked songs playlist
            if (liked) {
                await saveToSpotifyLiked([track.id]);
            } else {
                await removeFromSpotifyLiked([track.id]);
            }
            // clear the liked songs
            MusicDataManager.getInstance().spotifyLikedSongs = [];
            // repopulate the liked songs
            await populateLikedSongs();
        }

        runningTrack.loved = liked;
        dataMgr.runningTrack = runningTrack;
        MusicCommandManager.syncControls(runningTrack, false);

        let type = "spotify";
        if (track.playerType === PlayerType.MacItunesDesktop) {
            type = "itunes";
        }
        const api = `/music/liked/track/${track.id}?type=${type}`;
        const resp = await softwarePut(api, { liked }, getItem("jwt"));
        if (!isResponseOk(resp)) {
            logIt(`Error updating track like state: ${resp.message}`);
        }

        // check if it's in the recommendation list
        const foundRecTrack = dataMgr.recommendationTracks.find(
            (t: Track) => t.id === track.id
        );

        if (foundRecTrack) {
            dataMgr.removeTrackFromRecommendations(track.id);
            commands.executeCommand("musictime.refreshRecommendationsTree");
        }

        // refresh
        commands.executeCommand("musictime.refreshPlaylist");
    }

    async copySpotifyLink(id: string, isPlaylist: boolean) {
        let link = buildSpotifyLink(id, isPlaylist);

        if (id === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
            link = "https://open.spotify.com/collection/tracks";
        }

        let messageContext = "";
        if (isPlaylist) {
            messageContext = "playlist";
        } else {
            messageContext = "track";
        }

        try {
            clipboardy.writeSync(link);
            window.showInformationMessage(
                `Spotify ${messageContext} link copied to clipboard.`
            );
        } catch (err) {
            logIt(`Unable to copy to clipboard, error: ${err.message}`);
        }
    }

    copyCurrentTrackLink() {
        // example: https://open.spotify.com/track/7fa9MBXhVfQ8P8Df9OEbD8
        // get the current track
        const selectedItem: PlaylistItem = dataMgr.selectedTrackItem;
        this.copySpotifyLink(selectedItem.id, false);
    }

    copyCurrentPlaylistLink() {
        // example: https://open.spotify.com/playlist/0mwG8hCL4scWi8Nkt7jyoV
        const selectedItem: PlaylistItem = dataMgr.selectedPlaylist;
        this.copySpotifyLink(selectedItem.id, true);
    }

    shareCurrentPlaylist() {
        const socialShare: SocialShareManager = SocialShareManager.getInstance();
        const selectedItem: PlaylistItem = dataMgr.selectedPlaylist;
        const url = buildSpotifyLink(selectedItem.id, true);

        socialShare.shareIt("facebook", { u: url, hashtag: "OneOfMyFavs" });
    }

    async showMenu() {
        let serverIsOnline = await serverIsAvailable();

        let menuOptions = {
            items: []
        };

        // check if they need to connect to spotify
        const needsSpotifyAccess = requiresSpotifyAccess();

        const isPrem = await MusicManager.getInstance().isSpotifyPremium();

        // check to see if they have the slack access token
        const slackAccessToken = getItem("slack_access_token");

        if (!needsSpotifyAccess) {
            // check if we already have a playlist
            const savedPlaylists: PlaylistItem[] = dataMgr.savedPlaylists;

            // check if they've generated a playlist yet
            const customPlaylist = dataMgr.getMusicTimePlaylistByTypeId(
                PERSONAL_TOP_SONGS_PLID
            );

            let personalPlaylistLabel = !customPlaylist
                ? GENERATE_CUSTOM_PLAYLIST_TITLE
                : REFRESH_CUSTOM_PLAYLIST_TITLE;
            const personalPlaylistTooltip = !customPlaylist
                ? GENERATE_CUSTOM_PLAYLIST_TOOLTIP
                : REFRESH_CUSTOM_PLAYLIST_TOOLTIP;

            if (!savedPlaylists || savedPlaylists.length === 0) {
                // show the generate playlist menu item
                menuOptions.items.push({
                    label: personalPlaylistLabel,
                    detail: personalPlaylistTooltip,
                    cb: MusicManager.getInstance().generateUsersWeeklyTopSongs
                });
            }
        }

        if (!needsSpotifyAccess) {
            menuOptions.items.push({
                label: "Open dashboard",
                detail:
                    "View your latest music metrics right here in your editor",
                cb: displayMusicTimeMetricsMarkdownDashboard
            });
        }

        menuOptions.items.push({
            label: "Submit an issue on GitHub",
            detail: "Encounter a bug? Submit an issue on our GitHub page",
            url: "https://github.com/swdotcom/swdc-vscode/issues"
        });

        menuOptions.items.push({
            label: "Submit feedback",
            detail: "Send us an email at cody@software.com",
            url: "mailto:cody@software.com"
        });

        if (!needsSpotifyAccess) {
            menuOptions.items.push({
                label: "See web analytics",
                detail: "See music analytics in the web app",
                command: "musictime.launchAnalytics"
            });
        }

        if (serverIsOnline) {
            // show divider
            menuOptions.items.push({
                label:
                    "___________________________________________________________________",
                cb: null,
                url: null,
                command: null
            });

            if (needsSpotifyAccess) {
                menuOptions.items.push({
                    label: "Connect Spotify",
                    detail:
                        "To see your Spotify playlists in Music Time, please connect your account",
                    url: null,
                    cb: connectSpotify
                });
            } else {
                menuOptions.items.push({
                    label: "Disconnect Spotify",
                    detail: "Disconnect your Spotify oauth integration",
                    url: null,
                    command: "musictime.disconnectSpotify"
                });

                if (!isPrem) {
                    menuOptions.items.push({
                        label: "Connect Premium",
                        detail:
                            "Non premium connected. Connect to your premium Spotify account to use the web based play, pause, next, and previous controls",
                        url: null,
                        command: "musictime.connectSpotify"
                    });
                }

                if (!slackAccessToken) {
                    menuOptions.items.push({
                        label: "Connect Slack",
                        detail:
                            "To share a playlist or track on Slack, please connect your account",
                        url: null,
                        cb: connectSlack
                    });
                } else {
                    menuOptions.items.push({
                        label: "Disconnect Slack",
                        detail: "Disconnect your Slack oauth integration",
                        url: null,
                        command: "musictime.disconnectSlack"
                    });
                }
            }
        }

        showQuickPick(menuOptions);
    }

    async showCreatePlaylistInputPrompt(placeHolder: string) {
        return await window.showInputBox({
            value: placeHolder,
            placeHolder: "New Playlist",
            validateInput: text => {
                return !text || text.trim().length === 0
                    ? "Please enter a playlist name to continue."
                    : null;
            }
        });
    }

    async createNewPlaylist() {
        const musicControlMgr: MusicControlManager = MusicControlManager.getInstance();
        // !!! important, need to use the get instance as this
        // method may be called within a callback and "this" will be undefined !!!
        const hasPlaylistItemToAdd = musicControlMgr.currentTrackToAdd
            ? true
            : false;
        const placeholder: string = hasPlaylistItemToAdd
            ? `${musicControlMgr.currentTrackToAdd.artist} - ${musicControlMgr.currentTrackToAdd.name}`
            : "New Playlist";
        let playlistName = await musicControlMgr.showCreatePlaylistInputPrompt(
            placeholder
        );

        if (playlistName && playlistName.trim().length === 0) {
            window.showInformationMessage(
                "Please enter a playlist name to continue."
            );
            return;
        }

        if (!playlistName) {
            return;
        }

        const playlistItems = hasPlaylistItemToAdd
            ? [musicControlMgr.currentTrackToAdd]
            : [];
        MusicPlaylistManager.getInstance().createPlaylist(
            playlistName,
            playlistItems
        );
    }

    async addToPlaylistMenu(playlistItem: PlaylistItem) {
        this.currentTrackToAdd = playlistItem;
        let menuOptions = {
            items: [
                {
                    label: "New Playlist",
                    cb: this.createNewPlaylist
                }
            ],
            placeholder: "Select or Create a playlist"
        };
        let playlists: PlaylistItem[] = MusicManager.getInstance()
            .currentPlaylists;

        // filter out the ones with itemType = playlist
        playlists = playlists
            .filter(
                (n: PlaylistItem) =>
                    n.itemType === "playlist" && n.name !== "Software Top 40"
            )
            .map((n: PlaylistItem) => n);

        sortPlaylists(playlists);

        playlists.forEach((item: PlaylistItem) => {
            menuOptions.items.push({
                label: item.name,
                cb: null
            });
        });

        const pick = await showQuickPick(menuOptions);
        if (pick && pick.label) {
            // add it to this playlist
            const matchingPlaylists = playlists
                .filter((n: PlaylistItem) => n.name === pick.label)
                .map((n: PlaylistItem) => n);
            if (matchingPlaylists.length) {
                const matchingPlaylist = matchingPlaylists[0];
                if (matchingPlaylist) {
                    const playlistName = matchingPlaylist.name;
                    let errMsg = null;

                    const trackUri =
                        playlistItem.uri ||
                        createUriFromTrackId(playlistItem.id);
                    const trackId = playlistItem.id;

                    if (matchingPlaylist.name !== "Liked Songs") {
                        // it's a non-liked songs playlist update
                        // uri:"spotify:track:2JHCaLTVvYjyUrCck0Uvrp" or id
                        const codyResponse = await addTracksToPlaylist(
                            matchingPlaylist.id,
                            [trackUri]
                        );
                        errMsg = getCodyErrorMessage(codyResponse);

                        // populate the spotify playlists
                        await populateSpotifyPlaylists();
                    } else {
                        // it's a liked songs playlist update
                        let track: Track = dataMgr.runningTrack;
                        if (track.id !== trackId) {
                            track = new Track();
                            track.id = playlistItem.id;
                            track.playerType = playlistItem.playerType;
                            track.state = playlistItem.state;
                        }
                        await this.setLiked(true, track);

                        // add to the trackIdsForRecommendations
                        dataMgr.trackIdsForRecommendations.push(trackId);
                    }
                    if (!errMsg) {
                        window.showInformationMessage(
                            `Added ${playlistItem.name} to ${playlistName}`
                        );
                        // refresh the playlist and clear the current recommendation metadata
                        dataMgr.removeTrackFromRecommendations(trackId);
                        commands.executeCommand("musictime.refreshPlaylist");
                        commands.executeCommand(
                            "musictime.refreshRecommendationsTree"
                        );
                    } else {
                        if (errMsg) {
                            window.showErrorMessage(
                                `Failed to add '${playlistItem.name}' to '${playlistName}'. ${errMsg}`,
                                ...[OK_LABEL]
                            );
                        }
                    }
                }
            }
        }
    }
}

export function buildSpotifyLink(id: string, isPlaylist: boolean) {
    let link = "";
    id = createSpotifyIdFromUri(id);
    if (isPlaylist) {
        link = `https://open.spotify.com/playlist/${id}`;
    } else {
        link = `https://open.spotify.com/track/${id}`;
    }

    return link;
}

export async function displayMusicTimeMetricsMarkdownDashboard() {
    if (fetchingMusicTimeMetrics) {
        window.showInformationMessage(
            `Still generating Music Time dashboard, please wait...`
        );
        return;
    }
    fetchingMusicTimeMetrics = true;

    window.showInformationMessage(
        `Generating Music Time dashboard, please wait...`
    );

    const musicTimeFile = getMusicTimeMarkdownFile();
    await fetchMusicTimeMetricsMarkdownDashboard();

    const viewOptions = {
        viewColumn: ViewColumn.One,
        preserveFocus: false
    };
    const localResourceRoots = [Uri.file(getSoftwareDir()), Uri.file(tmpdir())];
    const panel = window.createWebviewPanel(
        "music-time-preview",
        `Music Time Dashboard`,
        viewOptions,
        {
            enableFindWidget: true,
            localResourceRoots,
            enableScripts: true // enables javascript that may be in the content
        }
    );

    const content = fs.readFileSync(musicTimeFile).toString();
    panel.webview.html = content;

    window.showInformationMessage(`Completed building Music Time dashboard.`);
    fetchingMusicTimeMetrics = false;
}

export async function connectSpotify() {
    let serverIsOnline = await serverIsAvailable();
    if (!serverIsOnline) {
        window.showInformationMessage(
            `Our service is temporarily unavailable.\n\nPlease try again later.\n`
        );
        return;
    }
    let jwt = getItem("jwt");
    if (!jwt) {
        // no jwt, get the app jwt
        jwt = await getAppJwt(true);
        await setItem("jwt", jwt);
    }

    // check if they're already connected, if so then ask if they would
    // like to continue as we'll need to disconnect the current connection
    const needsSpotifyAccess = requiresSpotifyAccess();
    if (!needsSpotifyAccess) {
        // disconnectSpotify
        const selection = await window.showInformationMessage(
            `Connect with a different Spotify account?`,
            ...[YES_LABEL]
        );
        if (!selection || selection !== YES_LABEL) {
            return;
        }
        // disconnect the current connection
        await disconnectSpotify(false /*confirmDisconnect*/);
    }

    const encodedJwt = encodeURIComponent(jwt);
    const mac = isMac() ? "true" : "false";
    const qryStr = `token=${encodedJwt}&mac=${mac}`;
    const endpoint = `${api_endpoint}/auth/spotify?${qryStr}`;
    launchWebUrl(endpoint);
    refetchSpotifyConnectStatusLazily();
}

export async function disconnectSpotify(confirmDisconnect = true) {
    await disconnectOauth("Spotify", confirmDisconnect);
}

export async function disconnectSlack(confirmDisconnect = true) {
    await disconnectOauth("Slack", confirmDisconnect);
}

export async function disconnectOauth(type: string, confirmDisconnect = true) {
    const selection = confirmDisconnect
        ? await window.showInformationMessage(
              `Are you sure you would like to disconnect ${type}?`,
              ...[YES_LABEL]
          )
        : YES_LABEL;

    if (selection === YES_LABEL) {
        let serverIsOnline = await serverIsAvailable();
        if (serverIsOnline) {
            const type_lc = type.toLowerCase();
            let result = await softwarePut(
                `/auth/${type_lc}/disconnect`,
                {},
                getItem("jwt")
            );

            // oauth is not null, initialize spotify
            if (type_lc === "slack") {
                await MusicManager.getInstance().updateSlackAccessInfo(null);
            } else if (type_lc === "spotify") {
                await MusicManager.getInstance().updateSpotifyAccessInfo(null);
                // clear the spotify playlists
                dataMgr.spotifyPlaylists = [];
                dataMgr.spotifyLikedSongs = [];

                commands.executeCommand("musictime.refreshPlaylist");
                commands.executeCommand("musictime.refreshRecommendations");
            }

            window.showInformationMessage(
                `Successfully disconnected your ${type} connection.`
            );
        } else {
            window.showInformationMessage(
                `Our service is temporarily unavailable.\n\nPlease try again later.\n`
            );
        }
    }
}

export async function fetchMusicTimeMetricsMarkdownDashboard() {
    let file = getMusicTimeMarkdownFile();

    const dayOfMonth = moment()
        .startOf("day")
        .date();
    if (!fs.existsSync(file) || lastDayOfMonth !== dayOfMonth) {
        lastDayOfMonth = dayOfMonth;
        await fetchDashboardData(file, true);
    }
}

export async function fetchMusicTimeMetricsDashboard() {
    let file = getMusicTimeFile();

    const dayOfMonth = moment()
        .startOf("day")
        .date();
    if (fs.existsSync(file) || lastDayOfMonth !== dayOfMonth) {
        lastDayOfMonth = dayOfMonth;
        await fetchDashboardData(file, false);
    }
}

async function fetchDashboardData(fileName: string, isHtml: boolean) {
    const musicSummary = await softwareGet(
        `/dashboard/music?linux=${isLinux()}&html=${isHtml}`,
        getItem("jwt")
    );

    // get the content
    let content =
        musicSummary && musicSummary.data ? musicSummary.data : NO_DATA;

    fs.writeFileSync(fileName, content, err => {
        if (err) {
            logIt(
                `Error writing to the Software dashboard file: ${err.message}`
            );
        }
    });
}
