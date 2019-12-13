import {
    PlaylistItem,
    PlayerType,
    PlayerName,
    getPlaylists,
    TrackStatus,
    Track,
    CodyResponse,
    getPlaylistTracks,
    PaginationItem,
    CodyResponseType,
    getSpotifyLikedSongs,
    PlaylistTrackInfo,
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
    getSpotifyPlaylist
} from "cody-music";
import {
    PERSONAL_TOP_SONGS_NAME,
    PERSONAL_TOP_SONGS_PLID,
    REFRESH_CUSTOM_PLAYLIST_TITLE,
    GENERATE_CUSTOM_PLAYLIST_TITLE,
    REFRESH_CUSTOM_PLAYLIST_TOOLTIP,
    GENERATE_CUSTOM_PLAYLIST_TOOLTIP,
    SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
    SOFTWARE_TOP_40_PLAYLIST_ID,
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SHOW_ITUNES_LAUNCH_BUTTON,
    OK_LABEL
} from "../Constants";
import { commands, window } from "vscode";
import {
    serverIsAvailable,
    getSlackOauth,
    getAppJwt,
    getMusicTimeUserStatus
} from "../DataController";
import { getItem, setItem, isMac, logIt } from "../Util";
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
import { PlaylistManager } from "./PlaylistManager";

export class MusicManager {
    private static instance: MusicManager;

    private _itunesPlaylists: PlaylistItem[] = [];
    private _spotifyPlaylists: PlaylistItem[] = [];
    private _playlistMap: {} = {};
    private _savedPlaylists: PlaylistItem[] = [];
    private _musictimePlaylists: PlaylistItem[] = [];
    private _userTopSongs: any[] = [];
    private _playlistTrackMap: any = {};
    private _runningTrack: Track = new Track();
    private _spotifyLikedSongs: Track[] = [];
    // default to starting with spotify
    private _currentPlayerName: PlayerName = PlayerName.SpotifyWeb;
    private _selectedTrackItem: PlaylistItem = null;
    private _selectedPlaylist: PlaylistItem = null;
    private _spotifyUser: SpotifyUser = null;
    private _buildingPlaylists: boolean = false;
    private _serverTrack: any = null;
    private _buildingCustomPlaylist: boolean = false;
    private _spotifyClientId: string = "";
    private _spotifyClientSecret: string = "";
    private _initialized: boolean = false;
    private _sortAlphabetically: boolean = true;
    private _recommendationTracks: Track[] = [];

    private constructor() {
        //
    }
    static getInstance(): MusicManager {
        if (!MusicManager.instance) {
            MusicManager.instance = new MusicManager();
        }

        return MusicManager.instance;
    }

    set initialized(initializedMgr: boolean) {
        this._initialized = initializedMgr;
    }

    get initialized() {
        return this._initialized;
    }

    get musictimePlaylists() {
        return this._musictimePlaylists;
    }

    get buildingPlaylists() {
        return this._buildingPlaylists;
    }

    set runningTrack(track: Track) {
        this._runningTrack = track;
    }

    get runningTrack(): Track {
        return this._runningTrack;
    }

    get savedPlaylists(): PlaylistItem[] {
        return this._savedPlaylists;
    }

    get userTopSongs(): PlaylistItem[] {
        return this._userTopSongs;
    }

    get spotifyUser(): SpotifyUser {
        return this._spotifyUser;
    }

    set spotifyUser(user: SpotifyUser) {
        this._spotifyUser = user;
    }

    get selectedPlaylist(): PlaylistItem {
        return this._selectedPlaylist;
    }

    set selectedPlaylist(playlist: PlaylistItem) {
        this._selectedPlaylist = playlist;
    }

    get selectedTrackItem(): PlaylistItem {
        return this._selectedTrackItem;
    }

    set selectedTrackItem(trackItem: PlaylistItem) {
        this._selectedTrackItem = trackItem;
    }

    get sortAlphabetically() {
        return this._sortAlphabetically;
    }

    set sortAlphabetically(sortAlpha: boolean) {
        this._sortAlphabetically = sortAlpha;
    }

    get spotifyLikedSongs() {
        return this._spotifyLikedSongs;
    }

    set spotifyLikedSongs(likedSongs: Track[]) {
        this._spotifyLikedSongs = likedSongs;
    }

    get recommendationTracks() {
        return this._recommendationTracks;
    }

    set recommendationTracks(recTracks: Track[]) {
        this._recommendationTracks = recTracks;
    }

