import {
    PlaylistItem,
    PlayerType,
    PlayerName,
    TrackStatus,
    Track,
    CodyResponse,
    getPlaylistTracks,
    PaginationItem,
    CodyResponseType,
    createPlaylist,
    addTracksToPlaylist,
    replacePlaylistTracks,
    CodyConfig,
    setConfig,
    getUserProfile,
    launchPlayer,
    quitMacPlayer,
    getSpotifyDevices,
    PlayerDevice,
    getSpotifyPlaylist,
    getRecommendationsForTracks,
    followPlaylist,
    playSpotifyDevice,
    playSpotifyTrack,
    PlayerContext,
    getSpotifyPlayerContext
} from "cody-music";
import {
    PERSONAL_TOP_SONGS_NAME,
    PERSONAL_TOP_SONGS_PLID,
    SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
    SOFTWARE_TOP_40_PLAYLIST_ID,
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SHOW_ITUNES_LAUNCH_BUTTON,
    OK_LABEL,
    YES_LABEL
} from "../Constants";
import { commands, window } from "vscode";
import {
    serverIsAvailable,
    getSlackOauth,
    getAppJwt,
    getMusicTimeUserStatus,
    populateSpotifyPlaylists,
    populateLikedSongs
} from "../DataController";
import {
    getItem,
    setItem,
    isMac,
    logIt,
    getCodyErrorMessage,
    isWindows
} from "../Util";
import {
    isResponseOk,
    softwareGet,
    softwarePost,
    softwareDelete,
    softwarePut
} from "../HttpClient";
import { SpotifyUser } from "cody-music/dist/lib/profile";
import { MusicCommandManager } from "./MusicCommandManager";
import { MusicControlManager } from "./MusicControlManager";
import { ProviderItemManager } from "./ProviderItemManager";
import {
    sortPlaylists,
    sortTracks,
    buildTracksForRecommendations,
    getActiveDevice,
    requiresSpotifyAccess,
    getMusicTimePlaylistByTypeId
} from "./MusicUtil";
import { MusicDataManager } from "./MusicDataManager";

const providerItemMgr: ProviderItemManager = ProviderItemManager.getInstance();
const dataMgr: MusicDataManager = MusicDataManager.getInstance();
export class MusicManager {
    private static instance: MusicManager;

    private constructor() {
        //
    }
    static getInstance(): MusicManager {
        if (!MusicManager.instance) {
            MusicManager.instance = new MusicManager();
        }

        return MusicManager.instance;
    }

    get currentPlaylists(): PlaylistItem[] {
        if (dataMgr.currentPlayerName === PlayerName.ItunesDesktop) {
            // go through each playlist and find out it's state
            if (dataMgr.itunesPlaylists && dataMgr.itunesPlaylists.length) {
                dataMgr.itunesPlaylists.forEach((item: PlaylistItem) => {
                    if (item.type === "playlist") {
                        dataMgr.playlistMap[item.id] = item;
                    }
                });
            }
            return dataMgr.itunesPlaylists;
        }
        if (dataMgr.spotifyPlaylists && dataMgr.spotifyPlaylists.length) {
            dataMgr.spotifyPlaylists.forEach((item: PlaylistItem) => {
                if (item.type === "playlist") {
                    dataMgr.playlistMap[item.id] = item;
                }
            });
        }
        return dataMgr.spotifyPlaylists;
    }

    //
    // Clear all of the playlists and tracks
    //
    clearPlaylists() {
        dataMgr.playlistMap = {};
        dataMgr.generatedPlaylists = [];
        dataMgr.playlistTrackMap = {};
    }

    clearSavedPlaylists() {
        dataMgr.savedPlaylists = [];
    }

    updateSort(sortAlpha) {
        if (!requiresSpotifyAccess()) {
            dataMgr.rawPlaylists = [...dataMgr.origRawPlaylistOrder];
            dataMgr.sortAlphabetically = sortAlpha;
            commands.executeCommand("musictime.refreshPlaylist");
            window.showInformationMessage("Sorting playlist, please wait.");
        }
    }

    async refreshPlaylists() {
        if (dataMgr.buildingPlaylists) {
            console.log(
                "currently building the playlist, waiting on that job to complete"
            );
            return;
        }
        dataMgr.buildingPlaylists = true;

        let serverIsOnline = await serverIsAvailable();

        if (dataMgr.currentPlayerName === PlayerName.ItunesDesktop) {
            await this.refreshPlaylistForPlayer(serverIsOnline);
        } else {
            await this.refreshPlaylistForPlayer(serverIsOnline);
        }
        await MusicCommandManager.syncControls(dataMgr.runningTrack);

        dataMgr.buildingPlaylists = false;
    }

    getPlaylistById(playlist_id: string) {
        return dataMgr.playlistMap[playlist_id];
    }

