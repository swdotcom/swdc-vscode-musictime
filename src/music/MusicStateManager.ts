import { createSpotifyIdFromUri, createUriFromTrackId, nowInSecs, logIt, isMac } from "../Util";
import { populatePlayerContext } from "../DataController";
import {
  Track,
  TrackStatus,
  getTrack,
  PlayerName,
  CodyResponse,
  getSpotifyRecentlyPlayedBefore,
} from "cody-music";
import { DEFAULT_CURRENTLY_PLAYING_TRACK_CHECK_SECONDS } from "../Constants";
import { MusicCommandManager } from "./MusicCommandManager";
import { MusicDataManager } from "./MusicDataManager";
import { commands } from "vscode";
import { getDeviceId, requiresSpotifyAccess } from "./MusicUtil";
import { CacheManager } from "../cache/CacheManager";

const cacheMgr: CacheManager = CacheManager.getInstance();

const moment = require("moment-timezone");

export class MusicStateManager {
  static readonly WINDOWS_SPOTIFY_TRACK_FIND: string =
    'tasklist /fi "imagename eq Spotify.exe" /fo list /v | find " - "';

  private static instance: MusicStateManager;

  private existingTrack: Track = new Track();
  private endCheckThresholdMillis: number = 1000 * 19;
  private endCheckTimeout: any = null;
  private lastIntervalSongCheck: number = 0;
  private lastSongCheck: number = 0;

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
    const selectedPlaylist = MusicDataManager.getInstance().selectedPlaylist;
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
   * Check if the track is close to ending, if so gather music as soon as
   * it's determined that it has changed.
   */
  public async trackEndCheck() {
    const dataMgr: MusicDataManager = MusicDataManager.getInstance();
    if (dataMgr.runningTrack && dataMgr.runningTrack.id) {
      const currProgress_ms = dataMgr.runningTrack.progress_ms || 0;

      let duration_ms = 0;
      // applescript doesn't have duration_ms but has duration
      if (dataMgr.runningTrack.duration) {
        duration_ms = dataMgr.runningTrack.duration;
      } else {
        duration_ms = dataMgr.runningTrack.duration_ms || 0;
      }
      const diff = duration_ms - currProgress_ms;

      // if the diff is less than the threshold and the endCheckTimeout
      // should is null then we'll schedule a gatherMusicInfo fetch
      if (diff > 0 && diff <= this.endCheckThresholdMillis && !this.endCheckTimeout) {
        // schedule a call to fetch the next track in 5 seconds
        this.scheduleGatherMusicInfo(diff);
      }
    }
  }

  private scheduleGatherMusicInfo(timeout = 5000) {
    timeout = timeout + 1000;
    const self = this;
    this.endCheckTimeout = setTimeout(() => {
      self.gatherMusicInfo();
      self.endCheckTimeout = null;
    }, timeout);
  }

  public async gatherMusicInfoRequest() {
    const utcLocalTimes = this.getUtcAndLocal();
    const diff = utcLocalTimes.utc - this.lastIntervalSongCheck;

    // i.e. if the check seconds is 20, we'll subtract 2 and get 18 seconds
    // which means it would be at least 2 more seconds until the gather music
    // check will happen and is allowable to perform this intermediate check
    const threshold = DEFAULT_CURRENTLY_PLAYING_TRACK_CHECK_SECONDS - 2;
    if (diff < threshold || diff > DEFAULT_CURRENTLY_PLAYING_TRACK_CHECK_SECONDS) {
      // make the call
      this.gatherMusicInfo(false /*updateIntervalSongCheckTime*/);
    }
    // otherwise we'll just wait until the interval call is made
  }

  /**
   * Core logic in gathering tracks. This is called every 20 seconds.
   */
  public async gatherMusicInfo(updateIntervalSongCheckTime = true): Promise<any> {
    const dataMgr: MusicDataManager = MusicDataManager.getInstance();

    try {
      const utcLocalTimes = this.getUtcAndLocal();

      const diff = utcLocalTimes.utc - this.lastSongCheck;
      if (diff > 0 && diff < 1) {
        // it's getting called too quickly, bail out
        return;
      }

      const requiresAccess = requiresSpotifyAccess();

      if (requiresAccess) {
        // either no device ID, requires spotify connection,
        // or it's a windows device that is not online
        return;
      }

      const deviceId = getDeviceId();

      // check if we've set the existing device id but don't have a device
      if ((!this.existingTrack || !this.existingTrack.id) && !deviceId && !isMac()) {
        // no existing track and no device, skip checking
        return;
      }

      let playingTrack: Track = null;
      if (isMac()) {
        // fetch from the desktop
        playingTrack = await getTrack(PlayerName.SpotifyDesktop);
        // applescript doesn't always return a name
        if (deviceId && (!playingTrack || !playingTrack.name)) {
          playingTrack = await getTrack(PlayerName.SpotifyWeb);
        }
      } else {
        playingTrack = await getTrack(PlayerName.SpotifyWeb);
      }

      // set the last time we checked
      if (updateIntervalSongCheckTime) {
        this.lastIntervalSongCheck = utcLocalTimes.utc;
      }
      // this one is always set
      this.lastSongCheck = utcLocalTimes.utc;

      if (!playingTrack || (playingTrack && playingTrack.httpStatus >= 400)) {
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

      const isNewTrack = this.existingTrack.id !== playingTrack.id ? true : false;
      const sendSongSession = isNewTrack && this.existingTrack.id ? true : false;
      const trackStateChanged = this.existingTrack.state !== playingTrack.state ? true : false;

      // has the existing track ended or have we started a new track?
      if (sendSongSession) {
        // just set it to playing
        this.existingTrack.state = TrackStatus.Playing;

        // copy the existing track to "songSession"
        const songSession = {
          ...this.existingTrack,
        };

        // clear the track.
        this.existingTrack = null;

        if (playingTrack) {
          this.existingTrack = new Track();
        }
      }

      if (!this.existingTrack || this.existingTrack.id !== playingTrack.id) {
        // update the entire object if the id's don't match
        this.existingTrack = { ...playingTrack };
      }

      if (this.existingTrack.state !== playingTrack.state) {
        // update the state if the state doesn't match
        this.existingTrack.state = playingTrack.state;
      }

      // set the start for the playing track
      if (this.existingTrack && this.existingTrack.id && !this.existingTrack["start"]) {
        this.existingTrack["start"] = utcLocalTimes.utc;
        this.existingTrack["local_start"] = utcLocalTimes.local;
        this.existingTrack["end"] = 0;
      }

      // make sure we set the current progress and duratio
      if (isValidTrack) {
        this.existingTrack.duration = playingTrack.duration || 0;
        this.existingTrack.duration_ms = playingTrack.duration_ms || 0;
        this.existingTrack.progress_ms = playingTrack.progress_ms || 0;
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

  private isValidTrack(playingTrack: Track) {
    if (playingTrack && playingTrack.id) {
      return true;
    }
    return false;
  }

  public async updateRunningTrackToMostRecentlyPlayed() {
    // get the most recently played track
    const before = moment().utc().valueOf();
    const resp: CodyResponse = await getSpotifyRecentlyPlayedBefore(1, before);
    if (resp && resp.data && resp.data.tracks && resp.data.tracks.length) {
      MusicDataManager.getInstance().runningTrack = resp.data.tracks[0];
    }
  }
}
