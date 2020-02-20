import {
    createSpotifyIdFromUri,
    createUriFromTrackId,
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
    getGenre,
    getSpotifyTrackById,
    PlayerDevice,
    getSpotifyDevices
} from "cody-music";
import { MusicManager } from "./MusicManager";
import { KpmController } from "../KpmController";
import { SPOTIFY_LIKED_SONGS_PLAYLIST_NAME } from "../Constants";
import { MusicCommandManager } from "./MusicCommandManager";
import { getDataRows } from "../OfflineManager";
import { MusicDataManager } from "./MusicDataManager";
import { commands } from "vscode";
import { requiresSpotifyAccess } from "./MusicUtil";

export class MusicStateManager {
    static readonly WINDOWS_SPOTIFY_TRACK_FIND: string =
        'tasklist /fi "imagename eq Spotify.exe" /fo list /v | find " - "';

    private static instance: MusicStateManager;

    private existingTrack: Track = new Track();
    private trackProgressInfo: any = {
        endInRange: false,
        duration_ms: 0,
        progress_ms: 0,
        id: null,
        lastUpdateUtc: 0,
        playlistId: null
    };
    private gatheringSong: boolean = false;

    private constructor() {
        // private to prevent non-singleton usage
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
        const selectedPlaylist = MusicDataManager.getInstance()
            .selectedPlaylist;
        if (selectedPlaylist) {
            track["playlistId"] = selectedPlaylist.id;
        }
    }

    private getUtcAndLocal() {
        const utc = nowInSecs();
        const offset_sec = this.timeOffsetSeconds();
        const local = utc - offset_sec;

        return { utc, local };
    }

    private timeOffsetSeconds() {
        const d = new Date();
        // offset is the minutes from GMT. it's positive if it's before, and negative after
        const offset = d.getTimezoneOffset();
        return offset * 60;
    }

    private resetTrackProgressInfo() {
        this.trackProgressInfo = {
            endInRange: false,
            duration_ms: 0,
            progress_ms: 0,
            id: null,
            lastUpdateUtc: 0,
            state: null,
            playlistId: null
        };
    }

    private isEndInRange(playingTrack: Track): boolean {
        if (!playingTrack || !playingTrack.id) {
            return false;
        }

        const buffer = playingTrack.duration_ms * 0.07;
        return playingTrack.progress_ms >= playingTrack.duration_ms - buffer;
    }

    /**
     *
     * @param playingTrack
     * Returns:
     * {
     *   sendSongSession = previous song has ended
     *      (is on repeat OR explicitly paused for over a minute and it wasn't about to end OR a new track has started)
     *   isNewTrack = the track id doesn't equal the existing track id
     *   playNextLikedSong = if the current playlist id is equal to the liked songs playlist id
     *   updateMusicStatus = change in play state (pause/play/different track/no track)
     * }
     */
    private getChangeStatus(playingTrack: Track, utcLocalTimes: any): any {
        const dataMgr: MusicDataManager = MusicDataManager.getInstance();
        const existingTrackId = this.existingTrack.id || null;
        const playingTrackId = playingTrack.id || null;
        const isValidExistingTrack = existingTrackId ? true : false;
        const isValidTrack = playingTrackId ? true : false;
        const playerStateChanged =
            (!existingTrackId && playingTrackId) ||
            (existingTrackId && !playingTrackId)
                ? true
                : false;

        // get the flag to determine if it's a new track or not
        const isNewTrack = existingTrackId !== playingTrackId ? true : false;

        const endInRange = this.isEndInRange(playingTrack);

        const playlistId = dataMgr.selectedPlaylist
            ? dataMgr.selectedPlaylist.id
            : null;
        const isLikedSong =
            playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME ? true : false;

        let lastUpdateUtc =
            isValidTrack && playingTrack.state === TrackStatus.Playing
                ? utcLocalTimes.utc
                : this.trackProgressInfo.lastUpdateUtc;

        const onRepeatStartingOver = this.isOnRepeatStartingOver(playingTrack);

        // get the flag to determine if the track is done or not
        const trackIsDone = this.trackIsDone(playingTrack);
        const isLongPaused = this.trackIsLongPaused(playingTrack);

        // get the flag to determine if we should send the song session
        const sendSongSession =
            isValidExistingTrack &&
            (isNewTrack || onRepeatStartingOver || trackIsDone || isLongPaused)
                ? true
                : false;

        if (isLongPaused) {
            if (sendSongSession) {
                // update the end time to what the lastUpdateUtc + 5 seconds was
                const offset_sec = this.timeOffsetSeconds();
                this.existingTrack["end"] = lastUpdateUtc + 5;
                const local = lastUpdateUtc - offset_sec;
                this.existingTrack["local_end"] = local + 5;
            }
            // update the lastUpdateTimeUtc
            lastUpdateUtc = utcLocalTimes.utc;
        }

        // get the flag to determine if we should play the next liked song automatically
        const initiateNextLikedSong =
            this.trackProgressInfo.endInRange &&
            sendSongSession &&
            isLikedSong &&
            !onRepeatStartingOver
                ? true
                : false;

        this.trackProgressInfo = {
            endInRange,
            lastUpdateUtc,
            state: playingTrack.state || null,
            duration_ms: playingTrack.duration_ms || 0,
            progress_ms: playingTrack.progress_ms || 0,
            id: playingTrack.id || null,
            playlistId
        };

        return {
            isNewTrack,
            sendSongSession,
            initiateNextLikedSong,
            playerStateChanged
        };
    }