    /**
     * Get the current player: spotify-web or itunes
     */
    get currentPlayerName(): PlayerName {
        return this._currentPlayerName;
    }

    set currentPlayerName(playerName: PlayerName) {
        // override any calls setting this to spotify desktop back to spotify-web
        if (playerName === PlayerName.SpotifyDesktop) {
            playerName = PlayerName.SpotifyWeb;
        }

        // check if it's change in player type
        const shouldUpdateCodyConfig =
            playerName !== this._currentPlayerName ? true : false;
        this._currentPlayerName = playerName;

        // if it's a player type change, update cody config so it
        // can disable the other player until it is selected
        if (shouldUpdateCodyConfig) {
            this.updateCodyConfig();
        }
    }

    get serverTrack(): any {
        return this._serverTrack;
    }

    set serverTrack(track: any) {
        this._serverTrack = track;
    }

    get currentPlaylists(): PlaylistItem[] {
        if (this._currentPlayerName === PlayerName.ItunesDesktop) {
            return this._itunesPlaylists;
        }
        return this._spotifyPlaylists;
    }

    get spotifyPlaylists(): PlaylistItem[] {
        return this._spotifyPlaylists;
    }

    //
    // Clear all of the playlists and tracks
    //
    clearPlaylists() {
        this._itunesPlaylists = [];
        this._spotifyPlaylists = [];
        this._playlistMap = {};
        this._musictimePlaylists = [];
        this._playlistTrackMap = {};
    }

    clearSavedPlaylists() {
        this._savedPlaylists = [];
    }

    clearSpotify() {
        this._spotifyPlaylists = [];
        this._playlistMap = {};
        this._playlistTrackMap = {};
    }

    async refreshPlaylists() {
        if (this._buildingPlaylists) {
            return;
        }
        this._buildingPlaylists = true;

        let serverIsOnline = await serverIsAvailable();

        if (this.currentPlayerName === PlayerName.ItunesDesktop) {
            await this.showItunesPlaylists(serverIsOnline);
        } else {
            await this.showSpotifyPlaylists(serverIsOnline);
        }
        await MusicCommandManager.syncControls(this._runningTrack);

        this._buildingPlaylists = false;
    }

    getPlaylistById(playlist_id: string) {
        return this._playlistMap[playlist_id];
    }

    /**
     * Update the cody config settings for cody-music
     */
    updateCodyConfig() {
        const accessToken = getItem("spotify_access_token");
        const refreshToken = getItem("spotify_refresh_token");

        const codyConfig: CodyConfig = new CodyConfig();
        codyConfig.enableItunesDesktop = false;
        codyConfig.enableItunesDesktopSongTracking = isMac();
        codyConfig.enableSpotifyDesktop = isMac();
        codyConfig.spotifyClientId = this._spotifyClientId;
        codyConfig.spotifyAccessToken = accessToken;
        codyConfig.spotifyRefreshToken = refreshToken;
        codyConfig.spotifyClientSecret = this._spotifyClientSecret;
        setConfig(codyConfig);
    }

    async refreshPlaylistState() {
        const type =
            this.currentPlayerName === PlayerName.ItunesDesktop
                ? "itunes"
                : "spotify";
        if (type === "spotify" && this._spotifyPlaylists.length > 0) {
            // build the spotify playlist
            this._spotifyPlaylists.forEach(async playlist => {
                let playlistItemTracks: PlaylistItem[] = this._playlistTrackMap[
                    playlist.id
                ];

                if (playlistItemTracks && playlistItemTracks.length > 0) {
                    let playlistState = await this.getPlaylistState(
                        playlist.id
                    );
                    playlist.state = playlistState;
                }
            });
        } else if (type === "itunes" && this._itunesPlaylists.length > 0) {
            // build the itunes playlist
            this._itunesPlaylists.forEach(async playlist => {
                let playlistItemTracks: PlaylistItem[] = this._playlistTrackMap[
                    playlist.id
                ];

                if (playlistItemTracks && playlistItemTracks.length > 0) {
                    let playlistState = await this.getPlaylistState(
                        playlist.id
                    );
                    playlist.state = playlistState;
                }
            });
        }
    }

    private async showItunesPlaylists(serverIsOnline) {
        let foundPlaylist = this._itunesPlaylists.find(element => {
            return element.type === "playlist";
        });

        // if no playlists are found for itunes, then fetch
        if (!foundPlaylist) {
            await this.refreshPlaylistForPlayer(serverIsOnline);
        }
    }

