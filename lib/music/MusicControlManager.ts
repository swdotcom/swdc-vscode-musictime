import {
    PlayerType,
    play,
    pause,
    previous,
    next,
    PlayerName,
    Track,
    launchPlayer,
    PlaylistItem,
    playTrackInContext,
    playTrack,
    saveToSpotifyLiked,
    addTracksToPlaylist,
    removeFromSpotifyLiked,
    setItunesLoved
} from "cody-music";
import { window, ViewColumn, Uri, commands } from "vscode";
import { MusicCommandManager } from "./MusicCommandManager";
import { showQuickPick } from "../MenuManager";
import {
    serverIsAvailable,
    refetchSpotifyConnectStatusLazily,
    getAppJwt
} from "../DataController";
import {
    getItem,
    getMusicTimeFile,
    isLinux,
    logIt,
    launchWebUrl,
    createSpotifyIdFromUri,
    getMusicTimeMarkdownFile,
    getSoftwareDir,
    setItem,
    isMac,
    getCodyErrorMessage
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
    NOT_NOW_LABEL,
    YES_LABEL,
    OK_LABEL
} from "../Constants";
import { MusicStateManager } from "./MusicStateManager";
import { SocialShareManager } from "../social/SocialShareManager";
import { tmpdir } from "os";
import { connectSlack } from "../slack/SlackControlManager";
import { MusicManager } from "./MusicManager";
import { MusicPlaylistManager } from "./MusicPlaylistManager";

const moment = require("moment-timezone");
const clipboardy = require("clipboardy");
const fs = require("fs");

const NO_DATA = "MUSIC TIME\n\nNo data available\n";

let lastDayOfMonth = -1;
let fetchingMusicTimeMetrics = false;

export class MusicControlManager {
    private musicMgr: MusicManager = MusicManager.getInstance();
    private musicStateMgr: MusicStateManager = MusicStateManager.getInstance();

    private currentTrackToAdd: PlaylistItem = null;

    private static instance: MusicControlManager;

    private constructor() {
        //
    }

    static getInstance(): MusicControlManager {
        if (!MusicControlManager.instance) {
            MusicControlManager.instance = new MusicControlManager();
        }

        return MusicControlManager.instance;
    }

    async nextSong() {
        const playerName = this.musicMgr.getPlayerNameForPlayback();
        await next(playerName);
        // fetch the new track info
        await this.musicStateMgr.gatherMusicInfo();
    }

    async previousSong() {
        const playerName = this.musicMgr.getPlayerNameForPlayback();
        await previous(playerName);
        // fetch the new track info
        await this.musicStateMgr.gatherMusicInfo();
    }

    async playSong() {
        const playerName = this.musicMgr.getPlayerNameForPlayback();
        await play(playerName);
        MusicCommandManager.syncControls(this.musicMgr.runningTrack, true);
        // fetch the new track info
        await this.musicStateMgr.gatherMusicInfo();
    }

    async pauseSong(needsRefresh = true) {
        const playerName = this.musicMgr.getPlayerNameForPlayback();
        await pause(playerName);
        if (needsRefresh) {
            MusicCommandManager.syncControls(this.musicMgr.runningTrack, true);
            // fetch the new track info
            await this.musicStateMgr.gatherMusicInfo();
        }
    }

    async playSongInContext(params) {
        const playerName = this.musicMgr.getPlayerNameForPlayback();
        await playTrackInContext(playerName, params);
        MusicCommandManager.syncControls(this.musicMgr.runningTrack, true);
        // fetch the new track info
        await this.musicStateMgr.gatherMusicInfo();
    }

    async playSongById(playerName: PlayerName, trackId: string) {
        await playTrack(playerName, trackId);
        MusicCommandManager.syncControls(this.musicMgr.runningTrack, true);
        // fetch the new track info
        await this.musicStateMgr.gatherMusicInfo();
    }

