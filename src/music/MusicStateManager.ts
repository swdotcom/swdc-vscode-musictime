import { createSpotifyIdFromUri, createUriFromTrackId, nowInSecs, isMac } from "../Util";
import { Track, getTrack, PlayerName, CodyResponse, getSpotifyRecentlyPlayedBefore } from "cody-music";
import { MusicCommandManager } from "./MusicCommandManager";
import { execCmd } from "../managers/ExecManager";
import { getBestActiveDevice, requiresSpotifyAccess } from "../managers/PlaylistDataManager";
const path = require("path");
const moment = require("moment-timezone");

const resourcePath: string = path.join(__dirname, "resources");

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

  public fetchPlayingTrack(): Promise<Track> {
    return getTrack(PlayerName.SpotifyWeb);
  }

  /**
   * Core logic in gathering tracks. This is called every 20 seconds.
   */
  public async fetchTrack(): Promise<any> {
    try {
      const requiresAccess = requiresSpotifyAccess();

      if (requiresAccess) {
        // either no device ID, requires spotify connection,
        // or it's a windows device that is not online
        return;
      }

      const device = getBestActiveDevice();

      // check if we've set the existing device id but don't have a device
      if ((!this.existingTrack || !this.existingTrack.id) && !device?.id && !isMac()) {
        // no existing track and no device, skip checking
        return;
      }

      let playingTrack: Track = null;
      if (isMac()) {
        // fetch from the desktop
        playingTrack = await this.fetchSpotifyMacTrack();
        // applescript doesn't always return a name
        if (device && (!playingTrack || !playingTrack.name)) {
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

      this.existingTrack = { ...playingTrack };

      MusicCommandManager.syncControls(this.existingTrack);
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
      return resp.data.tracks[0];
    }
  }

  private async fetchSpotifyMacTrack() {
    const checkStateScript = path.join(resourcePath, "scripts", "check_state.spotify.applescript");
    const getSpotifyTrackInfo = path.join(resourcePath, "scripts", "get_state.spotify.applescript");
    const isRunning = execCmd(`osascript ${checkStateScript}`);

    if (isRunning === "true") {
      // get the track info
      const trackInfo = execCmd(`osascript ${getSpotifyTrackInfo}`);
      try {
        return JSON.parse(trackInfo);
      } catch (e) {}
    }
    return null;
  }
}