    private async showSpotifyPlaylists(serverIsOnline) {
        // if no playlists are found for spotify, then fetch
        let foundPlaylist = this._spotifyPlaylists.find(element => {
            return element.type === "playlist";
        });
        if (!foundPlaylist) {
            await this.refreshPlaylistForPlayer(serverIsOnline);
        }
    }

    //
    // Fetch the playlist names for a specific player
    //
    private async refreshPlaylistForPlayer(serverIsOnline: boolean) {
        const playerName = this.currentPlayerName;
        let items: PlaylistItem[] = [];

        const needsSpotifyAccess = this.requiresSpotifyAccess();
        const hasSpotifyUser = this.hasSpotifyUser();
        const isSpotifyPremium = this.isSpotifyPremium();

        const type =
            playerName === PlayerName.ItunesDesktop ? "itunes" : "spotify";

        // Do they have spotify playback control?
        const allowSpotifyPlaylistFetch = !needsSpotifyAccess && hasSpotifyUser;

        // is this a non premium connected spotify user?
        const isNonPremiumConnectedSpotify =
            allowSpotifyPlaylistFetch && !isSpotifyPremium;

        // fetch the playlists
        let playlists: PlaylistItem[] = [];
        if (!needsSpotifyAccess) {
            playlists = await getPlaylists(playerName, { all: true });
        }

        // fetch the saved playlists from software app
        if (this._savedPlaylists.length === 0 && !needsSpotifyAccess) {
            await this.fetchSavedPlaylists(serverIsOnline);
        }

        // reconcile in case the fetched playlists don't contain
        // one we've generated, or the name has changed
        if (
            serverIsOnline &&
            !needsSpotifyAccess &&
            playerName === PlayerName.SpotifyWeb &&
            this._savedPlaylists.length > 0 &&
            playlists.length > 0
        ) {
            await this.reconcilePlaylists(playlists);
        }

        // sort
        if (this.sortAlphabetically) {
            this.sortPlaylists(playlists);
        }

        // go through each playlist and find out it's state
        if (playlists && playlists.length > 0) {
            for (let i = 0; i < playlists.length; i++) {
                let playlist = playlists[i];
                this._playlistMap[playlist.id] = playlist;
                let playlistItemTracks: PlaylistItem[] = this._playlistTrackMap[
                    playlist.id
                ];

                if (playlistItemTracks && playlistItemTracks.length > 0) {
                    let playlistState = await this.getPlaylistState(
                        playlist.id
                    );
                    playlist.state = playlistState;
                }
                playlist.itemType = "playlist";
                playlist.tag = type;
            }
        }

        // filter out the music time playlists into it's own list if we have any
        this.retrieveMusicTimePlaylist(playlists);

        // if itunes, show the itunes connected button
        if (playerName === PlayerName.ItunesDesktop) {
            // add the action items specific to itunes
            items.push(this.getItunesConnectedButton());
        } else if (allowSpotifyPlaylistFetch && hasSpotifyUser) {
            // show the spotify connected button if we allow playlist fetch
            items.push(this.getSpotifyConnectedButton());
        }

        // add the no music time connection button if we're not online
        if (!serverIsOnline && !needsSpotifyAccess && hasSpotifyUser) {
            items.push(this.getNoMusicTimeConnectionButton());
        }

        if (!needsSpotifyAccess && !hasSpotifyUser && type === "spotify") {
            // show that we're unable to connect to spotify at the moment
            items.push(this.getNoSpotifyConnectionButton());
        }

        // show the spotify connect premium button if they're connected and a non-premium account
        if (isNonPremiumConnectedSpotify) {
            // show the spotify premium account required button
            items.push(this.getSpotifyPremiumAccountRequiredButton());
        }

        // add the connect to spotify if they still need to connect
        if (needsSpotifyAccess) {
            items.push(this.getConnectToSpotifyButton());
        }

        if (playerName === PlayerName.ItunesDesktop) {
            // add the action items specific to itunes
            items.push(this.getSwitchToSpotifyButton());

            if (playlists.length > 0) {
                items.push(this.getLineBreakButton());
            }

            playlists.forEach(item => {
                items.push(item);
            });

            this._itunesPlaylists = items;
        } else {
            // show the devices listening folder if they've already connected oauth
            if (!needsSpotifyAccess && hasSpotifyUser) {
                const {
                    title,
                    tooltip,
                    loggedIn
                } = await this.getActiveSpotifyDevicesTitleAndTooltip();
                const devicesFoundButton = this.createSpotifyDevicesButton(
                    title,
                    tooltip,
                    loggedIn
                );
                items.push(devicesFoundButton);
            }

            if (isMac() && SHOW_ITUNES_LAUNCH_BUTTON) {
                items.push(this.getSwitchToItunesButton());
            }

            if (!needsSpotifyAccess) {
                items.push(this.getWebAnalyticsButton());
            }

            // line break between actions and software playlist section
            items.push(this.getLineBreakButton());

            // get the custom playlist button
            if (serverIsOnline && allowSpotifyPlaylistFetch) {
                const customPlaylistButton: PlaylistItem = this.getCustomPlaylistButton();
                if (customPlaylistButton) {
                    items.push(customPlaylistButton);
                }
            }

            // get the Software Top 40 Playlist
            const softwareTop40: PlaylistItem = await getSpotifyPlaylist(
                SOFTWARE_TOP_40_PLAYLIST_ID
            );
            if (softwareTop40 && softwareTop40.id) {
                softwareTop40.itemType = "playlist";
                softwareTop40.tag = "paw";
                // add it to music time playlist
                items.push(softwareTop40);
            }

            // Add the AI generated playlist
            if (
                this._musictimePlaylists &&
                this._musictimePlaylists.length > 0
            ) {
                for (let i = 0; i < this._musictimePlaylists.length; i++) {
                    const musicTimePlaylist = this._musictimePlaylists[i];
                    if (
                        musicTimePlaylist.playlistTypeId ===
                        PERSONAL_TOP_SONGS_PLID
                    ) {
                        items.push(musicTimePlaylist);
                    }
                }
            }

            // add Liked Songs folder within the software playlist section
            if (!needsSpotifyAccess && allowSpotifyPlaylistFetch) {
                // only add the "Liked Songs" playlist if there are tracks found in that playlist
                this.spotifyLikedSongs = await getSpotifyLikedSongs();
                if (
                    this.spotifyLikedSongs &&
                    this.spotifyLikedSongs.length > 0
                ) {
                    items.push(this.getSpotifyLikedPlaylistFolder());

                    // refresh the recommendation tracks
                    if (this.recommendationTracks.length === 0) {
                        commands.executeCommand(
                            "musictime.refreshRecommendations"
                        );
                    }
                }
            }

            // line break between software playlist section and normal playlists
            if (playlists.length > 0) {
                items.push(this.getLineBreakButton());
            }

            // normal playlists
            playlists.forEach(item => {
                items.push(item);
            });

            this._spotifyPlaylists = items;

            await PlaylistManager.getInstance().checkForDups();
        }
    }

