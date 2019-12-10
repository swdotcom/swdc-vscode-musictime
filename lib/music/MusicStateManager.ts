import { commands } from "vscode";
import {
    nowInSecs,
    getOffsetSecends,
    getOs,
    getVersion,
    getPluginId,
    isValidJson
} from "../Util";
import { sendMusicData } from "../DataController";
import {
    Track,
    getRunningTrack,
    TrackStatus,
    PlayerType,
    PlayerName,
    PlaylistItem,
    launchAndPlaySpotifyTrack
} from "cody-music";
import { MusicManager } from "./MusicManager";
import { KpmController } from "../KpmController";
import { SPOTIFY_LIKED_SONGS_PLAYLIST_NAME } from "../Constants";

export class MusicStateManager {
    static readonly WINDOWS_SPOTIFY_TRACK_FIND: string =
        'tasklist /fi "imagename eq Spotify.exe" /fo list /v | find " - "';

    private static instance: MusicStateManager;

    private existingTrack: any = {};
    private endInRangeTrackId: string = "";
    private gatheringSong: boolean = false;

    private musicMgr: MusicManager;

    private constructor() {
        // private to prevent non-singleton usage
        if (!this.musicMgr) {
            this.musicMgr = MusicManager.getInstance();
        }
    }

    static getInstance() {
        if (!MusicStateManager.instance) {
            MusicStateManager.instance = new MusicStateManager();
        }
        return MusicStateManager.instance;
    }

    /**
     * Get the selected playlis or find it from the list of playlists
     * @param track
     */
    private updateTrackPlaylistId(track) {
        const selectedPlaylist = this.musicMgr.selectedPlaylist;
        if (selectedPlaylist) {
            track["playlistId"] = selectedPlaylist.id;
        }
    }

    private getUtcAndLocal() {
        const utc = nowInSecs();
        let d = new Date();
        // offset is the minutes from GMT. it's positive if it's before, and negative after
        const offset = d.getTimezoneOffset();
        const offset_sec = offset * 60;
        const local = utc - offset_sec;

        return { utc, local };
    }

    private isEndInRange(progress_ms, duration_ms) {
        const buffer = duration_ms * 0.06;
        return progress_ms >= duration_ms - buffer;
    }

    private getChangeStatus(playingTrack: Track): any {
        const existingTrackId =
            this.existingTrack && this.existingTrack.id
                ? this.existingTrack.id || null
                : null;
        const playingTrackId = playingTrack.id || null;
        const existingTrackState = this.existingTrack
            ? this.existingTrack.state || TrackStatus.NotAssigned
            : TrackStatus.NotAssigned;
        const playingTrackState = playingTrack.state || "stopped";

        // return obj attributes
        const stopped = playingTrackState === "stopped";
        const paused = playingTrackState === TrackStatus.Paused;
        const isNewTrack = existingTrackId !== playingTrackId;
        const trackStateChanged = existingTrackState !== playingTrackState;
        const playing = playingTrackState === TrackStatus.Playing;

        const isValidTrack = playingTrack.id ? true : false;

        // to determine if we should end the previous track, the
        // existing track should be existing and playing

        const tracksMatch = existingTrackId === playingTrackId;
        const endPrevTrack =
            !tracksMatch && existingTrackId && playingTrackId ? true : false;

        let playerName = this.musicMgr.currentPlayerName;
        let playerNameChanged = false;
        // only update the currentPlayerName if the current track running
        // is "playing" AND the playerType doesn't match the current player type

        const isCurrentlySpotifyPlayer =
            playerName === PlayerName.SpotifyWeb ||
            playerName === PlayerName.SpotifyDesktop
                ? true
                : false;

        if (playing) {
            if (
                playingTrack.playerType === PlayerType.MacItunesDesktop &&
                isCurrentlySpotifyPlayer
            ) {
                // they've switch from spotify to itunes
                this.musicMgr.currentPlayerName = PlayerName.ItunesDesktop;
                playerNameChanged = true;
            } else if (
                playingTrack.playerType !== PlayerType.MacItunesDesktop &&
                !isCurrentlySpotifyPlayer
            ) {
                this.musicMgr.currentPlayerName = PlayerName.SpotifyWeb;
                playerNameChanged = true;
            }
        }

        const isActiveTrack = playing || paused;

        // update the endInRange state
        let endInRange = false;
        if (
            playingTrackId &&
            playingTrack.progress_ms &&
            this.isEndInRange(
                playingTrack.progress_ms,
                playingTrack.duration_ms
            )
        ) {
            endInRange = true;
        }

        // update the ended state
        let ended = false;
        if (endInRange) {
            this.endInRangeTrackId = playingTrackId;
        } else if (
            this.endInRangeTrackId === playingTrackId &&
            playingTrack.progress_ms === 0
        ) {
            // clear this and set ended to true
            this.endInRangeTrackId = "";
            ended = true;
        } else {
            // clear this
            this.endInRangeTrackId = "";
        }

        return {
            isNewTrack,
            endPrevTrack,
            isActiveTrack,
            trackStateChanged,
            playing,
            paused,
            stopped,
            isValidTrack,
            playerNameChanged,
            endInRange,
            ended
        };
    }