    //
    // Fetch the playlist names for a specific player
    //
    private async refreshPlaylistForPlayer(serverIsOnline: boolean) {
        const playerName = dataMgr.currentPlayerName;
        let items: PlaylistItem[] = [];

        // states: [NOT_CONNECTED, MAC_PREMIUM, MAC_NON_PREMIUM, PC_PREMIUM, PC_NON_PREMIUM]
        const CONNECTED = !requiresSpotifyAccess() ? true : false;
        const IS_PREMIUM = this.isSpotifyPremium() ? true : false;
        let HAS_SPOTIFY_USER = this.hasSpotifyUser() ? true : false;
        const CONNECTED_WITH_USER =
            CONNECTED && HAS_SPOTIFY_USER ? true : false;

        const type =
            playerName === PlayerName.ItunesDesktop ? "itunes" : "spotify";

        // ! very important !
        // We need the spotify user if we're connected
        if (CONNECTED && !HAS_SPOTIFY_USER) {
            // get it
            dataMgr.spotifyUser = await getUserProfile();
            HAS_SPOTIFY_USER = this.hasSpotifyUser() ? true : false;
            if (!HAS_SPOTIFY_USER) {
                // try 1 more time
                dataMgr.spotifyUser = await getUserProfile();
                HAS_SPOTIFY_USER = this.hasSpotifyUser() ? true : false;
            }
        }

        // ! most important part !
        let playlists: PlaylistItem[] = dataMgr.rawPlaylists || [];
        let hasPlaylists = playlists.length ? true : false;
        let hasLikedSongs: boolean =
            dataMgr.spotifyLikedSongs && dataMgr.spotifyLikedSongs.length
                ? true
                : false;

        // fetch the playlists
        if (!hasPlaylists && CONNECTED) {
            await populateSpotifyPlaylists();
            playlists = dataMgr.rawPlaylists;
            hasPlaylists = playlists.length > 0 ? true : false;
        }

        if (!hasLikedSongs && CONNECTED) {
            await populateLikedSongs();
        }

        // reconcile in case the fetched playlists don't contain
        // one we've generated, or the name has changed
        if (
            serverIsOnline &&
            playerName === PlayerName.SpotifyWeb &&
            hasPlaylists
        ) {
            // this can happen async as it's just reconciling our backend
            this.reconcilePlaylists(playlists);
        }

        // sort
        if (dataMgr.sortAlphabetically) {
            sortPlaylists(playlists);
        }

        // update each playlist itemType and tag
        if (hasPlaylists) {
            playlists.forEach(playlist => {
                dataMgr.playlistMap[playlist.id] = playlist;
                playlist.itemType = "playlist";
                playlist.tag = type;
            });
        }

        // filter out the music time playlists into it's own list if we have any
        await this.retrieveMusicTimePlaylist(playlists);

        // if itunes, show the itunes connected button
        if (playerName === PlayerName.ItunesDesktop) {
            // add the action items specific to itunes
            items.push(providerItemMgr.getItunesConnectedButton());
        } else if (IS_PREMIUM && HAS_SPOTIFY_USER) {
            // show the spotify connected button if we allow playlist fetch
            items.push(providerItemMgr.getSpotifyConnectedButton());
        }

        // add the no music time connection button if we're not online
        if (!serverIsOnline && CONNECTED) {
            items.push(providerItemMgr.getNoMusicTimeConnectionButton());
        }

        // show the spotify connect premium button if they're connected and a non-premium account
        if (CONNECTED && !IS_PREMIUM) {
            // show the spotify premium account required button
            items.push(
                providerItemMgr.getSpotifyPremiumAccountRequiredButton()
            );
        }

        // add the connect to spotify if they still need to connect
        if (!CONNECTED) {
            items.push(providerItemMgr.getConnectToSpotifyButton());
        }

        // add the readme button
        items.push(providerItemMgr.getReadmeButton());

        if (serverIsOnline && CONNECTED) {
            items.push(providerItemMgr.getWebAnalyticsButton());
            items.push(providerItemMgr.getGenerateDashboardButton());
        }

        if (playerName === PlayerName.ItunesDesktop) {
            // add the action items specific to itunes
            items.push(providerItemMgr.getSwitchToSpotifyButton());

            if (playlists.length > 0) {
                items.push(providerItemMgr.getLineBreakButton());
            }

            playlists.forEach(item => {
                items.push(item);
            });

            dataMgr.itunesPlaylists = items;
        } else {
            // get the devices
            const devices: PlayerDevice[] = await getSpotifyDevices();

            // check to see if they have this device available, if not, show a button
            // to switch to this device
            const switchToThisDeviceButton = await providerItemMgr.getSwitchToThisDeviceButton(
                devices
            );
            if (switchToThisDeviceButton) {
                // add it
                items.push(switchToThisDeviceButton);
            }

            // show the devices listening folder if they've already connected oauth
            const activeDeviceInfo = await this.getActiveSpotifyDevicesTitleAndTooltip(
                devices
            );

            // set the current devices
            dataMgr.currentDevices = devices;

            if (activeDeviceInfo) {
                // only create the active device button if we have one
                const devicesFoundButton = providerItemMgr.createSpotifyDevicesButton(
                    activeDeviceInfo.title,
                    activeDeviceInfo.tooltip,
                    activeDeviceInfo.loggedIn
                );
                items.push(devicesFoundButton);
            }

            if (isMac() && SHOW_ITUNES_LAUNCH_BUTTON) {
                items.push(providerItemMgr.getSwitchToItunesButton());
            }

            // add the rest only if they don't need spotify access
            if ((serverIsOnline && CONNECTED) || hasPlaylists) {
                // line break between actions and software playlist section
                items.push(providerItemMgr.getLineBreakButton());

                // get the custom playlist button
                const customPlaylistButton: PlaylistItem = providerItemMgr.getCustomPlaylistButton();
                if (customPlaylistButton) {
                    items.push(customPlaylistButton);
                }

                // get the Software Top 40 Playlist
                let softwareTop40: PlaylistItem = playlists.find(
                    n => n.id === SOFTWARE_TOP_40_PLAYLIST_ID
                );
                if (!softwareTop40) {
                    softwareTop40 = await getSpotifyPlaylist(
                        SOFTWARE_TOP_40_PLAYLIST_ID
                    );
                }
                if (softwareTop40 && softwareTop40.id) {
                    softwareTop40.loved = false;
                    softwareTop40.itemType = "playlist";
                    softwareTop40.tag = "paw";
                    // add it to music time playlist
                    items.push(softwareTop40);
                }

                // Add the AI generated playlist
                if (
                    dataMgr.generatedPlaylists &&
                    dataMgr.generatedPlaylists.length
                ) {
                    let aiPlaylist = dataMgr.generatedPlaylists.find(
                        element => {
                            return (
                                element.playlistTypeId ===
                                PERSONAL_TOP_SONGS_PLID
                            );
                        }
                    );
                    if (aiPlaylist) {
                        items.push(aiPlaylist);
                    }
                }

                // LIKED SONGS folder
                // get the folder
                const likedSongsPlaylist = providerItemMgr.getSpotifyLikedPlaylistFolder();
                dataMgr.playlistMap[likedSongsPlaylist.id] = likedSongsPlaylist;
                items.push(likedSongsPlaylist);

                // build tracks for recommendations (async)
                buildTracksForRecommendations(playlists);

                // line break between software playlist section and normal playlists
                if (playlists.length > 0) {
                    items.push(providerItemMgr.getLineBreakButton());
                }

                // build the set of playlists that are not the ai, top 40, and liked songs
                playlists.forEach((item: PlaylistItem) => {
                    // add all playlists except for the software top 40.
                    // this one will get displayed in the top section
                    if (item.id !== SOFTWARE_TOP_40_PLAYLIST_ID) {
                        items.push(item);
                    } else if (softwareTop40) {
                        // set the top 40 playlist to loved
                        softwareTop40.loved = true;
                    }
                });
            }

            dataMgr.spotifyPlaylists = items;

            // await checkForDups(dataMgr.spotifyPlaylists);
        }

        dataMgr.ready = true;
    }

