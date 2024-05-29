import { window, StatusBarAlignment, StatusBarItem } from "vscode";
import { getSongDisplayName, getItem, setItem } from "../Util";
import { TrackStatus, Track, getRunningTrack } from "cody-music";
import { getBestActiveDevice, isLikedSong, requiresSpotifyAccess, requiresSpotifyReAuthentication } from "../managers/PlaylistDataManager";
import { SPOTIFY_LIKED_SONGS_PLAYLIST_ID } from '../Constants';

export interface Button {
  /**
   * Id of button
   */
  id: string;
  tooltip: string;
  /**
   * Generator of text for button(Octicons)
   */
  dynamicText?: (cond: boolean) => string;
  /**
   * Generator of color for button
   */
  dynamicColor?: (cond: boolean) => string;
  /**
   * vscode status bar item
   */
  statusBarItem: StatusBarItem;
}

export class MusicCommandManager {
  private static _initialized: boolean = false;
  private static _buttons: Button[] = [];
  private static _hideSongTimeout = null;
  private static _songButton: Button = null;
  private static _musicTimeLabelButton: Button = null;
  private static _hideCurrentSongTimeout: any = null;

  private constructor() {
    // private to prevent non-singleton usage
  }

  public static isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Initialize the music command manager.
   * Create the list of status bar buttons that will be displayed.
   */
  public static async initialize() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;
    const musictimeMenuTooltip = await this.getMusicMenuTooltip();

    let requiresReAuth = requiresSpotifyReAuthentication();
    const requiresAccessToken = await requiresSpotifyAccess();

    if (!requiresAccessToken && requiresReAuth) {
      setItem("requiresSpotifyReAuth", false);
      requiresReAuth = false;
    }

    const action = requiresReAuth ? "Reconnect" : "Connect";