    public buildBootstrapSongSession() {
        const now = nowInSecs();
        let d = new Date();
        // offset is the minutes from GMT. it's positive if it's before, and negative after
        const offset = d.getTimezoneOffset();
        const offset_sec = offset * 60;
        // send the music time bootstrap payload
        let track: Track = new Track();
        track.id = "music-time-init";
        track.name = "music-time-init";
        track.artist = "music-time-init";
        track.type = "init";
        track["start"] = now;
        track["local_start"] = now - offset_sec;
        track["end"] = now + 1;
        this.gatherCodingDataAndSendSongSession(track);
    }

    private allowSetRunningTrack() {
        // if it's spotify and we need to check if it's online or not.
        // if it's not online, we can't show the playlist forlder
        const type =
            this.musicMgr.currentPlayerName === PlayerName.ItunesDesktop
                ? "itunes"
                : "spotify";
        const hasSpotifyUser = this.musicMgr.hasSpotifyUser();

        if (type === "spotify" && !hasSpotifyUser) {
            return false;
        }
        return true;
    }

    /**
     * Core logic in gathering tracks. This is called every 5 seconds.
     */
    public async gatherMusicInfo(): Promise<any> {
        if (this.gatheringSong) {
            return;
        }

        this.gatheringSong = true;
        const playingTrack = (await getRunningTrack()) || new Track();

        const changeStatus = this.getChangeStatus(playingTrack);

        if (changeStatus.isNewTrack) {
            // update the playlistId
            this.updateTrackPlaylistId(playingTrack);
        }

        const utcLocalTimes = this.getUtcAndLocal();

        // has the existing track ended or have we started a new track?
        if (
            (changeStatus.ended || changeStatus.endPrevTrack) &&
            this.existingTrack.id
        ) {
            // just set it to playing
            this.existingTrack.state = TrackStatus.Playing;
            this.existingTrack["end"] = utcLocalTimes.utc;
            this.existingTrack["local_end"] = utcLocalTimes.local;

            // if this track doesn't have album json data null it out
            if (this.existingTrack.album) {
                // check if it's a valid json
                if (!isValidJson(this.existingTrack.album)) {
                    // null these out. the backend will populate these
                    this.existingTrack.album = null;
                    this.existingTrack.artists = null;
                    this.existingTrack.features = null;
                }
            }

            // make sure duration_ms is set. it may not be defined
            // if it's coming from one of the players
            if (
                !this.existingTrack.duration_ms &&
                this.existingTrack.duration
            ) {
                this.existingTrack.duration_ms = this.existingTrack.duration;
            }

            // copy the existing track to "songSession"
            const songSession = {
                ...this.existingTrack
            };

            // gather coding and send the track
            this.gatherCodingDataAndSendSongSession(songSession);

            // clear the track.
            this.existingTrack = {};
        }

        // do we have a new song or was it paused?
        // if it was paused we'll create a new start time anyway, so recreate.
        if (
            changeStatus.isNewTrack &&
            changeStatus.isActiveTrack &&
            changeStatus.isValidTrack
        ) {
            await this.musicMgr.getServerTrack(playingTrack);

            // set the start times
            playingTrack["start"] = utcLocalTimes.utc;
            playingTrack["local_start"] = utcLocalTimes.local;
            playingTrack["end"] = 0;

            this.existingTrack = { ...playingTrack };
        }

        if (changeStatus.trackStateChanged) {
            // update the state so the requester gets this value
            this.existingTrack.state = playingTrack.state;
        }

        const needsRefresh =
            changeStatus.isNewTrack ||
            changeStatus.trackStateChanged ||
            changeStatus.playerNameChanged;

        if (needsRefresh) {
            // new player (i.e. switched from itunes to spotify)
            // refresh the entire tree view
            commands.executeCommand("musictime.refreshPlaylist");
        }

        // If the current playlist is the Liked Songs,
        // check if we should start the next track
        await this.playNextLikedSpotifyCheck(changeStatus);

        // !Important! This should be the only place in the code
        // that sets the running track. If the user is offline and
        // wanting to use spotify, then we can't set the running track due
        // do not being able to control it, but the uer can listen to it without
        // the editors controls
        if (this.allowSetRunningTrack()) {
            this.musicMgr.runningTrack = this.existingTrack;
        } else {
            this.musicMgr.runningTrack = new Track();
        }

        this.gatheringSong = false;
    }