    //
    // Fetch the playlist overall state
    //
    async getPlaylistState(playlist_id: string): Promise<TrackStatus> {
        let playlistState: TrackStatus = TrackStatus.NotAssigned;

        const playlistTrackItems: PlaylistItem[] = await this.getPlaylistItemTracksForPlaylistId(
            playlist_id
        );

        if (playlistTrackItems && playlistTrackItems.length > 0) {
            for (let i = 0; i < playlistTrackItems.length; i++) {
                const playlistItem: PlaylistItem = playlistTrackItems[i];
                if (playlistItem.id === dataMgr.runningTrack.id) {
                    return dataMgr.runningTrack.state;
                } else {
                    // update theis track status to not assigned to ensure it's also updated
                    playlistItem.state = TrackStatus.NotAssigned;
                }
            }
        }

        return playlistState;
    }

    async getComputerOrActiveDevice(
        devices: PlayerDevice[] = []
    ): Promise<PlayerDevice> {
        if (!devices || devices.length === 0) {
            devices = await getSpotifyDevices();
        }
        let anyActiveDevice: PlayerDevice = null;
        if (devices && devices.length > 0) {
            for (let i = 0; i < devices.length; i++) {
                const device: PlayerDevice = devices[i];

                if (device.type.toLowerCase() === "computer") {
                    return device;
                } else if (!anyActiveDevice && device.is_active) {
                    anyActiveDevice = device;
                }
            }
        }
        return anyActiveDevice;
    }

    async getInactiveDevices(devices: PlayerDevice[]): Promise<PlayerDevice[]> {
        let inactive_devices: PlayerDevice[] = [];
        if (devices && devices.length > 0) {
            for (let i = 0; i < devices.length; i++) {
                const device: PlayerDevice = devices[i];
                if (!device.is_active) {
                    inactive_devices.push(device);
                }
            }
        }

        return inactive_devices;
    }

    async getActiveSpotifyDevicesTitleAndTooltip(devices: PlayerDevice[]) {
        const inactiva_devices: PlayerDevice[] = await this.getInactiveDevices(
            devices
        );
        const activeDevice: PlayerDevice = getActiveDevice(devices);

        if (activeDevice) {
            // done, found an active device
            return {
                title: `Listening on ${activeDevice.name}`,
                tooltip: "Listening on a Spotify device",
                loggedIn: true
            };
        } else if (inactiva_devices && inactiva_devices.length > 0) {
            const names = inactiva_devices.map(device => {
                return device.name;
            });
            return {
                title: `Connected on ${names.join(", ")}`,
                tooltip: "Multiple Spotify devices connected",
                loggedIn: true
            };
        }
        return null;
    }

    clearPlaylistTracksForId(playlist_id) {
        dataMgr.playlistTrackMap[playlist_id] = null;
    }

    //
    // Fetch the tracks for a given playlist ID
    //
    async getPlaylistItemTracksForPlaylistId(
        playlist_id: string
    ): Promise<PlaylistItem[]> {
        let playlistItemTracks: PlaylistItem[] =
            dataMgr.playlistTrackMap[playlist_id];

        if (!playlistItemTracks || playlistItemTracks.length === 0) {
            if (dataMgr.currentPlayerName === PlayerName.ItunesDesktop) {
                // get the itunes tracks based on this playlist id name
                const codyResp: CodyResponse = await getPlaylistTracks(
                    PlayerName.ItunesDesktop,
                    playlist_id
                );
                playlistItemTracks = this.getPlaylistItemTracksFromCodyResponse(
                    codyResp
                );
            } else {
                // fetch from spotify web
                if (playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
                    playlistItemTracks = this.getPlaylistItemTracksFromTracks(
                        dataMgr.spotifyLikedSongs
                    );
                } else {
                    // get the playlist tracks from the spotify api
                    const codyResp: CodyResponse = await getPlaylistTracks(
                        PlayerName.SpotifyWeb,
                        playlist_id
                    );
                    playlistItemTracks = this.getPlaylistItemTracksFromCodyResponse(
                        codyResp
                    );
                }
            }

            // update the map
            dataMgr.playlistTrackMap[playlist_id] = playlistItemTracks;
        }

        if (playlistItemTracks && playlistItemTracks.length > 0) {
            for (let i = 0; i < playlistItemTracks.length; i++) {
                const track: PlaylistItem = playlistItemTracks[i];
                // check to see if this track is the current track
                if (dataMgr.runningTrack.id === track.id) {
                    playlistItemTracks[i].state = dataMgr.runningTrack.state;
                } else {
                    playlistItemTracks[i].state = TrackStatus.NotAssigned;
                }
                playlistItemTracks[i]["playlist_id"] = playlist_id;
            }
        }

        return playlistItemTracks;
    }

    //
    // Build the playlist items from the list of tracks
    //
    getPlaylistItemTracksFromTracks(tracks: Track[]): PlaylistItem[] {
        let playlistItems: PlaylistItem[] = [];
        if (tracks && tracks.length > 0) {
            for (let i = 0; i < tracks.length; i++) {
                let track = tracks[i];
                const position = i + 1;
                let playlistItem: PlaylistItem = this.createPlaylistItemFromTrack(
                    track,
                    position
                );
                playlistItems.push(playlistItem);
            }
        }
        return playlistItems;
    }