    sortPlaylists(playlists) {
        if (playlists && playlists.length > 0) {
            playlists.sort((a: PlaylistItem, b: PlaylistItem) => {
                const nameA = a.name.toLowerCase(),
                    nameB = b.name.toLowerCase();
                if (nameA < nameB)
                    //sort string ascending
                    return -1;
                if (nameA > nameB) return 1;
                return 0; //default return value (no sorting)
            });
        }
    }

    getSpotifyLikedPlaylistFolder() {
        const item: PlaylistItem = new PlaylistItem();
        item.type = "playlist";
        item.id = SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
        item.tracks = new PlaylistTrackInfo();
        // set set a number so it shows up
        item.tracks.total = 1;
        item.playerType = PlayerType.WebSpotify;
        item.tag = "spotify-liked-songs";
        item.itemType = "playlist";
        item.name = SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
        return item;
    }

    getNoMusicTimeConnectionButton() {
        return this.buildActionItem(
            "offline",
            "offline",
            null,
            PlayerType.NotAssigned,
            "Music Time Offline",
            "Unable to connect to Music Time"
        );
    }

    getNoSpotifyConnectionButton() {
        return this.buildActionItem(
            "offline",
            "offline",
            null,
            PlayerType.NotAssigned,
            "Go Online To Load Playlists",
            "Unable to connect to Spotify"
        );
    }

    getSpotifyConnectedButton() {
        return this.buildActionItem(
            "spotifyconnected",
            "connected",
            null,
            PlayerType.WebSpotify,
            "Spotify Connected",
            "You've connected Spotify"
        );
    }

    getSpotifyPremiumAccountRequiredButton() {
        return this.buildActionItem(
            "spotifypremium",
            "action",
            "musictime.spotifyPremiumRequired",
            PlayerType.NotAssigned,
            "Spotify Premium Required",
            "Connect to your premium Spotify account to use the play, pause, next, and previous controls"
        );
    }

