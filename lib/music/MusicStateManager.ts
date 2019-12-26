import {
    nowInSecs,
    getOffsetSecends,
    getOs,
    getVersion,
    getPluginId,
    isValidJson,
    getMusicDataFile,
    logIt,
    getSongSessionDataFile
} from "../Util";
import { sendMusicData } from "../DataController";
import {
    Track,
    getRunningTrack,
    TrackStatus,
    PlayerType,
    PlayerName,
    PlaylistItem,
    launchAndPlaySpotifyTrack,
    getGenre,
    getSpotifyTrackById,
    isSpotifyRunning,
    getSpotifyDevices
} from "cody-music";
import { MusicManager } from "./MusicManager";
import { KpmController } from "../KpmController";
import { SPOTIFY_LIKED_SONGS_PLAYLIST_NAME } from "../Constants";
import { MusicCommandManager } from "./MusicCommandManager";
import { getDataRows } from "../OfflineManager";

export class MusicStateManager {
    static readonly WINDOWS_SPOTIFY_TRACK_FIND: string =
        'tasklist /fi "imagename eq Spotify.exe" /fo list /v | find " - "';

    private static instance: MusicStateManager;

    private existingTrack: any = {};
    private trackProgressInfo: any = {
        endInRange: false,
        duration_ms: 0,
        progress_ms: 0,
        id: null,
        lastUpdateUtc: 0
    };
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
    private updateTrackPlaylistId(track: Track) {
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

    private resetTrackProgressInfo() {
        this.trackProgressInfo = {
            endInRange: false,
            duration_ms: 0,
            progress_ms: 0,
            id: null,
            lastUpdateUtc: 0
        };
    }

    private isEndInRange(playingTrack: Track): boolean {
        if (!playingTrack || !playingTrack.id) {
            return false;
        }

        const buffer = playingTrack.duration_ms * 0.1;
        return playingTrack.progress_ms >= playingTrack.duration_ms - buffer;
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
        let endInRange = this.isEndInRange(playingTrack);

        const utcLocalTimes = this.getUtcAndLocal();

        let lastUpdateUtc = this.trackProgressInfo.lastUpdateUtc;

        // update the lastUpdateUtc if the progress is moving
        if (
            playingTrackId &&
            this.trackProgressInfo.id === playingTrackId &&
            this.trackProgressInfo.progress_ms !== playingTrack.progress_ms
        ) {
            lastUpdateUtc = utcLocalTimes.utc;
        }

        // update the ended state
        // If the previous track was the same trackId and it's end progress was in range
        let ended = false;
        if (!playingTrackId) {
            ended = true;
        } else {
            // check if the progress has gone back to the beginning and it was previously
            // at the end of the track, meaning it's on repeat
            if (
                this.trackProgressInfo.id === playingTrackId &&
                this.trackProgressInfo.progress_ms > playingTrack.progress_ms &&
                this.trackProgressInfo.endInRange
            ) {
                ended = true;
            } else if (
                playingTrackId &&
                lastUpdateUtc > 0 &&
                utcLocalTimes.utc - lastUpdateUtc > 60
            ) {
                // the track has been stopped for over a minute, end it
                ended = true;
            }
        }

        this.trackProgressInfo = {
            endInRange,
            lastUpdateUtc,
            duration_ms: playingTrack.duration_ms || 0,
            progress_ms: playingTrack.progress_ms || 0,
            id: playingTrack.id || null
        };

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
        try {
            const playingTrack: Track =
                (await getRunningTrack()) || new Track();

            const changeStatus = this.getChangeStatus(playingTrack);

            if (changeStatus.isNewTrack) {
                // update the playlistId
                this.updateTrackPlaylistId(playingTrack);
            }

            const utcLocalTimes = this.getUtcAndLocal();

            // send the existing song if it has ended, or a new song has started
            const sendSongSession =
                (changeStatus.ended || changeStatus.endPrevTrack) &&
                this.existingTrack.id
                    ? true
                    : false;

            // has the existing track ended or have we started a new track?
            if (sendSongSession) {
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

                // reset the track progress info
                this.resetTrackProgressInfo();
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

            const needsRefresh =
                changeStatus.isNewTrack ||
                changeStatus.trackStateChanged ||
                changeStatus.playerNameChanged;
            if (needsRefresh) {
                MusicCommandManager.syncControls(
                    this.musicMgr.runningTrack,
                    false
                );
            }
        } catch (e) {
            const errMsg = e.message || e;
            logIt(`Unexpected track state processing error: ${errMsg}`);
        }

        this.gatheringSong = false;
    }

    private async playNextLikedSpotifyCheck(changeStatus) {
        let isRunning = await isSpotifyRunning();
        const devices = await getSpotifyDevices();
        if (!isRunning || !devices || devices.length === 0) {
            // they've closed the player
            return;
        }
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
        let genre = songSession.genre;
        let genreP: Promise<string> = null;
        let fullTrackP: Promise<Track> = null;

        // fetch the full track or genre
        if (songSession.type === "spotify") {
            // just fetch the entire track
            fullTrackP = getSpotifyTrackById(
                songSession.id,
                true /*includeFullArtist*/,
                true /*includeAudioFeatures*/,
                true /*includeGenre*/
            );
        } else if (!genre) {
            // fetch the genre
            const artistName = this.musicMgr.getArtist(songSession);
            const songName = songSession.name;
            const artistId =
                songSession.artists && songSession.artists.length
                    ? songSession.artists[0].id
                    : "";
            genreP = getGenre(artistName, songName, artistId);
        }

        // Make sure the current keystrokes payload completes. This will save
        // the code time data for music and code time (only if code time is not installed)
        await KpmController.getInstance().sendKeystrokeDataIntervalHandler();

        // get the reows from the music data file
        const payloads = await getDataRows(getMusicDataFile());

        // add any file payloads we found
        const filePayloads = [];
        if (payloads && payloads.length) {
            payloads.forEach(payload => {
                Object.keys(payload.source).forEach(sourceKey => {
                    let data = {};
                    data[sourceKey] = payload.source[sourceKey];
                    // only add the file payload if the song session's end is after the song session start
                    if (
                        data[sourceKey] &&
                        data[sourceKey].end > songSession.start
                    ) {
                        filePayloads.push(data);
                    }
                });
            });
        }
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
            source: filePayloads,
            repoFileCount: 0,
            repoContributorCount: 0
        };

        // build the file aggregate data, but only keep the coding data
        // that match up to the song session range
        const songData = this.buildAggregateData(
            payloads,
            initialValue,
            songSession.start
        );

        // await for either promise, whichever one is available
        if (genreP) {
            genre = await genreP;
            songSession["genre"] = genre;
        } else if (fullTrackP) {
            // update the tracks with the result
            const fullTrack = await fullTrackP;
            songSession["album"] = fullTrack.album;
            songSession["features"] = fullTrack.features;
            songSession["artists"] = fullTrack.artists;
            if (!genre) {
                songSession["genre"] = fullTrack.genre;
            }
        }

        // set a convenience "spotifyTrackId" attribute based on the URI
        if (songSession.type === "spotify" && songSession.uri) {
            songSession["spotifyTrackId"] = songSession.uri;
            // make sure the trackId is the URI if it's a spotify track
            songSession["trackId"] = songSession.uri;
        }

        songSession = {
            ...songSession,
            ...songData
        };

        // send the music data, if we're online
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
        source: [],
        repoFileCount: 0,
        repoContributorCount: 0,
     */
    private buildAggregateData(payloads, initialValue, start) {
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
            for (let i = 0; i < payloads.length; i++) {
                const element = payloads[i];

                // if the file's end time is before the song session start, ignore it
                if (element.end < start) {
                    // the file's end is before the start, go to the next one
                    continue;
                }

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
                    // initialValue.source = element.source;
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
            }
        }
        initialValue.keystrokes = totalKeystrokes;
        return initialValue;
    }

    /**
     * This will send the keystrokes batch data along with returning all of the gathered keystrokes.
     * If track ends, it will also request to send the current keystrokes. The 30 minute timer will
     * not request to send the current keystrokes as those will be used if a track is currently playing.
     * @param sendCurrentKeystrokes
     */
    public async processOfflineSongSessions() {
        const payloads = await getDataRows(getSongSessionDataFile());
        if (payloads && payloads.length > 0) {
            // send the offline song sessions
            for (let i = 0; i < payloads.length; i++) {
                await sendMusicData(payloads[i]);
            }
        }
    }
}