    getPlaylistItemTracksFromCodyResponse(
        codyResponse: CodyResponse
    ): PlaylistItem[] {
        let playlistItems: PlaylistItem[] = [];
        if (codyResponse && codyResponse.state === CodyResponseType.Success) {
            let paginationItem: PaginationItem = codyResponse.data;

            if (paginationItem && paginationItem.items) {
                playlistItems = paginationItem.items.map(
                    (track: Track, idx: number) => {
                        const position = idx + 1;
                        let playlistItem: PlaylistItem = this.createPlaylistItemFromTrack(
                            track,
                            position
                        );

                        return playlistItem;
                    }
                );
            }
        }

        return playlistItems;
    }

    getArtist(track: any) {
        if (!track) {
            return null;
        }
        if (track.artist) {
            return track.artist;
        }
        if (track.artists && track.artists.length > 0) {
            const trackArtist = track.artists[0];
            return trackArtist.name;
        }
        return null;
    }

    createPlaylistItemFromTrack(track: Track, position: number) {
        const popularity = track.popularity ? track.popularity : null;
        const artistName = this.getArtist(track);

        let tooltip = track.name;
        if (artistName) {
            tooltip += ` - ${artistName}`;
        }
        if (popularity) {
            tooltip += ` (Popularity: ${popularity})`;
        }

        let playlistItem: PlaylistItem = new PlaylistItem();
        playlistItem.type = "track";
        playlistItem.name = track.name;
        playlistItem.tooltip = tooltip;
        playlistItem.id = track.id;
        playlistItem.uri = track.uri;
        playlistItem.popularity = track.popularity;
        playlistItem.position = position;
        playlistItem.artist = artistName;
        playlistItem.playerType = track.playerType;
        playlistItem.itemType = "track";

        delete playlistItem.tracks;

        if (track.id === dataMgr.runningTrack.id) {
            playlistItem.state = dataMgr.runningTrack.state;
            dataMgr.selectedTrackItem = playlistItem;
        } else {
            playlistItem.state = TrackStatus.NotAssigned;
        }
        return playlistItem;
    }

    /**
     * Checks if the user's spotify playlists contains either
     * the global top 40 or the user's coding favorites playlist.
     * The playlistTypeId is used to match the set ID from music time
     * app. 1 = user's coding favorites, 2 = global top 40
     */
    retrieveMusicTimePlaylist(playlists: PlaylistItem[]) {
        dataMgr.generatedPlaylists = [];
        if (dataMgr.savedPlaylists.length > 0 && playlists.length > 0) {
            for (let i = 0; i < dataMgr.savedPlaylists.length; i++) {
                let savedPlaylist: PlaylistItem = dataMgr.savedPlaylists[i];
                let savedPlaylistTypeId = savedPlaylist.playlistTypeId;

                for (let x = playlists.length - 1; x >= 0; x--) {
                    let playlist = playlists[x];
                    if (playlist.id === savedPlaylist.id) {
                        playlist.playlistTypeId = savedPlaylistTypeId;
                        playlist.tag = "paw";
                        playlists.splice(x, 1);
                        dataMgr.generatedPlaylists.push(playlist);
                        break;
                    }
                }
            }
        }
    }

    async playNextLikedSong() {
        const deviceToPlayOn: PlayerDevice = await this.getComputerOrActiveDevice(
            dataMgr.currentDevices
        );
        // play the next song
        const nextTrack: Track = this.getNextSpotifyLikedSong();
        if (nextTrack) {
            let playlistItem: PlaylistItem = this.createPlaylistItemFromTrack(
                nextTrack,
                0
            );
            dataMgr.selectedTrackItem = playlistItem;
            const deviceId = deviceToPlayOn ? deviceToPlayOn.id : "";
            // play the next track
            playSpotifyTrack(playlistItem.id, deviceId);
        }
    }

    async playPreviousLikedSong() {
        const deviceToPlayOn: PlayerDevice = await this.getComputerOrActiveDevice(
            dataMgr.currentDevices
        );
        // play the next song
        const prevTrack: Track = this.getPreviousSpotifyLikedSong();
        if (prevTrack) {
            let playlistItem: PlaylistItem = this.createPlaylistItemFromTrack(
                prevTrack,
                0
            );
            dataMgr.selectedTrackItem = playlistItem;
            // play the prev track
            const deviceId = deviceToPlayOn ? deviceToPlayOn.id : "";
            // launch and play the next track
            playSpotifyTrack(playlistItem.id, deviceId);
        }
    }

    /**
     * Return the next Spotify Track from the Liked Songs list.
     * It will return null if the Liked Songs list doesn't exist or the current track ID is not assigned.
     * It will return the 1st track if the current track ID is not assigned and the Liked Songs list exists.
     */
    getNextSpotifyLikedSong(): Track {
        const currentTrackId = dataMgr.selectedTrackItem.id;
        const hasLikedSongs =
            dataMgr.spotifyLikedSongs && dataMgr.spotifyLikedSongs.length > 0;
        if (currentTrackId && hasLikedSongs) {
            let currTrackIndex = dataMgr.spotifyLikedSongs.findIndex(
                i => i.id === currentTrackId
            );
            if (currTrackIndex !== -1) {
                // if the curr track index is the last element, return zero, else return the next one
                if (currTrackIndex + 1 < dataMgr.spotifyLikedSongs.length) {
                    return dataMgr.spotifyLikedSongs[currTrackIndex + 1];
                } else {
                    return dataMgr.spotifyLikedSongs[0];
                }
            }
        } else if (!currentTrackId && hasLikedSongs) {
            return dataMgr.spotifyLikedSongs[0];
        }
        return null;
    }