    getSpotifyConnectPremiumButton() {
        return this.buildActionItem(
            "spotifypremium",
            "action",
            "musictime.connectSpotify",
            PlayerType.NotAssigned,
            "Connect Premium",
            "Connect to your premium Spotify account to use the play, pause, next, and previous controls"
        );
    }

    getItunesConnectedButton() {
        return this.buildActionItem(
            "itunesconnected",
            "connected",
            null,
            PlayerType.MacItunesDesktop,
            "iTunes Connected",
            "You've connected iTunes"
        );
    }

    getConnectToSpotifyButton() {
        return this.buildActionItem(
            "connectspotify",
            "spotify",
            "musictime.connectSpotify",
            PlayerType.WebSpotify,
            "Connect Spotify",
            "Connect Spotify to view your playlists"
        );
    }

    getSwitchToSpotifyButton() {
        return this.buildActionItem(
            "title",
            "spotify",
            "musictime.launchSpotify",
            PlayerType.WebSpotify,
            "Launch Spotify"
        );
    }

    getSwitchToItunesButton() {
        return this.buildActionItem(
            "title",
            "itunes",
            "musictime.launchItunes",
            PlayerType.MacItunesDesktop,
            "Launch iTunes"
        );
    }

    createSpotifyDevicesButton(title, tooltip, loggedIn) {
        const button = this.buildActionItem(
            "title",
            "spotify",
            null,
            PlayerType.WebSpotify,
            title,
            tooltip
        );
        button.tag = loggedIn ? "active" : "disabled";
        return button;
    }

    getLineBreakButton() {
        return this.buildActionItem(
            "title",
            "divider",
            null,
            PlayerType.NotAssigned,
            "",
            ""
        );
    }

