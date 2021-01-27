import { createSpotifyIdFromUri, createUriFromTrackId, nowInSecs, isMac } from "../Util";
import {
  Track,
  TrackStatus,
  getTrack,
  PlayerName,
  CodyResponse,
  getSpotifyRecentlyPlayedBefore,
} from "cody-music";
import { MusicCommandManager } from "./MusicCommandManager";
import { MusicDataManager } from "./MusicDataManager";
import { commands } from "vscode";
import { getDeviceId, requiresSpotifyAccess } from "./MusicUtil";

const moment = require("moment-timezone");

export class MusicStateManager {
  private static instance: MusicStateManager;

  private existingTrack: Track = new Track();

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

  public isExistingTrackPlaying(): boolean {
    return this.existingTrack &&
      this.existingTrack.id &&
      this.existingTrack.state === TrackStatus.Playing
      ? true
      : false;
  }

  /**
   * Core logic in gathering tracks. This is called every 20 seconds.
   */
  public async fetchTrack(): Promise<any> {
    const dataMgr: MusicDataManager = MusicDataManager.getInstance();

    try {
      const utcLocalTimes = this.getUtcAndLocal();

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
        MusicDataManager.getInstance().populatePlayerContext();
        if (trackStateChanged) {
          // update the device info in case the device has changed
          commands.executeCommand("musictime.refreshDeviceInfo");
        }
      }
    } catch (e) {
      const errMsg = e.message || e;
      console.error(`Unexpected track state processing error: ${errMsg}`);
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