    getPreviousSpotifyLikedSong(): Track {
        const currentTrackId = dataMgr.selectedTrackItem.id;
        const hasLikedSongs =
            dataMgr.spotifyLikedSongs && dataMgr.spotifyLikedSongs.length > 0;
        if (currentTrackId && hasLikedSongs) {
            const currTrackIndex = dataMgr.spotifyLikedSongs.findIndex(
                i => i.id === currentTrackId
            );
            if (currTrackIndex !== -1) {
                // if the curr track index is the last element, return zero, else return the next one
                if (currTrackIndex - 1 >= 0) {
                    return dataMgr.spotifyLikedSongs[currTrackIndex - 1];
                } else {
                    return dataMgr.spotifyLikedSongs[
                        dataMgr.spotifyLikedSongs.length - 1
                    ];
                }
            }
        }
        return null;
    }

    async fetchSavedPlaylists(serverIsOnline) {
        let playlists = [];
        if (serverIsOnline) {
            const response = await softwareGet(
                "/music/playlist/generated",
                getItem("jwt")
            );

            if (isResponseOk(response)) {
                // only return the non-deleted playlists
                for (let i = 0; i < response.data.length; i++) {
                    const savedPlaylist = response.data[i];
                    if (savedPlaylist && savedPlaylist["deleted"] !== 1) {
                        savedPlaylist.id = savedPlaylist.playlist_id;
                        savedPlaylist.playlistTypeId =
                            savedPlaylist.playlistTypeId;
                        delete savedPlaylist.playlist_id;
                        playlists.push(savedPlaylist);
                    }
                }
            }
        }
        dataMgr.savedPlaylists = playlists;
    }

    /**
     * These are the top productivity songs for this user
     */
    async syncUsersWeeklyTopSongs() {
        const response = await softwareGet(
            "/music/recommendations?limit=40",
            getItem("jwt")
        );

        if (isResponseOk(response) && response.data.length > 0) {
            dataMgr.userTopSongs = response.data;
        } else {
            // clear the favorites
            dataMgr.userTopSongs = [];
        }
    }

    async generateUsersWeeklyTopSongs() {
        if (dataMgr.buildingCustomPlaylist) {
            return;
        }
        const serverIsOnline = await serverIsAvailable();

        if (!serverIsOnline) {
            window.showInformationMessage(
                "Our service is temporarily unavailable, please try again later."
            );
            return;
        }

        if (requiresSpotifyAccess()) {
            // don't create or refresh, no spotify access provided
            return;
        }

        dataMgr.buildingCustomPlaylist = true;

        let customPlaylist: PlaylistItem = getMusicTimePlaylistByTypeId(
            PERSONAL_TOP_SONGS_PLID
        );

        const infoMsg = !customPlaylist
            ? `Creating and populating the ${PERSONAL_TOP_SONGS_NAME} playlist, please wait.`
            : `Refreshing the ${PERSONAL_TOP_SONGS_NAME} playlist, please wait.`;

        window.showInformationMessage(infoMsg);

        let playlistId = null;
        if (!customPlaylist) {
            const playlistResult: CodyResponse = await createPlaylist(
                PERSONAL_TOP_SONGS_NAME,
                true
            );

            const errMsg = getCodyErrorMessage(playlistResult);
            if (errMsg) {
                window.showErrorMessage(
                    `There was an unexpected error adding tracks to the playlist. ${errMsg} Refresh the playlist and try again if you feel the problem has been resolved.`,
                    ...[OK_LABEL]
                );
                dataMgr.buildingCustomPlaylist = false;
                return;
            }

            playlistId = playlistResult.data.id;

            await this.updateSavedPlaylists(
                playlistId,
                PERSONAL_TOP_SONGS_PLID,
                PERSONAL_TOP_SONGS_NAME
            ).catch(err => {
                logIt("Error updating music time with generated playlist ID");
            });
        } else {
            // get the spotify playlist id from the app's existing playlist info
            playlistId = customPlaylist.id;
        }

        // get the spotify track ids and create the playlist
        if (playlistId) {
            // sync the user's weekly top songs
            await this.syncUsersWeeklyTopSongs();

            // add the tracks
            // list of [{trackId, artist, name}...]
            if (dataMgr.userTopSongs && dataMgr.userTopSongs.length > 0) {
                let tracksToAdd: string[] = dataMgr.userTopSongs.map(item => {
                    if (item.uri) {
                        return item.uri;
                    } else if (item.trackId) {
                        return item.trackId;
                    }
                    return item.id;
                });

                if (!customPlaylist) {
                    await this.addTracks(
                        playlistId,
                        PERSONAL_TOP_SONGS_NAME,
                        tracksToAdd
                    );
                } else {
                    await replacePlaylistTracks(playlistId, tracksToAdd).catch(
                        err => {
                            logIt(`Error replacing tracks: ${err.message}`);
                        }
                    );

                    window.showInformationMessage(
                        `Successfully refreshed ${PERSONAL_TOP_SONGS_NAME}.`
                    );
                }
            } else {
                window.showInformationMessage(
                    `Successfully created ${PERSONAL_TOP_SONGS_NAME}, but we're unable to add any songs at the moment.`,
                    ...[OK_LABEL]
                );
            }
        }

        await this.fetchSavedPlaylists(serverIsOnline);

        // repopulate the spotify playlists
        await populateSpotifyPlaylists();

        commands.executeCommand("musictime.refreshPlaylist");

        // update building custom playlist to false
        dataMgr.buildingCustomPlaylist = false;
    }

    async addTracks(playlist_id: string, name: string, tracksToAdd: string[]) {
        if (playlist_id) {
            // create the playlist_id in software
            const addTracksResult: CodyResponse = await addTracksToPlaylist(
                playlist_id,
                tracksToAdd
            );

            if (addTracksResult.state === CodyResponseType.Success) {
                window.showInformationMessage(
                    `Successfully created ${name} and added tracks.`
                );
            } else {
                window.showErrorMessage(
                    `There was an unexpected error adding tracks to the playlist. ${addTracksResult.message}`,
                    ...[OK_LABEL]
                );
            }
        }
    }

    async updateSavedPlaylists(
        playlist_id: string,
        playlistTypeId: number,
        name: string
    ) {
        // playlistTypeId 1 = personal custom top 40
        const payload = {
            playlist_id,
            playlistTypeId,
            name
        };
        let jwt = getItem("jwt");
        let createResult = await softwarePost(
            "/music/playlist/generated",
            payload,
            jwt
        );

        return createResult;
    }