    buildActionItem(
        id,
        type,
        command,
        playerType: PlayerType,
        name,
        tooltip = "",
        itemType: string = "",
        callback: any = null
    ) {
        let item: PlaylistItem = new PlaylistItem();
        item.tracks = new PlaylistTrackInfo();
        item.type = type;
        item.id = id;
        item.command = command;
        item["cb"] = callback;
        item.playerType = playerType;
        item.name = name;
        item.tooltip = tooltip;
        item.itemType = itemType;

        return item;
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
                if (playlistItem.id === this._runningTrack.id) {
                    return this._runningTrack.state;
                } else {
                    // update theis track status to not assigned to ensure it's also updated
                    playlistItem.state = TrackStatus.NotAssigned;
                }
            }
        }

        return playlistState;
    }

    async getActiveSpotifyDevicesTitleAndTooltip() {
        const devices = await getSpotifyDevices();
        let inactiva_devices_names = [];
        if (devices && devices.length > 0) {
            for (let i = 0; i < devices.length; i++) {
                const device: PlayerDevice = devices[i];
                if (device.is_active) {
                    // done, found an active device
                    return {
                        title: `Listening on ${device.name}`,
                        tooltip: "Spotify devices available",
                        loggedIn: true
                    };
                } else {
                    inactiva_devices_names.push(device.name);
                }
            }
        }

        if (inactiva_devices_names.length > 0) {
            return {
                title: `Available on ${inactiva_devices_names.join(", ")}`,
                tooltip:
                    "Spotify devices detected but are not currently active",
                loggedIn: true
            };
        }

        return {
            title: "No Devices Detected",
            tooltip:
                "No Spotify devices detected, you may need to login to your player",
            loggedIn: false
        };
    }

    clearPlaylistTracksForId(playlist_id) {
        this._playlistTrackMap[playlist_id] = null;
    }

    //
    // Fetch the tracks for a given playlist ID
    //
    async getPlaylistItemTracksForPlaylistId(
        playlist_id: string
    ): Promise<PlaylistItem[]> {
        let playlistItemTracks: PlaylistItem[] = this._playlistTrackMap[
            playlist_id
        ];

        if (!playlistItemTracks || playlistItemTracks.length === 0) {
            if (this._currentPlayerName === PlayerName.ItunesDesktop) {
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
                        this._spotifyLikedSongs
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
            this._playlistTrackMap[playlist_id] = playlistItemTracks;
        }

        if (playlistItemTracks && playlistItemTracks.length > 0) {
            for (let i = 0; i < playlistItemTracks.length; i++) {
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

    createPlaylistItemFromTrack(track: Track, position: number) {
        let playlistItem: PlaylistItem = new PlaylistItem();
        playlistItem.type = "track";
        playlistItem.name = track.name;
        playlistItem.id = track.id;
        playlistItem.uri = track.uri;
        playlistItem.popularity = track.popularity;
        playlistItem.position = position;
        playlistItem.artist = track.artist;
        playlistItem.playerType = track.playerType;
        playlistItem.itemType = "track";

        delete playlistItem.tracks;

        if (track.id === this._runningTrack.id) {
            playlistItem.state = this._runningTrack.state;
            this._selectedTrackItem = playlistItem;
        } else {
            playlistItem.state = TrackStatus.NotAssigned;
        }
        return playlistItem;
    }

    requiresSpotifyAccess() {
        let spotifyAccessToken = getItem("spotify_access_token");
        return spotifyAccessToken ? false : true;
    }

    getWebAnalyticsButton() {
        // See web analytics
        let listItem: PlaylistItem = new PlaylistItem();
        listItem.tracks = new PlaylistTrackInfo();
        listItem.type = "action";
        listItem.tag = "paw";
        listItem.id = "launchmusicanalytics";
        listItem.command = "musictime.launchAnalytics";
        listItem.playerType = PlayerType.WebSpotify;
        listItem.name = "See web analytics";
        listItem.tooltip = "See music analytics in the web app";
        return listItem;
    }

    // get the custom playlist button by checkinf if the custom playlist
    // exists or not. if it doesn't exist then it will show the create label,
    // otherwise, it will show the refresh label
    getCustomPlaylistButton() {
        // update the existing playlist that matches the personal playlist with a paw if found
        const customPlaylist = this.getMusicTimePlaylistByTypeId(
            PERSONAL_TOP_SONGS_PLID
        );

        const personalPlaylistLabel = !customPlaylist
            ? GENERATE_CUSTOM_PLAYLIST_TITLE
            : REFRESH_CUSTOM_PLAYLIST_TITLE;
        const personalPlaylistTooltip = !customPlaylist
            ? GENERATE_CUSTOM_PLAYLIST_TOOLTIP
            : REFRESH_CUSTOM_PLAYLIST_TOOLTIP;

        if (
            this.currentPlayerName !== PlayerName.ItunesDesktop &&
            !this.requiresSpotifyAccess()
        ) {
            // add the connect spotify link
            let listItem: PlaylistItem = new PlaylistItem();
            listItem.tracks = new PlaylistTrackInfo();
            listItem.type = "action";
            listItem.tag = "action";
            listItem.id = "codingfavorites";
            listItem.command = "musictime.generateWeeklyPlaylist";
            listItem.playerType = PlayerType.WebSpotify;
            listItem.name = personalPlaylistLabel;
            listItem.tooltip = personalPlaylistTooltip;
            return listItem;
        }
        return null;
    }

    /**
     * Checks if the user's spotify playlists contains either
     * the global top 40 or the user's coding favorites playlist.
     * The playlistTypeId is used to match the set ID from music time
     * app. 1 = user's coding favorites, 2 = global top 40
     */
    getMusicTimePlaylistByTypeId(playlistTypeId: number) {
        if (this._musictimePlaylists.length > 0) {
            for (let i = 0; i < this._musictimePlaylists.length; i++) {
                const playlist = this._musictimePlaylists[i];
                const typeId = playlist.playlistTypeId;
                if (typeId === playlistTypeId) {
                    return playlist;
                }
            }
        }
        return null;
    }

    /**
     * Checks if the user's spotify playlists contains either
     * the global top 40 or the user's coding favorites playlist.
     * The playlistTypeId is used to match the set ID from music time
     * app. 1 = user's coding favorites, 2 = global top 40
     */
    retrieveMusicTimePlaylist(playlists: PlaylistItem[]) {
        this._musictimePlaylists = [];
        if (this._savedPlaylists.length > 0 && playlists.length > 0) {
            for (let i = 0; i < this._savedPlaylists.length; i++) {
                let savedPlaylist: PlaylistItem = this._savedPlaylists[i];
                let savedPlaylistTypeId = savedPlaylist.playlistTypeId;

                for (let x = playlists.length - 1; x >= 0; x--) {
                    let playlist = playlists[x];
                    if (playlist.id === savedPlaylist.id) {
                        playlist.playlistTypeId = savedPlaylistTypeId;
                        playlist.tag = "paw";
                        playlists.splice(x, 1);
                        this._musictimePlaylists.push(playlist);
                        break;
                    }
                }
            }
        }
    }

    /**
     * Return the next Spotify Track from the Liked Songs list.
     * It will return null if the Liked Songs list doesn't exist or the current track ID is not assigned.
     * It will return the 1st track if the current track ID is not assigned and the Liked Songs list exists.
     */
    getNextSpotifyLikedSong(): Track {
        const currentTrackId = this.selectedTrackItem.id;
        const hasLikedSongs =
            this._spotifyLikedSongs && this._spotifyLikedSongs.length > 0;
        if (currentTrackId && hasLikedSongs) {
            let currTrackIndex = this._spotifyLikedSongs.findIndex(
                i => i.id === currentTrackId
            );
            if (currTrackIndex !== -1) {
                // if the curr track index is the last element, return zero, else return the next one
                if (currTrackIndex + 1 < this._spotifyLikedSongs.length) {
                    return this._spotifyLikedSongs[currTrackIndex + 1];
                } else {
                    return this._spotifyLikedSongs[0];
                }
            }
        } else if (!currentTrackId && hasLikedSongs) {
            return this._spotifyLikedSongs[0];
        }
        return null;
    }

    async fetchSavedPlaylists(serverIsOnline) {
        let playlists = [];
        if (serverIsOnline) {
            const response = await softwareGet(
                "/music/generatedPlaylist",
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
        this._savedPlaylists = playlists;
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
            this._userTopSongs = response.data;
        } else {
            // clear the favorites
            this._userTopSongs = [];
        }
    }

    async generateUsersWeeklyTopSongs() {
        if (this._buildingCustomPlaylist) {
            return;
        }
        const serverIsOnline = await serverIsAvailable();

        if (!serverIsOnline) {
            window.showInformationMessage(
                "Our service is temporarily unavailable, please try again later."
            );
            return;
        }

        window.showInformationMessage(
            `Creating and populating the ${PERSONAL_TOP_SONGS_NAME} playlist, please wait.`
        );

        if (this.requiresSpotifyAccess()) {
            // don't create or refresh, no spotify access provided
            return;
        }

        this._buildingCustomPlaylist = true;

        let customPlaylist = this.getMusicTimePlaylistByTypeId(
            PERSONAL_TOP_SONGS_PLID
        );

        let playlistId = null;
        if (!customPlaylist) {
            let playlistResult: CodyResponse = await createPlaylist(
                PERSONAL_TOP_SONGS_NAME,
                true
            );

            if (playlistResult.state === CodyResponseType.Failed) {
                // format the message
                let errMsg = "";
                if (playlistResult.message) {
                    errMsg = playlistResult.message;
                    var hasEndingPeriod =
                        errMsg.lastIndexOf(".") === errMsg.length - 1;
                    if (!hasEndingPeriod) {
                        errMsg = `${errMsg}.`;
                    }
                }
                window.showErrorMessage(
                    `There was an unexpected error adding tracks to the playlist. ${errMsg} Refresh the playlist and try again if you feel the problem has been resolved.`,
                    ...[OK_LABEL]
                );
                this._buildingCustomPlaylist = false;
                return;
            }

            playlistId = playlistResult.data.id;

            await this.updateSavedPlaylists(
                playlistId,
                1,
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
            if (this._userTopSongs && this._userTopSongs.length > 0) {
                let tracksToAdd: string[] = this._userTopSongs.map(item => {
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
                            // logIt(
                            //     `Error replacing tracks, error: ${err.message}`
                            // );
                        }
                    );

                    window.showInformationMessage(
                        `Successfully refreshed ${PERSONAL_TOP_SONGS_NAME}.`,
                        ...[OK_LABEL]
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

        commands.executeCommand("musictime.refreshPlaylist");

        // update building custom playlist to false
        this._buildingCustomPlaylist = false;
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
                    `Successfully created ${name} and added tracks.`,
                    ...[OK_LABEL]
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
            "/music/generatedPlaylist",
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
        if (spotifyOauth) {
            // update the CodyMusic credentials
            setItem("spotify_access_token", spotifyOauth.access_token);
            setItem("spotify_refresh_token", spotifyOauth.refresh_token);

            // update cody config
            this.updateCodyConfig();

            // get the user
            this.spotifyUser = await getUserProfile();
        } else {
            this.clearSpotifyAccessInfo();
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

        this._spotifyClientId = clientId;
        this._spotifyClientSecret = clientSecret;

        // update the user info
        await getMusicTimeUserStatus(serverIsOnline);

        this.updateCodyConfig();

        // initialize the music player
        MusicCommandManager.initialize();

        this.initialized = true;

        commands.executeCommand("musictime.refreshPlaylist");
    }

    async clearSpotifyAccessInfo() {
        setItem("spotify_access_token", null);
        setItem("spotify_refresh_token", null);
        this.spotifyUser = null;

        // update cody config
        this.updateCodyConfig();
    }

    deleteSavedPlaylists() {
        if (this._savedPlaylists && this._savedPlaylists.length > 0) {
            this._savedPlaylists.map(async savedPlaylist => {
                // delete
                await softwareDelete(
                    `/music/generatedPlaylist/${savedPlaylist.id}`,
                    getItem("jwt")
                );
            });
        }
    }

    // reconcile. meaning the user may have deleted the lists our 2 buttons created;
    // global and custom.  We'll remove them from our db if we're unable to find a matching
    // playlist_id we have saved.
    async reconcilePlaylists(playlists: PlaylistItem[]) {
        for (let i = 0; i < this._savedPlaylists.length; i++) {
            const savedPlaylist = this._savedPlaylists[i];

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
                    `/music/generatedPlaylist/${savedPlaylist.id}`,
                    getItem("jwt")
                );
            } else if (foundItem.name !== savedPlaylist.name) {
                // update the name on software
                const payload = {
                    name: foundItem.name
                };
                await softwarePut(
                    `/music/generatedPlaylist/${savedPlaylist.id}`,
                    payload,
                    getItem("jwt")
                );
            }
        }
    }

    async launchTrackPlayer(playerName: PlayerName = null) {
        // if the player name is null, this means all we want to do is launch the currently set player
        if (!playerName) {
            launchPlayer(this.currentPlayerName, { quietly: false });
            return;
        }

        // it's not null, this means we want to launch a player and we need to pause the other player
        if (this.currentPlayerName === PlayerName.ItunesDesktop) {
            // quit the mac player as the user is switching to spotify
            await quitMacPlayer(PlayerName.ItunesDesktop);
        } else {
            // pause the spotify song as they're switching to itunes
            const musicCtrlMgr = new MusicControlManager();
            musicCtrlMgr.pauseSong(false);
        }

        // update the current player type to what was selected
        this.currentPlayerName = playerName;

        if (playerName !== PlayerName.ItunesDesktop) {
            if (isMac()) {
                // just launch the desktop
                launchPlayer(PlayerName.SpotifyDesktop);
            } else {
                // this will show a prompt as to why we're launching the web player
                this.launchSpotifyPlayer();
            }
        } else {
            launchPlayer(playerName);
        }

        setTimeout(() => {
            commands.executeCommand("musictime.refreshPlaylist");
        }, 500);
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

    async getServerTrack(track: Track) {
        // set it to null so neither heart is displayed
        let server_track = null;

        let type = "spotify";
        if (track.playerType === PlayerType.MacItunesDesktop) {
            type = "itunes";
        }
        const api = `/music/liked/track/${track.id}?type=${type}`;
        const resp = await softwareGet(api, getItem("jwt"));
        if (isResponseOk(resp) && resp.data) {
            server_track = resp.data;
            server_track.loved = server_track.liked === 1 ? true : false;
            delete server_track.liked;
        }

        if (!server_track) {
            server_track = {
                loved: false,
                trackId: track.id,
                type
            };
        }
        track.loved = server_track.loved;
        this.serverTrack = server_track;

        // sycn the controls so it shows the correct state
        MusicCommandManager.syncControls(track);
    }

    hasSpotifyPlaybackAccess() {
        return this.spotifyUser && this.spotifyUser.product === "premium"
            ? true
            : false;
    }

    hasSpotifyUser() {
        return this.spotifyUser && this.spotifyUser.product ? true : false;
    }

    isSpotifyPremium() {
        return this.hasSpotifyUser() && this.spotifyUser.product === "premium"
            ? true
            : false;
    }

    getPlayerNameForPlayback() {
        // if you're offline you may still have spotify desktop player abilities.
        // check if the current player is spotify and we don't have web access.
        // if no web access, then use the desktop player
        if (
            this._currentPlayerName === PlayerName.SpotifyWeb &&
            isMac() &&
            !this.hasSpotifyPlaybackAccess()
        ) {
            return PlayerName.SpotifyDesktop;
        }
        return this._currentPlayerName;
    }
}
