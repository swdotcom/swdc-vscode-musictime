import {
    createSpotifyIdFromUri,
    createUriFromTrackId,
    nowInSecs,
    getOffsetSecends,
    getOs,
    getVersion,
    getPluginId,
    isValidJson,
    logIt,
    getSongSessionDataFile,
    isMac,
    getSoftwareDataStoreFile,
} from "../Util";
import {
    sendMusicData,
    populatePlayerContext,
    serverIsAvailable,
} from "../DataController";
import {
    Track,
    TrackStatus,
    getGenre,
    getSpotifyTrackById,
    getTrack,
    PlayerName,
} from "cody-music";
import { MusicManager } from "./MusicManager";
import { KpmController } from "../KpmController";
import { SPOTIFY_LIKED_SONGS_PLAYLIST_NAME } from "../Constants";
import { MusicCommandManager } from "./MusicCommandManager";
import { getDataRows } from "../OfflineManager";
import { MusicDataManager } from "./MusicDataManager";
import { commands } from "vscode";

const moment = require("moment-timezone");

export class MusicStateManager {
    static readonly WINDOWS_SPOTIFY_TRACK_FIND: string =
        'tasklist /fi "imagename eq Spotify.exe" /fo list /v | find " - "';

    private static instance: MusicStateManager;

    private existingTrack: Track = new Track();

    private lastTrackSentInfo = {
        timestamp: 0,
        trackId: null,
    };

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

    private isEndInRange(playingTrack: Track): boolean {
        if (!playingTrack || !playingTrack.id) {
            return false;
        }

        const buffer = playingTrack.duration_ms * 0.07;
        return playingTrack.progress_ms >= playingTrack.duration_ms - buffer;
    }

    public isExistingTrackPlaying(): boolean {
        return this.existingTrack &&
            this.existingTrack.id &&
            this.existingTrack.state === TrackStatus.Playing
            ? true
            : false;
    }

    /**
     * Core logic in gathering tracks. This is called every 5 seconds.
     */
    public async gatherMusicInfo(): Promise<any> {
        const dataMgr: MusicDataManager = MusicDataManager.getInstance();

        try {
            const utcLocalTimes = this.getUtcAndLocal();
            const serverIsOnline = await serverIsAvailable();

            if (!serverIsOnline && !isMac) {
                return;
            }

            const isMacDesktopEnabled = MusicManager.getInstance().isMacDesktopEnabled();

            let playingTrack: Track = null;
            if (isMacDesktopEnabled || (!serverIsOnline && isMac)) {
                // fetch from the desktop
                playingTrack = await getTrack(PlayerName.SpotifyDesktop);
                // applescript doesn't always return a name
                if (!playingTrack || !playingTrack.name) {
                    playingTrack = await getTrack(PlayerName.SpotifyWeb);
                }
            } else {
                playingTrack = await getTrack(PlayerName.SpotifyWeb);
            }

            if (
                !playingTrack ||
                (playingTrack && playingTrack.httpStatus >= 400)
            ) {
                // currently unable to fetch the track
                return;
            }

            if (!playingTrack) {
                // make an empty track
                playingTrack = new Track();
            }

            const isValidTrack = this.isValidTrack(playingTrack);

            // convert the playing track id to an id
            if (isValidTrack) {
                if (!playingTrack.uri) {
                    playingTrack.uri = createUriFromTrackId(playingTrack.id);
                }
                playingTrack.id = createSpotifyIdFromUri(playingTrack.id);
            }

            const isNewTrack =
                this.existingTrack.id !== playingTrack.id ? true : false;
            const sendSongSession =
                isNewTrack && this.existingTrack.id ? true : false;
            const trackStateChanged =
                this.existingTrack.state !== playingTrack.state ? true : false;

            // has the existing track ended or have we started a new track?
            if (sendSongSession) {
                // just set it to playing
                this.existingTrack.state = TrackStatus.Playing;
                if (this.existingTrack["end"] === 0) {
                    this.existingTrack["end"] = utcLocalTimes.utc;
                    this.existingTrack["local_end"] = utcLocalTimes.local;
                }

                // copy the existing track to "songSession"
                const songSession = {
                    ...this.existingTrack,
                };

                // gather coding and send the track
                this.gatherCodingDataAndSendSongSession(songSession);

                // clear the track.
                this.existingTrack = null;

                if (playingTrack) {
                    this.existingTrack = new Track();
                }
            }

            if (
                !this.existingTrack ||
                this.existingTrack.id !== playingTrack.id
            ) {
                // update the entire object if the id's don't match
                this.existingTrack = { ...playingTrack };
            }

            if (this.existingTrack.state !== playingTrack.state) {
                // update the state if the state doesn't match
                this.existingTrack.state = playingTrack.state;
            }

            // set the start for the playing track
            if (
                this.existingTrack &&
                this.existingTrack.id &&
                !this.existingTrack["start"]
            ) {
                this.existingTrack["start"] = utcLocalTimes.utc;
                this.existingTrack["local_start"] = utcLocalTimes.local;
                this.existingTrack["end"] = 0;
            }

            // update the running track
            dataMgr.runningTrack = this.existingTrack;

            // update the music time status bar
            MusicCommandManager.syncControls(dataMgr.runningTrack, false);

            if (isNewTrack) {
                // update the playlistId
                this.updateTrackPlaylistId(playingTrack);
                // the player context such as player device status
                populatePlayerContext();
                if (trackStateChanged) {
                    // update the device info in case the device has changed
                    commands.executeCommand("musictime.refreshDeviceInfo");
                }
            }
        } catch (e) {
            const errMsg = e.message || e;
            logIt(`Unexpected track state processing error: ${errMsg}`);
        }
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
        "keystrokes",
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
        const latestPayload = await KpmController.getInstance().sendKeystrokeDataIntervalHandler();

        // get the rows from the music data file
        let payloads = await getDataRows(
            getSoftwareDataStoreFile(),
            false /*deleteAfterRead*/
        );
        if (!payloads) {
            payloads = [];
        }

        if (latestPayload) {
            payloads.push(latestPayload);
        }

        // 10 second minimum threshold
        const isValidSession = songSession.end - songSession.start > 10;

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
            // async
            genreP = getGenre(artistName, songName, artistId);
        }