    async initializeSlack() {
        const serverIsOnline = await serverIsAvailable();
        if (serverIsOnline) {
            const slackOauth = await getSlackOauth(serverIsOnline);
            if (slackOauth) {
                // update the CodyMusic credentials
                this.updateSlackAccessInfo(slackOauth);
            } else {
                setItem("slack_access_token", null);
            }
        }
    }

    async updateSlackAccessInfo(slackOauth) {
        /**
         * {access_token, refresh_token}
         */
        if (slackOauth) {
            setItem("slack_access_token", slackOauth.access_token);
        } else {
            setItem("slack_access_token", null);
        }
    }

    async updateSpotifyAccessInfo(spotifyOauth) {
        if (spotifyOauth && spotifyOauth.access_token) {
            // update the CodyMusic credentials
            setItem("spotify_access_token", spotifyOauth.access_token);
            setItem("spotify_refresh_token", spotifyOauth.refresh_token);
            // update cody config
            dataMgr.updateCodyConfig();
            // get the user
            dataMgr.spotifyUser = await getUserProfile();
        } else {
            setItem("spotify_access_token", null);
            setItem("spotify_refresh_token", null);
            // update cody config
            dataMgr.updateCodyConfig();
            // update the spotify user to null
            dataMgr.spotifyUser = null;
        }
    }

    async initializeSpotify() {
        const serverIsOnline = await serverIsAvailable();

        // get the client id and secret
        let clientId = SPOTIFY_CLIENT_ID;
        let clientSecret = SPOTIFY_CLIENT_SECRET;
        if (serverIsOnline) {
            let jwt = getItem("jwt");
            if (!jwt) {
                jwt = await getAppJwt(serverIsOnline);
            }
            const resp = await softwareGet("/auth/spotify/clientInfo", jwt);
            if (isResponseOk(resp)) {
                // get the clientId and clientSecret
                clientId = resp.data.clientId;
                clientSecret = resp.data.clientSecret;
            }
        }

        dataMgr.spotifyClientId = clientId;
        dataMgr.spotifyClientSecret = clientSecret;

        dataMgr.updateCodyConfig();

        // update the user info
        await getMusicTimeUserStatus(serverIsOnline);

        // initialize the music player
        MusicCommandManager.initialize();
    }

    // reconcile. meaning the user may have deleted the lists our 2 buttons created;
    // global and custom.  We'll remove them from our db if we're unable to find a matching
    // playlist_id we have saved.
    async reconcilePlaylists(playlists: PlaylistItem[]) {
        for (let i = 0; i < dataMgr.savedPlaylists.length; i++) {
            const savedPlaylist = dataMgr.savedPlaylists[i];

            // find the saved playlist in the spotify playlist list
            let foundItem = playlists.find(element => {
                return element.id === savedPlaylist.id;
            });

            // the backend should protect this from deleting the global top 40
            // as we're unsure if the playlist we're about to reconcile/delete
            // is the custom playlist or global top 40
            if (!foundItem) {
                // remove it from the server
                await softwareDelete(
                    `/music/playlist/generated/${savedPlaylist.id}`,
                    getItem("jwt")
                );
            } else if (foundItem.name !== savedPlaylist.name) {
                // update the name on software
                const payload = {
                    name: foundItem.name
                };
                await softwarePut(
                    `/music/playlist/generated/${savedPlaylist.id}`,
                    payload,
                    getItem("jwt")
                );
            }
        }
    }

    async launchTrackPlayer(playerName: PlayerName = null) {
        // options.album_id or options.track_id
        const track_id = dataMgr.runningTrack ? dataMgr.runningTrack.id : null;

        // if the player name is null, this means all we want to do is launch the currently set player
        if (!playerName) {
            launchPlayer(dataMgr.currentPlayerName, {
                quietly: false,
                track_id
            });
            return;
        }

        // it's not null, this means we want to launch a player and we need to pause the other player
        if (dataMgr.currentPlayerName === PlayerName.ItunesDesktop) {
            // quit the mac player as the user is switching to spotify
            await quitMacPlayer(PlayerName.ItunesDesktop);
        } else {
            // pause the spotify song as they're switching to itunes
            const musicCtrlMgr: MusicControlManager = MusicControlManager.getInstance();
            musicCtrlMgr.pauseSong(false);
        }

        // update the current player type to what was selected
        dataMgr.currentPlayerName = playerName;

        if (playerName !== PlayerName.ItunesDesktop) {
            if (isMac()) {
                // just launch the desktop
                await launchPlayer(PlayerName.SpotifyDesktop);
            } else {
                // this will show a prompt as to why we're launching the web player
                await this.launchSpotifyPlayer();
            }
        } else {
            await launchPlayer(playerName);
        }

        setTimeout(async () => {
            if (playerName !== PlayerName.ItunesDesktop) {
                // transfer to the computer device
                await this.transferToComputerDevice();
            }
            // refresh to show the button labeling update
            commands.executeCommand("musictime.refreshPlaylist");
        }, 4000);
    }

    launchSpotifyPlayer() {
        window.showInformationMessage(
            `After you select and play your first song in Spotify, standard controls (play, pause, next, etc.) will appear in your status bar.`,
            ...[OK_LABEL]
        );
        setTimeout(() => {
            launchPlayer(PlayerName.SpotifyWeb);
        }, 3000);
    }

    async isLikedSong() {
        const playlistId = dataMgr.selectedPlaylist
            ? dataMgr.selectedPlaylist.id
            : null;
        const isLikedSong =
            playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME ? true : false;
        return isLikedSong;
    }

    hasSpotifyPlaybackAccess() {
        return dataMgr.spotifyUser && dataMgr.spotifyUser.product === "premium"
            ? true
            : false;
    }

    hasSpotifyUser() {
        return dataMgr.spotifyUser && dataMgr.spotifyUser.product
            ? true
            : false;
    }