    private async playNextLikedSpotifyCheck(changeStatus) {
        // If the current playlist is the Liked Songs,
        // check if we should start the next track
        const playlistId = this.musicMgr.selectedPlaylist
            ? this.musicMgr.selectedPlaylist.id
            : "";

        if (
            playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME &&
            changeStatus.ended
        ) {
            // play the next song
            const nextTrack: Track = this.musicMgr.getNextSpotifyLikedSong();
            if (nextTrack) {
                let playlistItem: PlaylistItem = this.musicMgr.createPlaylistItemFromTrack(
                    nextTrack,
                    0
                );
                this.musicMgr.selectedTrackItem = playlistItem;
                // launch and play the next track
                await launchAndPlaySpotifyTrack(playlistItem.id, "");
            }
        }
    }

    public async gatherCodingDataAndSendSongSession(songSession) {
        const payloads = await KpmController.getInstance().processOfflineKeystrokes(
            true /*sendCurrentKeystrokes*/
        );
        const initialValue = {
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
            source: {},
            repoFileCount: 0,
            repoContributorCount: 0
        };
        const songData = this.buildAggregateData(payloads, initialValue);

        songSession = {
            ...songSession,
            ...songData
        };

        sendMusicData(songSession);
    }

    /**
     * 
     * @param payloads
     * Should return...
     *  add: 0,
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
        source: {},
        repoFileCount: 0,
        repoContributorCount: 0,
     */
    private buildAggregateData(payloads, initialValue) {
        const numerics = [
            "add",
            "paste",
            "delete",
            "netkeys",
            "linesAdded",
            "linesRemoved",
            "open",
            "close",
            "keystrokes"
        ];
        let totalKeystrokes = 0;
        if (payloads && payloads.length > 0) {
            payloads.forEach(element => {
                // set repoContributorCount and repoFileCount
                // if not already set
                if (initialValue.repoFileCount === 0) {
                    initialValue.repoFileCount = element.repoFileCount;
                }
                if (initialValue.repoContributorCount === 0) {
                    initialValue.repoContributorCount =
                        element.repoContributorCount;
                }

                if (element.source) {
                    // go through the source object
                    initialValue.source = element.source;
                    const keys = Object.keys(element.source);
                    if (keys && keys.length > 0) {
                        keys.forEach(key => {
                            let sourceObj = element.source[key];
                            const sourceObjKeys = Object.keys(sourceObj);
                            if (sourceObjKeys && sourceObjKeys.length > 0) {
                                sourceObjKeys.forEach(sourceObjKey => {
                                    const val = sourceObj[sourceObjKey];
                                    if (numerics.includes(sourceObjKey)) {
                                        // aggregate
                                        initialValue[sourceObjKey] += val;
                                    }
                                });
                            }

                            // set the sourceObj.keystrokes
                            sourceObj.keystrokes =
                                sourceObj.paste +
                                sourceObj.add +
                                sourceObj.delete +
                                sourceObj.linesAdded +
                                sourceObj.linesRemoved;
                            // sum the keystrokes
                            totalKeystrokes += sourceObj.keystrokes;

                            if (!initialValue.syntax && sourceObj.syntax) {
                                initialValue.syntax = sourceObj.syntax;
                            }

                            if (!sourceObj.timezone) {
                                sourceObj[
                                    "timezone"
                                ] = Intl.DateTimeFormat().resolvedOptions().timeZone;
                            }
                            if (!sourceObj.offset) {
                                sourceObj["offset"] = getOffsetSecends() / 60;
                            }
                            if (!sourceObj.pluginId) {
                                sourceObj["pluginId"] = getPluginId();
                            }
                            if (!sourceObj.os) {
                                sourceObj["os"] = getOs();
                            }
                            if (!sourceObj.version) {
                                sourceObj["version"] = getVersion();
                            }
                        });
                    }
                }
            });
        }
        initialValue.keystrokes = totalKeystrokes;
        return initialValue;
    }
}