    /**
     * Core logic in gathering tracks. This is called every 5 seconds.
     */
    public async gatherMusicInfo(): Promise<any> {
        if (this.gatheringSong || requiresSpotifyAccess()) {
            return;
        }

        this.gatheringSong = true;

        const dataMgr: MusicDataManager = MusicDataManager.getInstance();

        try {
            const utcLocalTimes = this.getUtcAndLocal();
            let playingTrack: Track = await getRunningTrack();
            if (!playingTrack) {
                playingTrack = new Track();
            }

            const isValidRunningOrPausedTrack = this.isValidPlayingOrPausedTrack(
                playingTrack
            );
            const isValidTrack = this.isValidTrack(playingTrack);

            // convert the playing track id to an id
            if (isValidTrack) {
                if (!playingTrack.uri) {
                    playingTrack.uri = createUriFromTrackId(playingTrack.id);
                }
                playingTrack.id = createSpotifyIdFromUri(playingTrack.id);
            }

            // get the change status info:
            // {isNewTrack, sendSongSession, initiateNextLikedSong}
            const changeStatus = this.getChangeStatus(
                playingTrack,
                utcLocalTimes
            );

            if (changeStatus.isNewTrack) {
                // update the playlistId
                this.updateTrackPlaylistId(playingTrack);
            }

            // has the existing track ended or have we started a new track?
            if (changeStatus.sendSongSession) {
                // just set it to playing
                this.existingTrack.state = TrackStatus.Playing;
                if (this.existingTrack["end"] === 0) {
                    this.existingTrack["end"] = utcLocalTimes.utc;
                    this.existingTrack["local_end"] = utcLocalTimes.local;
                }

                // copy the existing track to "songSession"
                const songSession = {
                    ...this.existingTrack
                };

                // gather coding and send the track
                this.gatherCodingDataAndSendSongSession(songSession);

                // clear the track.
                this.existingTrack = null;

                if (playingTrack) {
                    this.existingTrack = new Track();
                }

                // reset the track progress info
                this.resetTrackProgressInfo();
            }

            if (this.existingTrack.id !== playingTrack.id) {
                // update the entire object if the id's don't match
                this.existingTrack = { ...playingTrack };
            }

            if (this.existingTrack.state !== playingTrack.state) {
                // update the state if the state doesn't match
                this.existingTrack.state = playingTrack.state;
            }

            // set the start for the playing track
            if (isValidRunningOrPausedTrack && !this.existingTrack["start"]) {
                this.existingTrack["start"] = utcLocalTimes.utc;
                this.existingTrack["local_start"] = utcLocalTimes.local;
                this.existingTrack["end"] = 0;
            }

            // update the running track
            dataMgr.runningTrack = this.existingTrack;

            // update the music time status bar
            MusicCommandManager.syncControls(dataMgr.runningTrack, false);

            if (changeStatus.playerStateChanged) {
                commands.executeCommand("musictime.refreshDeviceInfo");
            }
        } catch (e) {
            const errMsg = e.message || e;
            logIt(`Unexpected track state processing error: ${errMsg}`);
        }

        this.gatheringSong = false;
    }

    private async playNextLikedSpotifyCheck() {
        const dataMgr: MusicDataManager = MusicDataManager.getInstance();
        const musicMgr: MusicManager = MusicManager.getInstance();
        // If the current playlist is the Liked Songs,
        // check if we should start the next track
        const playlistId = dataMgr.selectedPlaylist
            ? dataMgr.selectedPlaylist.id
            : "";
        if (!playlistId || playlistId !== SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
            // no need to go further, it's not the liked songs playlist
            return;
        }

        // check if we're loading, if so, bail out
        if (MusicCommandManager.isLoading()) {
            return;
        }

        if (!dataMgr.currentDevices || dataMgr.currentDevices.length === 0) {
            // they've closed the player, don't try to play again
            return;
        }

        // play the next song
        await musicMgr.playNextLikedSong();
    }