    // start with 100 0and go down in sequence
    this._musicTimeLabelButton = this.createButton("🎧 MusicTime", musictimeMenuTooltip, "musictime.songTitleRefresh", 999);
    this.createButton(`${action} Spotify`, `${action} Spotify to add your top productivity tracks.`, "musictime.connectSpotify", 999);
    // play previous or unicode ⏪
    this.createButton("$(chevron-left)", "Previous", "musictime.previous", 999);
    // 998 buttons (play, pause)
    this.createButton("$(play)", "Play", "musictime.play", 998);
    // pause unicode ⏸
    this.createButton("$(primitive-square)", "Stop", "musictime.pause", 998);
    // play next ⏩
    this.createButton("$(chevron-right)", "Next", "musictime.next", 997);
    // 996 buttons (unlike, like)
    this.createButton("♡", "Like", "musictime.like", 996);
    this.createButton("♥", "Unlike", "musictime.unlike", 996);
    // button area for the current song name
    this.createButton("", "Click to view track", "musictime.currentSong", 994);
    this.syncControls();
  }

  public static async syncControls() {
    if (this._hideSongTimeout) {
      clearTimeout(this._hideSongTimeout);
    }

    let track: Track = await getRunningTrack();
    if (!track) {
      track = new Track();
    }

    const pauseIt = track.state === TrackStatus.Playing;

    const requiresAccessToken = await requiresSpotifyAccess();
    let requiresReAuth = requiresSpotifyReAuthentication();

    if (!requiresAccessToken && requiresReAuth) {
      setItem("requiresSpotifyReAuth", false);
      requiresReAuth = false;
    }

    const requiresAuth = requiresAccessToken || requiresReAuth ? true : false;

    if (requiresAuth) {
      this.showLaunchPlayerControls();
    } else {
      if (pauseIt) {
        this.showPauseControls(track);
      } else {
        this.showPlayControls(track);
      }
    }
  }

  /**
   * Create a status bar button
   * @param text
   * @param tooltip
   * @param command
   * @param priority
   */
  private static createButton(text: string, tooltip: string, command: string, priority: number) {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, priority);
    statusBarItem.text = text;
    statusBarItem.command = command;
    statusBarItem.tooltip = tooltip;

    const button: Button = {
      id: command,
      statusBarItem,
      tooltip: tooltip,
    };

    this._buttons.push(button);
    return button;
  }

  /**
   * Show launch is when the user needs to connect to spotify
   */
  private static async showLaunchPlayerControls() {
    if (!this._buttons || this._buttons.length === 0) {
      return;
    }

    const requiresAccessToken = await requiresSpotifyAccess();
    let requiresReAuth = requiresSpotifyReAuthentication();

    if (!requiresAccessToken && requiresReAuth) {
      setItem("requiresSpotifyReAuth", false);
      requiresReAuth = false;
    }

    const tooltip = await this.getMusicMenuTooltip();

    // hide all except for the launch player button and possibly connect spotify button
    this._buttons = this._buttons.map((button) => {
      const btnCmd = button.statusBarItem.command;

      const isMusicTimeMenuButton = btnCmd === "musictime.displaySidebar";
      const isConnectButton = btnCmd === "musictime.connectSpotify";

      if (isMusicTimeMenuButton) {
        button.tooltip = tooltip;
        // always show the headphones button for the launch controls function
        button.statusBarItem.show();
      } else if (isConnectButton && requiresReAuth) {
        // show the connect button
        button.statusBarItem.show();
        button.statusBarItem.text = `Reconnect Spotify`;
      } else {
        // hide the rest
        button.statusBarItem.hide();
      }
      return button;
    });
  }

  /**
   * Show the buttons to play a track
   * @param trackInfo
   */
  private static async showPlayControls(track: Track) {
    if (!track && !getBestActiveDevice()) {
      this.showLaunchPlayerControls();
    }

    if (!this._buttons || this._buttons.length === 0) {
      return;
    }

    const trackName = track.name;
    const songInfo = track.artist;
    const tooltip = await this.getMusicMenuTooltip();
    const isLiked = await isLikedSong(track);

    this._buttons.map((button) => {
      const btnCmd = button.statusBarItem.command;
      const isMusicTimeMenuButton = btnCmd === "musictime.displaySidebar";
      const isPlayButton = btnCmd === "musictime.play";
      const isLikedButton = btnCmd === "musictime.like";
      const isUnLikedButton = btnCmd === "musictime.unlike";
      const currentSongButton = btnCmd === "musictime.currentSong";
      const isPrevButton = btnCmd === "musictime.previous";
      const isNextButton = btnCmd === "musictime.next";

      if (isMusicTimeMenuButton || isPrevButton || isNextButton) {
        if (isMusicTimeMenuButton) {
          button.tooltip = tooltip;
        }
        // always show the headphones menu icon
        button.statusBarItem.show();
      } else if (isLikedButton && trackName) {
        if (isLiked) {
          button.statusBarItem.hide();
        } else {
          button.statusBarItem.show();
        }
      } else if (isUnLikedButton && trackName) {
        if (isLiked) {
          button.statusBarItem.show();
        } else {
          button.statusBarItem.hide();
        }
      } else if (currentSongButton) {
        button.statusBarItem.tooltip = `${songInfo}`;
        button.statusBarItem.text = getSongDisplayName(trackName);
        button.statusBarItem.show();
        this._songButton = button;
      } else if (isPlayButton) {
        if (songInfo) {
          // show the song info over the play button
          button.statusBarItem.tooltip = `${button.tooltip} - ${songInfo}`;
        }
        button.statusBarItem.show();
      } else {
        button.statusBarItem.hide();
      }
    });

    this.hideCurrentSong();
  }

  /**
   * Show the buttons to pause a track
   * @param trackInfo
   */
  private static async showPauseControls(trackInfo: Track) {
    if (!trackInfo && !getBestActiveDevice()) {
      this.showLaunchPlayerControls();
    } else if (!trackInfo) {
      trackInfo = new Track();
    }

    if (!this._buttons || this._buttons.length === 0) {
      return;
    }

    const trackName = trackInfo ? trackInfo.name : "";
    const songInfo = trackInfo && trackInfo.id ? `${trackInfo.name} (${trackInfo.artist})` : "";
    const tooltip = await this.getMusicMenuTooltip();
    const isLiked = !!((trackInfo && trackInfo["playlist_id"] === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) || (await isLikedSong(trackInfo)));

    this._buttons.map((button) => {
      const btnCmd = button.statusBarItem.command;
      const isMusicTimeMenuButton = btnCmd === "musictime.displaySidebar";
      const isPauseButton = btnCmd === "musictime.pause";
      const isLikedButton = btnCmd === "musictime.like";
      const isUnLikedButton = btnCmd === "musictime.unlike";
      const currentSongButton = btnCmd === "musictime.currentSong";
      const isPrevButton = btnCmd === "musictime.previous";
      const isNextButton = btnCmd === "musictime.next";

      if (isMusicTimeMenuButton || isPrevButton || isNextButton) {
        if (isMusicTimeMenuButton) {
          button.tooltip = tooltip;
        }
        // always show the headphones menu icon
        button.statusBarItem.show();
      } else if (isLikedButton && trackName) {
        if (isLiked) {
          button.statusBarItem.hide();
        } else {
          button.statusBarItem.show();
        }
      } else if (isUnLikedButton && trackName) {
        if (isLiked) {
          button.statusBarItem.show();
        } else {
          button.statusBarItem.hide();
        }
      } else if (currentSongButton) {
        button.statusBarItem.tooltip = `${songInfo}`;
        button.statusBarItem.text = getSongDisplayName(trackName);
        button.statusBarItem.show();
        this._songButton = button;
      } else if (isPauseButton) {
        if (songInfo) {
          button.statusBarItem.tooltip = `${button.tooltip} - ${songInfo}`;
        }
        button.statusBarItem.show();
      } else {
        button.statusBarItem.hide();
      }
    });

    this.hideCurrentSong();
  }

  private static async getMusicMenuTooltip() {
    const name = getItem("name");

    const requiresAccessToken = await requiresSpotifyAccess();
    let requiresReAuth = requiresSpotifyReAuthentication();

    if (!requiresAccessToken && requiresReAuth) {
      setItem("requiresSpotifyReAuth", false);
      requiresReAuth = false;
    }

    if (requiresAccessToken || requiresReAuth) {
      const action = requiresReAuth ? "Reconnect" : "Connect";
      return `${action} Spotify`;
    }

    let musicTimeTooltip = "Click to see more from Music Time";
    if (name) {
      musicTimeTooltip = `${musicTimeTooltip} (${name})`;
    }
    return musicTimeTooltip;
  }

  private static hideCurrentSong() {
    if (this._hideCurrentSongTimeout) {
      // cancel the current timeout
      clearTimeout(this._hideCurrentSongTimeout);
      this._hideCurrentSongTimeout = null;
    }

    this._hideCurrentSongTimeout = setTimeout(() => {
      if (this._musicTimeLabelButton) {
        // show the "MusicTime" label
        this._musicTimeLabelButton.statusBarItem.show();
      }
      if (this._songButton) {
        // this._songButton.statusBarItem.hide();
        this._buttons.map((button) => {
          if (button.statusBarItem.command !== "musictime.displaySidebar" && button.statusBarItem.command !== "musictime.songTitleRefresh") {
            button.statusBarItem.hide();
          }
        });
      }
    }, 10000);
  }
}