        // add any file payloads we found
        const songSessionSource = {};
        if (payloads && payloads.length) {
            payloads.forEach((payload) => {
                Object.keys(payload.source).forEach((sourceKey) => {
                    let data = {};
                    data[sourceKey] = payload.source[sourceKey];
                    // only add the file payload if the song session's end is after the song session start
                    if (
                        data[sourceKey] &&
                        data[sourceKey].end > songSession.start
                    ) {
                        if (songSessionSource[sourceKey]) {
                            // aggregate it
                            const existingData = songSessionSource[sourceKey];
                            const fileData = data[sourceKey];
                            Object.keys(existingData).forEach((key) => {
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
            repoContributorCount: 0,
        };

        // build the file aggregate data, but only keep the coding data
        // that match up to the song session range
        const songData = this.buildAggregateData(
            payloads,
            initialValue,
            songSession.start
        );

        // await for either promise, whichever one is available
        const fullTrack = await fullTrackP;
        if (fullTrack && fullTrack.album) {
            // update the tracks with the result
            songSession["album"] = fullTrack.album;
            songSession["features"] = fullTrack.features;
            songSession["artists"] = fullTrack.artists;
            if (!genre) {
                songSession["genre"] = fullTrack.genre;
            }
        }

        if (!songSession.genre) {
            genre = await genreP;
            if (genre) {
                songSession["genre"] = genre;
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
            ...songData,
        };

        // make sure we've set the "liked" to true if it's coming from the liked songs playlist
        if (
            !songSession.liked &&
            songSession.playlistId &&
            songSession.playlistId.toLowerCase === "liked songs"
        ) {
            songSession["liked"] = true;
        }

        this.lastTrackSentInfo.timestamp = moment().unix();
        this.lastTrackSentInfo.trackId = songSession.id;

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
                        keys.forEach((key) => {
                            let sourceObj = element.source[key];
                            const sourceObjKeys = Object.keys(sourceObj);
                            if (sourceObjKeys && sourceObjKeys.length > 0) {
                                sourceObjKeys.forEach((sourceObjKey) => {
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
}