    async isSpotifyPremium() {
        if (!dataMgr.spotifyUser && !requiresSpotifyAccess()) {
            dataMgr.spotifyUser = await getUserProfile();
        }
        return this.hasSpotifyUser() &&
            dataMgr.spotifyUser.product === "premium"
            ? true
            : false;
    }

    getPlayerNameForPlayback() {
        // if you're offline you may still have spotify desktop player abilities.
        // check if the current player is spotify and we don't have web access.
        // if no web access, then use the desktop player
        if (
            dataMgr.currentPlayerName !== PlayerName.ItunesDesktop &&
            isMac() &&
            !this.hasSpotifyPlaybackAccess()
        ) {
            return PlayerName.SpotifyDesktop;
        }
        return dataMgr.currentPlayerName;
    }

    async refreshRecommendations() {
        if (requiresSpotifyAccess()) {
            // update the recommended tracks to empty
            dataMgr.recommendationTracks = [];
            commands.executeCommand("musictime.refreshRecommendationsTree");
        } else if (dataMgr.currentRecMeta && dataMgr.currentRecMeta.label) {
            // use the current recommendation metadata and bump the offset
            this.updateRecommendations(
                dataMgr.currentRecMeta.label,
                dataMgr.currentRecMeta.likedSongSeedLimit,
                dataMgr.currentRecMeta.seed_genres,
                dataMgr.currentRecMeta.features,
                dataMgr.currentRecMeta.offset + 1
            );
        } else {
            // default to the similar liked songs recommendations
            this.updateRecommendations("Similar to Liked Songs", 5);
        }
    }

    async updateRecommendations(
        label: string,
        likedSongSeedLimit: number = 5,
        seed_genres: string[] = [],
        features: any = {},
        offset: number = 0
    ) {
        dataMgr.currentRecMeta = {
            label,
            likedSongSeedLimit,
            seed_genres,
            features,
            offset
        };
        const trackIds = await this.getTrackIdsForRecommendations(
            likedSongSeedLimit,
            offset
        );
        const tracks: Track[] = await this.getRecommendedTracks(
            trackIds,
            seed_genres,
            features
        );
        if (tracks && tracks.length > 0) {
            // sort them alpabeticaly
            sortTracks(tracks);
        }
        // set the manager's recommendation tracks
        dataMgr.recommendationTracks = tracks;
        dataMgr.recommendationLabel = label;

        // refresh the rec tree
        commands.executeCommand("musictime.refreshRecommendationsTree");
    }

    async getRecommendedTracks(
        trackIds,
        seed_genres,
        features
    ): Promise<Track[]> {
        try {
            return getRecommendationsForTracks(
                trackIds,
                10,
                "" /*market*/,
                20,
                100,
                seed_genres,
                [],
                features
            );
        } catch (e) {
            //
        }

        return [];
    }

    convertTracksToPlaylistItems(tracks: Track[]) {
        let items: PlaylistItem[] = [];

        if (!requiresSpotifyAccess()) {
            const labelButton = providerItemMgr.buildActionItem(
                "label",
                "label",
                null,
                PlayerType.NotAssigned,
                dataMgr.recommendationLabel,
                ""
            );
            labelButton.tag = "paw";

            if (tracks && tracks.length > 0) {
                // since we have recommendations, show the label button
                items.push(labelButton);
                for (let i = 0; i < tracks.length; i++) {
                    const track: Track = tracks[i];
                    const item: PlaylistItem = this.createPlaylistItemFromTrack(
                        track,
                        0
                    );
                    item.tag = "spotify";
                    item.type = "recommendation";
                    item["icon"] = "track.svg";
                    items.push(item);
                }
            }
        } else {
            // create the connect button
            items.push(
                providerItemMgr.getRecommendationConnectToSpotifyButton()
            );
        }
        return items;
    }

    async launchConfirm(devices: PlayerDevice[]) {
        // this will check if it needs to activate an inactive device
        devices = await this.activateIfDeviceIsInactive(devices);

        const isRunning = await this.isComputerDeviceRunning(devices);
        let playerName = this.getPlayerNameForPlayback();
        let isLaunching = false;
        let proceed = true;
        const isWin = isWindows();
        const isPrem = await this.isSpotifyPremium();

        // ask to show the desktop if they're a premium user
        let launchResult = null;
        let launchingDesktop = false;
        if (!isWin && !isRunning && isPrem) {
            // ask to launch
            const selectedButton = await window.showInformationMessage(
                `Music Time requires a running Spotify player. Choose a player to launch.`,
                ...["Web Player", "Desktop Player"]
            );
            if (!selectedButton) {
                // the user selected the close button
                window.showInformationMessage(
                    "You will need to open a Spotify player to control tracks from the editor."
                );
                proceed = false;
            } else {
                isLaunching = true;
                if (selectedButton === "Desktop Player") {
                    launchingDesktop = true;
                    // launch the desktop
                    playerName = PlayerName.SpotifyDesktop;
                }
                launchResult = await launchPlayer(playerName, {
                    quietly: false
                });
            }
        } else if (!isRunning) {
            if (isPrem) {
                playerName = PlayerName.SpotifyDesktop;
            }
            isLaunching = true;
            launchingDesktop = true;
            // it's a windows or non-premium user, launch spotify
            launchResult = await launchPlayer(playerName, {
                quietly: false
            });
        }

        if (launchingDesktop && launchResult && launchResult.error) {
            logIt(`Error launching desktop: ${launchResult.error}`);
        }

        // check to see if we've failed to launch the desktop player
        if (
            launchingDesktop &&
            launchResult &&
            launchResult.error &&
            playerName !== PlayerName.SpotifyWeb
        ) {
            // window.showInformationMessage(
            //     "Unable to launch the Spotify desktop player. Please confirm that it is installed."
            // );
            // launch the web player
            playerName = PlayerName.SpotifyWeb;
            await launchPlayer(PlayerName.SpotifyWeb);
            isLaunching = true;
        }

        const info = {
            isRunning,
            playerName,
            isLaunching,
            proceed
        };

        return info;
    }

