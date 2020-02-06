import {
    PlayerName,
    PlaylistItem,
    Track,
    PlayerDevice,
    CodyConfig,
    setConfig
} from "cody-music";
import { SpotifyUser } from "cody-music/dist/lib/profile";
import { isMac, getItem } from "../Util";
import { commands } from "vscode";
import { PERSONAL_TOP_SONGS_PLID } from "../Constants";
import {
    softwareGet,
    isResponseOk,
    softwareDelete,
    softwarePut
} from "../HttpClient";

export class MusicDataManager {
    private static instance: MusicDataManager;

    // default to starting with spotify
    private _currentPlayerName: PlayerName = PlayerName.SpotifyWeb;

    public selectedTrackItem: PlaylistItem = null;
    public selectedPlaylist: PlaylistItem = null;
    public spotifyClientId: string = "";
    public spotifyClientSecret: string = "";
    public buildingCustomPlaylist: boolean = false;
    public playlistTrackMap: any = {};
    public spotifyUser: SpotifyUser = null;
    public userTopSongs: any[] = [];
    public sortAlphabetically: boolean = false;
    public playlistMap: {} = {};
    public spotifyLikedSongs: Track[] = [];
    public generatedPlaylists: PlaylistItem[] = [];
    public runningTrack: Track = new Track();
    public savedPlaylists: PlaylistItem[] = [];
    public recommendationTracks: Track[] = [];
    public trackIdsForRecommendations: string[] = [];
    public recommendationLabel: string = "Similar to Liked Songs";
    public currentRecMeta: any = {};
    public ready: boolean = false;
    public currentDevices: PlayerDevice[] = [];
    public buildingPlaylists: boolean = false;

    public rawPlaylists: PlaylistItem[] = [];
    public origRawPlaylistOrder: PlaylistItem[] = [];
    public itunesPlaylists: PlaylistItem[] = [];
    public spotifyPlaylists: PlaylistItem[] = [];

    private constructor() {
        //
    }
    static getInstance(): MusicDataManager {
        if (!MusicDataManager.instance) {
            MusicDataManager.instance = new MusicDataManager();
        }

        return MusicDataManager.instance;
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
        codyConfig.spotifyClientId = this.spotifyClientId;
        codyConfig.spotifyAccessToken = accessToken;
        codyConfig.spotifyRefreshToken = refreshToken;
        codyConfig.spotifyClientSecret = this.spotifyClientSecret;
        setConfig(codyConfig);
    }

    removeTrackFromRecommendations(trackId) {
        let foundIdx = -1;
        for (let i = 0; i < this.recommendationTracks.length; i++) {
            if (this.recommendationTracks[i].id === trackId) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx > -1) {
            // splice it out
            this.recommendationTracks.splice(foundIdx, 1);
        }

        if (this.recommendationTracks.length < 2) {
            // refresh
            commands.executeCommand("musictime.refreshRecommendations");
        }
    }

    isLikedTrack(trackId: string) {
        const foundSong = this.spotifyLikedSongs
            ? this.spotifyLikedSongs.find((n: Track) => n.id === trackId)
            : null;
        return foundSong ? true : false;
    }

    getAiTopFortyPlaylist() {
        // Add the AI generated playlist
        if (this.generatedPlaylists && this.generatedPlaylists.length) {
            const aiPlaylist = this.generatedPlaylists.find(
                (e: PlaylistItem) => {
                    return e.playlistTypeId === PERSONAL_TOP_SONGS_PLID;
                }
            );
            return aiPlaylist;
        }
        return null;
    }

    /**
     * Checks if the user's spotify playlists contains either
     * the global top 40 or the user's coding favorites playlist.
     * The playlistTypeId is used to match the set ID from music time
     * app. 1 = user's coding favorites, 2 = global top 40
     */
    getMusicTimePlaylistByTypeId(playlistTypeId: number): PlaylistItem {
        const pItem: PlaylistItem = this.generatedPlaylists.find(
            (e: PlaylistItem) => e.playlistTypeId === playlistTypeId
        );
        return pItem;
    }

    async fetchSavedPlaylists() {
        let playlists = [];

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
                    savedPlaylist.playlistTypeId = savedPlaylist.playlistTypeId;
                    playlists.push(savedPlaylist);
                }
            }
        }

        this.savedPlaylists = playlists;
    }

    /**
     * Checks if the user's spotify playlists contains either
     * the global top 40 or the user's coding favorites playlist.
     * The playlistTypeId is used to match the set ID from music time
     * app. 1 = user's coding favorites, 2 = global top 40
     */
    populateGeneratedPlaylists(playlists: PlaylistItem[]) {
        this.generatedPlaylists = [];
        if (this.savedPlaylists.length > 0 && playlists.length > 0) {
            this.savedPlaylists.forEach((savedPlaylist: PlaylistItem) => {
                const savedPlaylistTypeId = savedPlaylist.playlistTypeId;
                let idx = -1;
                for (let i = 0; i < playlists.length; i++) {
                    const playlist = playlists[i];
                    if (playlist.id === savedPlaylist.id) {
                        playlist.playlistTypeId = savedPlaylistTypeId;
                        playlist.tag = "paw";
                        this.generatedPlaylists.push(playlist);
                        break;
                    }
                }
                if (idx !== -1) {
                    playlists.splice(idx, 1);
                }
            });
        }
    }

    // reconcile. meaning the user may have deleted the lists our 2 buttons created;
    // global and custom.  We'll remove them from our db if we're unable to find a matching
    // playlist_id we have saved.
    async reconcilePlaylists() {
        if (
            this.savedPlaylists &&
            this.savedPlaylists.length &&
            this.generatedPlaylists &&
            this.generatedPlaylists.length
        ) {
            for (let i = 0; i < this.savedPlaylists.length; i++) {
                const savedPlaylist = this.savedPlaylists[i];
                const foundPlaylist = this.generatedPlaylists.find(
                    (p: PlaylistItem) => (p.id = savedPlaylist.id)
                );

                if (!foundPlaylist) {
                    // no longer found, delete it
                    await softwareDelete(
                        `/music/playlist/generated/${savedPlaylist.id}`,
                        getItem("jwt")
                    );
                } else if (foundPlaylist.name !== savedPlaylist.name) {
                    // update the name on the music time app
                    const payload = {
                        name: foundPlaylist.name
                    };
                    await softwarePut(
                        `/music/playlist/generated/${savedPlaylist.id}`,
                        payload,
                        getItem("jwt")
                    );
                }
            }
        }
    }
}
