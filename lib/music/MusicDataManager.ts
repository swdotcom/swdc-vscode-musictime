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
    }
}