    async followSpotifyPlaylist(playlist: PlaylistItem) {
        const codyResp: CodyResponse = await followPlaylist(playlist.id);
        if (codyResp.state === CodyResponseType.Success) {
            window.showInformationMessage(
                `Successfully following the '${playlist.name}' playlist.`
            );

            // repopulate the playlists since we've changed the state of the playlist
            await populateSpotifyPlaylists();

            commands.executeCommand("musictime.refreshPlaylist");
        } else {
            window.showInformationMessage(
                `Unable to follow ${playlist.name}. ${codyResp.message}`,
                ...[OK_LABEL]
            );
        }
    }

    async removeTrackFromPlaylist(trackItem: PlaylistItem) {
        // get the playlist it's in
        const currentPlaylistId = trackItem["playlist_id"];
        const foundPlaylist = await this.getPlaylistById(currentPlaylistId);
        if (foundPlaylist) {
            // if it's the liked songs, then send it to the setLiked(false) api
            if (foundPlaylist.id === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
                const buttonSelection = await window.showInformationMessage(
                    `Are you sure you would like to remove ${trackItem.name} from your '${SPOTIFY_LIKED_SONGS_PLAYLIST_NAME}' playlist`,
                    ...[YES_LABEL]
                );

                if (buttonSelection === YES_LABEL) {
                    let track: Track = new Track();
                    track.id = trackItem.id;
                    track.playerType = PlayerType.WebSpotify;
                    track.state = TrackStatus.NotAssigned;
                    await MusicControlManager.getInstance().setLiked(
                        false,
                        track
                    );
                    commands.executeCommand("musictime.refreshPlaylist");
                }
            }
        }
    }

    /**
     * Transfer to this device
     * @param computerDevice
     */
    async transferToComputerDevice(computerDevice: PlayerDevice = null) {
        const devices: PlayerDevice[] = await getSpotifyDevices();
        if (!computerDevice) {
            computerDevice =
                devices && devices.length > 0
                    ? devices.find(d => d.type.toLowerCase() === "computer")
                    : null;
        }
        if (computerDevice) {
            await playSpotifyDevice(computerDevice.id);
        }
    }

    /**
     * Check if there are devices found. If so and none are
     * active and any one of those is "Computer", then this
     * will attempt to transfer to this device
     * @param devices
     */
    async activateIfDeviceIsInactive(
        devices: PlayerDevice[] = []
    ): Promise<PlayerDevice[]> {
        if (!devices || devices.length === 0) {
            devices = await getSpotifyDevices();
        }

        if (!devices || devices.length === 0) {
            return [];
        }

        const activeDevice: PlayerDevice = devices.find(
            (device: PlayerDevice) => device.is_active
        );
        if (activeDevice) {
            return devices;
        }

        // no active devices, activate one
        const computerDevice: PlayerDevice = devices.find(
            (device: PlayerDevice) => device.type.toLowerCase() === "computer"
        );
        if (computerDevice) {
            await this.transferToComputerDevice(computerDevice);
            return await getSpotifyDevices();
        }
        return devices;
    }

    async isComputerDeviceRunning(devices: PlayerDevice[]) {
        // let isRunning = await isSpotifyRunning();

        const computerDevice =
            devices && devices.length > 0
                ? devices.find(
                      (d: PlayerDevice) => d.type.toLowerCase() === "computer"
                  )
                : null;
        /**
            i.e.
            [{id:"1664aa46e86f1d3b37826bab098d45fe6eff8477"
            is_active:true,
            is_private_session:false,
            is_restricted:false,
            name:"Xavier Luiz’s iPhone",
            type:"Smartphone",
            volume_percent:100},
            {id:"4ca1a306c33fe36fc94c024db64a72702224dd9e",
            is_active:true,
            is_private_session:false,
            is_restricted:false,
            name:"Web Player (Chrome)",
            type:"Computer",
            volume_percent:100},
            {id:"5e3111564c58047aae060fe9bc13e8b90fc1c613",
            is_active:true,
            is_private_session:false,
            is_restricted:false,
            name:"Xavier’s MacBook Pro",
            type:"Computer",
            volume_percent:100}]
        */
        const isRunning = computerDevice ? true : false;
        return isRunning;
    }

    async getTrackIdsForRecommendations(
        likedSongSeedLimit: number = 5,
        offset: number = 0
    ) {
        let trackIds = [];
        let trackRecs = dataMgr.trackIdsForRecommendations || [];

        if (trackRecs.length === 0) {
            // call the music util to populate the rec track ids
            await buildTracksForRecommendations(dataMgr.spotifyPlaylists);
            trackRecs = dataMgr.trackIdsForRecommendations || [];
        }

        if (trackRecs.length > 0) {
            for (let i = 0; i < likedSongSeedLimit; i++) {
                if (trackRecs.length > offset) {
                    trackIds.push(trackRecs[offset]);
                } else {
                    // start the offset back to the begining
                    offset = 0;
                    trackIds.push(trackRecs[offset]);
                }
                offset++;
            }
        }
        return trackIds;
    }

    async isTrackRepeating(): Promise<boolean> {
        // get the current repeat state
        const spotifyContext: PlayerContext = await getSpotifyPlayerContext();
        // "off", "track", "context", ""
        const repeatState = spotifyContext ? spotifyContext.repeat_state : "";

        return repeatState && repeatState === "track" ? true : false;
    }

    async getPlaylistTrackState(playlistId): Promise<TrackStatus> {
        let playlistItemTracks: PlaylistItem[] =
            dataMgr.playlistTrackMap[playlistId];
        if (!playlistItemTracks || playlistItemTracks.length === 0) {
            playlistItemTracks = await this.getPlaylistItemTracksForPlaylistId(
                playlistId
            );
        }

        if (playlistItemTracks && playlistItemTracks.length > 0) {
            for (let i = 0; i < playlistItemTracks.length; i++) {
                const track: PlaylistItem = playlistItemTracks[i];
                // check to see if this track is the current track
                if (dataMgr.runningTrack.id === track.id) {
                    return dataMgr.runningTrack.state;
                }
            }
        }
        return TrackStatus.NotAssigned;
    }
}
