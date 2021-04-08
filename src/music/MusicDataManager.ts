import {
    PlayerName,
    PlaylistItem,
    Track,
    PlayerDevice,
    PlayerContext,
    getSpotifyPlayerContext,
} from "cody-music";
import { commands } from "vscode";
import {
    softwareGet,
    isResponseOk,
} from "../HttpClient";
import { getItem } from "../managers/FileManager";
import { MusicCommandManager } from "./MusicCommandManager";

export class MusicDataManager {
    private static instance: MusicDataManager;

    // default to starting with spotify
    private _currentPlayerName: PlayerName = PlayerName.SpotifyWeb;

    public selectedTrackItem: PlaylistItem = null;
    public selectedPlaylist: PlaylistItem = null;
    public buildingCustomPlaylist: boolean = false;
    public playlistTrackMap: any = {};
    public userTopSongs: any[] = [];
    public sortAlphabetically: boolean = false;
    public playlistMap: {} = {};
    public spotifyLikedSongs: Track[] = [];
    public generatedPlaylists: PlaylistItem[] = [];
    public runningTrack: Track = new Track();
    public savedPlaylists: PlaylistItem[] = [];
    public recommendationTracks: Track[] = [];
    public trackIdsForRecommendations: string[] = [];
    public prevRecTrackMap: any = {};
    public recommendationLabel: string = "Familiar";
    public currentRecMeta: any = {};
    public ready: boolean = false;
    public currentDevices: PlayerDevice[] = [];
    public spotifyContext: PlayerContext;
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

    disconnect() {
        this.spotifyPlaylists = [];
        this.spotifyLikedSongs = [];
        this.origRawPlaylistOrder = [];
        this.rawPlaylists = [];
        this.selectedTrackItem = null;
        this.selectedPlaylist = null;
        this.currentDevices = [];
        this.runningTrack = new Track();
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

        this._currentPlayerName = playerName;
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
            commands.executeCommand("musictime.refreshMusicTimeView");
        }
    }

    isLikedTrack(trackId: string) {
        const foundSong = this.spotifyLikedSongs
            ? this.spotifyLikedSongs.find((n: Track) => n.id === trackId)
            : null;
        return foundSong ? true : false;
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

    /**
     * Checks if the user's spotify playlists contains either
     * the global top 40 or the user's coding favorites playlist.
     * The playlistTypeId is used to match the set ID from music time
     * app. 1 = user's coding favorites, 2 = global top 40
     */
    populateGeneratedPlaylists() {
        this.generatedPlaylists = [];
        if (this.savedPlaylists.length > 0 && this.rawPlaylists.length > 0) {
            this.savedPlaylists.forEach((savedPlaylist: PlaylistItem) => {
                const savedPlaylistTypeId = savedPlaylist.playlistTypeId;

                const rawIdx = this.rawPlaylists.findIndex(
                    (n: PlaylistItem) => n.id === savedPlaylist.id
                );
                const origRawPlaylistOrderIdx = this.origRawPlaylistOrder.findIndex(
                    (n: PlaylistItem) => n.id === savedPlaylist.id
                );
                if (rawIdx !== -1) {
                    const playlist = this.rawPlaylists[rawIdx];
                    playlist.playlistTypeId = savedPlaylistTypeId;
                    playlist.tag = "paw";
                    this.generatedPlaylists.push(playlist);

                    this.rawPlaylists.splice(rawIdx, 1);
                }
                if (origRawPlaylistOrderIdx !== -1) {
                    this.origRawPlaylistOrder.splice(
                        origRawPlaylistOrderIdx,
                        1
                    );
                }
            });
        }
    }

    async populatePlayerContext() {
        const spotifyContext: PlayerContext = await getSpotifyPlayerContext();
        MusicDataManager.getInstance().spotifyContext = spotifyContext;
        MusicCommandManager.syncControls(
            MusicDataManager.getInstance().runningTrack,
            false
        );
    }
}