    async setLiked(
        liked: boolean,
        overrideTrack: Track = null,
        updateStatus = true
    ) {
        const serverIsOnline = await serverIsAvailable();
        const track: Track = !overrideTrack
            ? this.musicMgr.runningTrack
            : overrideTrack;

        if (!serverIsOnline || !track || !track.id) {
            window.showInformationMessage(
                `Our service is temporarily unavailable.\n\nPlease try again later.\n`
            );
            return;
        }

        // const isLikedSongTrack = track.id === "Liked Songs" ? true : false;

        if (track && track.id) {
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
            }

            // show loading until the liked/unliked is complete
            MusicCommandManager.syncControls(track, true /*loading*/);

            let type = "spotify";
            if (track.playerType === PlayerType.MacItunesDesktop) {
                type = "itunes";
            }
            const api = `/music/liked/track/${track.id}?type=${type}`;
            const resp = await softwarePut(api, { liked }, getItem("jwt"));
            if (!isResponseOk(resp)) {
                logIt(`Error updating track like state: ${resp.message}`);
            }

            // get the server track. this will sync the controls
            if (updateStatus) {
                await this.musicMgr.getServerTrack(track);
            }
        }
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
        const selectedItem: PlaylistItem = MusicManager.getInstance()
            .selectedTrackItem;
        this.copySpotifyLink(selectedItem.id, false);
    }

    copyCurrentPlaylistLink() {
        // example: https://open.spotify.com/playlist/0mwG8hCL4scWi8Nkt7jyoV
        const selectedItem: PlaylistItem = MusicManager.getInstance()
            .selectedPlaylist;
        this.copySpotifyLink(selectedItem.id, true);
    }

    shareCurrentPlaylist() {
        const socialShare: SocialShareManager = SocialShareManager.getInstance();
        const selectedItem: PlaylistItem = MusicManager.getInstance()
            .selectedPlaylist;
        const url = buildSpotifyLink(selectedItem.id, true);

        socialShare.shareIt("facebook", { u: url, hashtag: "OneOfMyFavs" });
    }

    launchSpotifyPlayer() {
        window.showInformationMessage(
            `After you select and play your first song in Spotify, standard controls (play, pause, next, etc.) will appear in your status bar.`,
            ...[OK_LABEL]
        );
        setTimeout(() => {
            launchPlayer(PlayerName.SpotifyWeb);
        }, 3200);
    }

    async showMenu() {
        let serverIsOnline = await serverIsAvailable();

        let menuOptions = {
            items: []
        };

        const musicMgr: MusicManager = MusicManager.getInstance();

        // check if they need to connect to spotify
        const needsSpotifyAccess = musicMgr.requiresSpotifyAccess();

        // check to see if they have the slack access token
        const slackAccessToken = getItem("slack_access_token");

        if (!needsSpotifyAccess) {
            // check if we already have a playlist
            const savedPlaylists: PlaylistItem[] = musicMgr.savedPlaylists;
            const hasSavedPlaylists =
                savedPlaylists && savedPlaylists.length > 0;

            // check if they've generated a playlist yet
            const customPlaylist = musicMgr.getMusicTimePlaylistByTypeId(
                PERSONAL_TOP_SONGS_PLID
            );

            let personalPlaylistLabel = !customPlaylist
                ? GENERATE_CUSTOM_PLAYLIST_TITLE
                : REFRESH_CUSTOM_PLAYLIST_TITLE;
            const personalPlaylistTooltip = !customPlaylist
                ? GENERATE_CUSTOM_PLAYLIST_TOOLTIP
                : REFRESH_CUSTOM_PLAYLIST_TOOLTIP;

            if (!hasSavedPlaylists) {
                // show the generate playlist menu item
                menuOptions.items.push({
                    label: personalPlaylistLabel,
                    detail: personalPlaylistTooltip,
                    cb: musicMgr.generateUsersWeeklyTopSongs
                });
            }
        }

        if (!needsSpotifyAccess) {
            menuOptions.items.push({
                label: "Music Time Dashboard",
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
            label: "Submit Feedback",
            detail: "Send us an email at cody@software.com",
            url: "mailto:cody@software.com"
        });

        if (!needsSpotifyAccess) {
            menuOptions.items.push({
                label: "See Web Analytics",
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
                return !text
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
        const playlistName = await musicControlMgr.showCreatePlaylistInputPrompt(
            placeholder
        );
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
        const musicMgr: MusicManager = MusicManager.getInstance();
        let menuOptions = {
            items: [
                {
                    label: "New Playlist",
                    cb: this.createNewPlaylist
                }
            ],
            placeholder: "Select or Create a playlist"
        };
        let playlists: PlaylistItem[] = musicMgr.currentPlaylists;

        // filter out the ones with itemType = playlist
        playlists = playlists.filter(
            (n: PlaylistItem) =>
                n.itemType === "playlist" && n.name !== "Software Top 40"
        );

        musicMgr.sortPlaylists(playlists);

        playlists.forEach((item: PlaylistItem) => {
            menuOptions.items.push({
                label: item.name,
                cb: null
            });
        });

        const pick = await showQuickPick(menuOptions);
        if (pick && pick.label) {
            // add it to this playlist
            const matchingPlaylists = playlists.filter(
                (n: PlaylistItem) => n.name === pick.label
            );
            if (matchingPlaylists.length) {
                const matchingPlaylist = matchingPlaylists[0];
                if (matchingPlaylist) {
                    const playlistName = matchingPlaylist.name;
                    let errMsg = null;

                    if (matchingPlaylist.name !== "Liked Songs") {
                        // uri:"spotify:playlist:2JHCaLTVvYjyUrCck0Uvrp" or id
                        const codyResponse = await addTracksToPlaylist(
                            matchingPlaylist.id,
                            [playlistItem.uri]
                        );
                        errMsg = getCodyErrorMessage(codyResponse);
                    } else {
                        let updateStatus = true;
                        let track: Track = musicMgr.runningTrack;
                        if (track.id !== playlistItem.id) {
                            track = new Track();
                            track.id = playlistItem.id;
                            track.playerType = playlistItem.playerType;
                            track.state = playlistItem.state;
                            updateStatus = false;
                        }
                        await this.setLiked(true, track, updateStatus);
                    }
                    if (!errMsg) {
                        window.showInformationMessage(
                            `Added ${playlistItem.name} to ${playlistName}`
                        );
                        // refresh the playlist and clear the current recommendation metadata
                        musicMgr.clearCurrentRecMeta();
                        commands.executeCommand("musictime.refreshPlaylist");
                    } else {
                        if (errMsg) {
                            window.showErrorMessage(
                                `Unable to add ${playlistItem.name} to${playlistName}. Please make sure you are the owner of the playlist, and there are less than 10,000 tracks in the playlist.`,
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
            `Still building Music Time dashboard, please wait...`
        );
        return;
    }
    fetchingMusicTimeMetrics = true;

    window.showInformationMessage(
        `Building Music Time dashboard, please wait...`
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
    const needsSpotifyAccess = MusicManager.getInstance().requiresSpotifyAccess();
    if (!needsSpotifyAccess) {
        // disconnectSpotify
        const selection = await window.showInformationMessage(
            `Would you like to connect as a new Spotify user?`,
            ...[NOT_NOW_LABEL, YES_LABEL]
        );
        if (!selection || selection === NOT_NOW_LABEL) {
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
    disconnectOauth("Spotify", confirmDisconnect);
}

export async function disconnectSlack(confirmDisconnect = true) {
    disconnectOauth("Slack", confirmDisconnect);
}

export async function disconnectOauth(type: string, confirmDisconnect = true) {
    const selection = confirmDisconnect
        ? await window.showInformationMessage(
              `Are you sure you would like to disconnect ${type}?`,
              ...[NOT_NOW_LABEL, YES_LABEL]
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

            if (isResponseOk(result)) {
                const musicMgr = MusicManager.getInstance();
                // oauth is not null, initialize spotify
                if (type_lc === "slack") {
                    await musicMgr.updateSlackAccessInfo(null);
                } else if (type_lc === "spotify") {
                    await musicMgr.clearSpotifyAccessInfo();
                }

                window.showInformationMessage(
                    `Successfully disconnected your ${type} connection.`
                );

                commands.executeCommand("musictime.refreshPlaylist");
                commands.executeCommand("musictime.refreshRecommendations");
            }
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
        await fetchDashboardData(file, "music-time", true);
    }
}

export async function fetchMusicTimeMetricsDashboard() {
    let file = getMusicTimeFile();

    const dayOfMonth = moment()
        .startOf("day")
        .date();
    if (fs.existsSync(file) || lastDayOfMonth !== dayOfMonth) {
        lastDayOfMonth = dayOfMonth;
        await fetchDashboardData(file, "music-time", false);
    }
}

async function fetchDashboardData(
    fileName: string,
    plugin: string,
    isHtml: boolean
) {
    const musicSummary = await softwareGet(
        `/dashboard?plugin=${plugin}&linux=${isLinux()}&html=${isHtml}`,
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