    numerics = [
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

    public async gatherCodingDataAndSendSongSession(songSession) {
        // if this track doesn't have album json data null it out
        if (songSession.album) {
            // check if it's a valid json
            if (!isValidJson(songSession.album)) {
                // null these out. the backend will populate these
                songSession.album = null;
                songSession.artists = null;
                songSession.features = null;
            }
        }

        // make sure duration_ms is set. it may not be defined
        // if it's coming from one of the players
        if (!songSession.duration_ms && songSession.duration) {
            songSession.duration_ms = songSession.duration;
        }

        // Make sure the current keystrokes payload completes. This will save
        // the code time data for music and code time (only if code time is not installed)
        await KpmController.getInstance().sendKeystrokeDataIntervalHandler();

        // get the reows from the music data file
        const payloads = await getDataRows(getMusicDataFile());

        const isValidSession = songSession.end - songSession.start > 5;

        if (!isValidSession) {
            // the song did not play long enough to constitute as a valid session
            return;
        }

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
            const artistName = MusicManager.getInstance().getArtist(
                songSession
            );
            const songName = songSession.name;
            const artistId =
                songSession.artists && songSession.artists.length
                    ? songSession.artists[0].id
                    : "";
            genreP = getGenre(artistName, songName, artistId);
        }

        // add any file payloads we found
        const songSessionSource = {};
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
                        // filePayloads.push(data);
                        if (songSessionSource[sourceKey]) {
                            // aggregate it
                            const existingData = songSessionSource[sourceKey];
                            const fileData = data[sourceKey];
                            Object.keys(existingData).forEach(key => {
                                if (this.numerics.includes(key)) {
                                    existingData[key] += fileData[key];
                                }
                            });
                        } else {
                            // assign it
                            songSessionSource[sourceKey] = data[sourceKey];
                        }
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
            source: songSessionSource,
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

        // make sure we've set the "liked" to true if it's coming from the liked songs playlist
        if (
            !songSession.liked &&
            songSession.playlistId &&
            songSession.playlistId.toLowerCase === "liked songs"
        ) {
            songSession["liked"] = true;
        }

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
                                    if (this.numerics.includes(sourceObjKey)) {
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

    private isValidTrack(playingTrack: Track) {
        if (playingTrack && playingTrack.id) {
            return true;
        }
        return false;
    }

    private isValidPlayingOrPausedTrack(playingTrack: Track) {
        if (
            playingTrack &&
            playingTrack.id &&
            (playingTrack.state === TrackStatus.Playing ||
                playingTrack.state === TrackStatus.Paused)
        ) {
            return true;
        }
        return false;
    }

    /**
     * Checks whether the playing track is on repeat. Meaning the current
     * progress of the current track is zero or a bit more and the id of the current
     * track matches the track that was in the progress info previously.
     * @param playingTrack
     */
    private isOnRepeatStartingOver(playingTrack) {
        if (
            playingTrack.progress_ms === null ||
            playingTrack.progress_ms === undefined
        ) {
            return false;
        }

        if (
            playingTrack.id &&
            this.trackProgressInfo.id === playingTrack.id &&
            playingTrack.progress_ms >= 0 &&
            playingTrack.status === TrackStatus.Playing &&
            this.trackProgressInfo.progress_ms > playingTrack.progress_ms &&
            this.trackProgressInfo.endInRange
        ) {
            return true;
        }
        return false;
    }

    private trackIsDone(playingTrack) {
        if (
            playingTrack.progress_ms === null ||
            playingTrack.progress_ms === undefined
        ) {
            return false;
        }

        const playingTrackId = playingTrack.id || null;
        const hasProgress =
            playingTrackId && playingTrack.progress_ms > 0 ? true : false;
        const isPausedOrNotPlaying =
            !playingTrackId || playingTrack.state !== TrackStatus.Playing
                ? true
                : false;

        // check to see if it's not playing and doesn't have any progress
        if (isPausedOrNotPlaying && !hasProgress) {
            return true;
        }

        return false;
    }

    private trackIsLongPaused(playingTrack) {
        if (
            playingTrack.progress_ms === null ||
            playingTrack.progress_ms === undefined
        ) {
            return false;
        }

        const playingTrackId = playingTrack ? playingTrack.id : null;
        const hasProgress =
            playingTrackId && playingTrack.progress_ms > 0 ? true : false;

        // check to see if it's paused more than a minute
        const utcLocalTimes: any = this.getUtcAndLocal();
        const pauseThreshold = 60 * 5;
        const diff = utcLocalTimes.utc - this.trackProgressInfo.lastUpdateUtc;
        if (
            hasProgress &&
            this.trackProgressInfo.lastUpdateUtc > 0 &&
            diff > pauseThreshold
        ) {
            return true;
        }

        return false;
    }
}
