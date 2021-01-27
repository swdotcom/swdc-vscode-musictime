import {
  PlayerType,
  play,
  pause,
  previous,
  next,
  PlayerName,
  Track,
  PlaylistItem,
  saveToSpotifyLiked,
  addTracksToPlaylist,
  removeFromSpotifyLiked,
  setItunesLoved,
  repeatOn,
  repeatOff,
  PlayerDevice,
  playSpotifyMacDesktopTrack,
  playSpotifyTrack,
  playSpotifyPlaylist,
  TrackStatus,
  setShuffle,
  setRepeatPlaylist,
  setRepeatTrack,
  mute,
  unmute,
  getTrack,
  getSpotifyLikedSongs,
} from "cody-music";
import { window, ViewColumn, Uri, commands } from "vscode";
import { MusicCommandManager } from "./MusicCommandManager";
import { showQuickPick } from "../MenuManager";
import {
  populateSpotifyPlaylists,
} from "../DataController";
import {
  createSpotifyIdFromUri,
  createUriFromTrackId,
  isMac,
  getCodyErrorMessage,
  isWindows,
  checkRegistration,
} from "../Util";
import {
  REFRESH_CUSTOM_PLAYLIST_TITLE,
  GENERATE_CUSTOM_PLAYLIST_TITLE,
  REFRESH_CUSTOM_PLAYLIST_TOOLTIP,
  GENERATE_CUSTOM_PLAYLIST_TOOLTIP,
  SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
  PERSONAL_TOP_SONGS_PLID,
  OK_LABEL,
} from "../Constants";
import { MusicStateManager } from "./MusicStateManager";
import { SocialShareManager } from "../social/SocialShareManager";
import { tmpdir } from "os";
import { connectSlackWorkspace, hasSlackWorkspaces } from "../managers/SlackManager";
import { MusicManager } from "./MusicManager";
import { MusicPlaylistManager } from "./MusicPlaylistManager";
import { sortPlaylists, requiresSpotifyAccess, getDeviceSet, getDeviceId } from "./MusicUtil";
import { MusicDataManager } from "./MusicDataManager";
import { MusicCommandUtil } from "./MusicCommandUtil";
import {
  fetchMusicTimeMetricsMarkdownDashboard,
  getMusicTimeMarkdownFile,
  getSoftwareDir,
} from "../managers/FileManager";
import { connectSpotify, isPremiumUser } from "../managers/SpotifyManager";

const fileIt = require("file-it");
const clipboardy = require("clipboardy");


export class MusicControlManager {
  private currentTrackToAdd: PlaylistItem = null;

  private static instance: MusicControlManager;

  private dataMgr: MusicDataManager;
  private musicCmdUtil: MusicCommandUtil;
  private stateMgr: MusicStateManager;

  private constructor() {
    this.dataMgr = MusicDataManager.getInstance();
    this.musicCmdUtil = MusicCommandUtil.getInstance();
    this.stateMgr = MusicStateManager.getInstance();
  }

  static getInstance(): MusicControlManager {
    if (!MusicControlManager.instance) {
      MusicControlManager.instance = new MusicControlManager();
    }

    return MusicControlManager.instance;
  }

  isLikedSongPlaylist() {
    return this.dataMgr.selectedPlaylist &&
     this.dataMgr.selectedPlaylist.id === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME
      ? true
      : false;
  }

  async nextSong() {
    if (this.isLikedSongPlaylist()) {
      await MusicManager.getInstance().playNextLikedSong();
    } else if (this.useSpotifyDesktop()) {
      await next(PlayerName.SpotifyDesktop);
    } else {
      await this.musicCmdUtil.runSpotifyCommand(next, [PlayerName.SpotifyWeb]);
    }

    setTimeout(() => {
      this.stateMgr.fetchTrack();
    }, 1000);
  }

  async previousSong() {
    if (this.isLikedSongPlaylist()) {
      await MusicManager.getInstance().playPreviousLikedSong();
    } else if (this.useSpotifyDesktop()) {
      await previous(PlayerName.SpotifyDesktop);
    } else {
      await this.musicCmdUtil.runSpotifyCommand(previous, [PlayerName.SpotifyWeb]);
    }

    setTimeout(() => {
      this.stateMgr.fetchTrack();
    }, 1000);
  }

  /**
   * {status, state, statusText, message, data.status, error}
   */
  async playSong(tries = 0) {
    let result: any = null;
    const deviceId = getDeviceId();
    const controlMgr: MusicControlManager = MusicControlManager.getInstance();
    if (!deviceId && tries === 1) {
      // initiate the device selection prompt
      await MusicManager.getInstance().playInitialization(controlMgr.playSong);
    } else {
      if (!this.dataMgr.runningTrack || !this.dataMgr.runningTrack.id) {
       this.dataMgr.runningTrack = await getTrack(PlayerName.SpotifyWeb);
        if (!this.dataMgr.runningTrack || !this.dataMgr.runningTrack.id) {
          await this.stateMgr.updateRunningTrackToMostRecentlyPlayed();
          const result: any = await MusicCommandUtil.getInstance().runSpotifyCommand(play, [
            PlayerName.SpotifyWeb,
            {
              track_ids: [this.dataMgr.runningTrack.id],
              device_id: getDeviceId(),
              offset: 0,
            },
          ]);
        }
      } else {
        if (controlMgr.useSpotifyDesktop()) {
          result = await play(PlayerName.SpotifyDesktop);
        } else {
          result = await this.musicCmdUtil.runSpotifyCommand(play, [PlayerName.SpotifyWeb]);
        }

        if (result && (result.status < 300 || result === "ok")) {
          MusicCommandManager.syncControls(this.dataMgr.runningTrack, true, TrackStatus.Playing);
        }
      }

      setTimeout(() => {
        this.stateMgr.fetchTrack();
      }, 1000);
    }
  }

  async pauseSong() {
    let result: any = null;
    if (this.useSpotifyDesktop()) {
      result = await pause(PlayerName.SpotifyDesktop);
    } else {
      result = await this.musicCmdUtil.runSpotifyCommand(pause, [PlayerName.SpotifyWeb]);
    }

    if (result && (result.status < 300 || result === "ok")) {
      MusicCommandManager.syncControls(this.dataMgr.runningTrack, true, TrackStatus.Paused);
    }

    setTimeout(() => {
      this.stateMgr.fetchTrack();
    }, 1000);
  }

  async setShuffleOn() {
    const deviceId = getDeviceId();
    await setShuffle(PlayerName.SpotifyWeb, true, deviceId);

    setTimeout(() => {
      this.stateMgr.fetchTrack();
    }, 1000);
  }

  async setShuffleOff() {
    const deviceId = getDeviceId();
    await setShuffle(PlayerName.SpotifyWeb, false, deviceId);

    setTimeout(() => {
      this.stateMgr.fetchTrack();
    }, 1000);
  }

  async setRepeatTrackOn() {
    const deviceId = getDeviceId();
    await setRepeatTrack(PlayerName.SpotifyWeb, deviceId);

    setTimeout(() => {
      this.stateMgr.fetchTrack();
    }, 1000);
  }

  async setRepeatPlaylistOn() {
    const deviceId = getDeviceId();
    await setRepeatPlaylist(PlayerName.SpotifyWeb, deviceId);

    setTimeout(() => {
      this.stateMgr.fetchTrack();
    }, 1000);
  }

  async setRepeatOnOff(setToOn: boolean) {
    let result = null;
    if (setToOn) {
      result = await repeatOn(PlayerName.SpotifyWeb);
    } else {
      result = await repeatOff(PlayerName.SpotifyWeb);
    }

    setTimeout(() => {
      this.stateMgr.fetchTrack();
    }, 1000);
  }

  async setMuteOn() {
    await this.musicCmdUtil.runSpotifyCommand(mute, [PlayerName.SpotifyWeb]);
  }

  async setMuteOff() {
    await this.musicCmdUtil.runSpotifyCommand(unmute, [PlayerName.SpotifyWeb]);
  }

  useSpotifyDesktop() {
    const {
      webPlayer,
      desktop,
      activeDevice,
      activeComputerDevice,
      activeWebPlayerDevice,
      activeDesktopPlayerDevice,
    } = getDeviceSet();

    if (isMac() && (desktop || activeDesktopPlayerDevice)) {
      return true;
    }
    return false;
  }

  /**
   * Launch and play a spotify track via the web player.
   * @param isTrack boolean
   */
  async playSpotifyWebPlaylistTrack(isTrack: boolean, devices: PlayerDevice[]) {
    const trackRepeating = await MusicManager.getInstance().isTrackRepeating();

    // get the selected playlist
    const selectedPlaylist = this.dataMgr.selectedPlaylist;
    // get the selected track
    const selectedTrack = this.dataMgr.selectedTrackItem;

    const isLikedSongsPlaylist = selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
    const playlistId = isLikedSongsPlaylist ? "" : selectedPlaylist.id;

    if (isLikedSongsPlaylist) {
      await this.playSpotifyByTrack(selectedTrack, devices);
    } else if (isTrack) {
      await this.playSpotifyByTrackAndPlaylist(playlistId, selectedTrack.id);
    } else {
      // play the playlist
      await this.playSpotifyByTrackAndPlaylist(playlistId, "");
    }

    setTimeout(async () => {
      if (trackRepeating) {
        // make sure it set to repeat
        commands.executeCommand("musictime.repeatOn");
      } else {
        // set it to not repeat
        commands.executeCommand("musictime.repeatOff");
      }

      setTimeout(() => {
        this.stateMgr.fetchTrack();
      }, 1000);
    }, 2000);
  }

  /**
   * Helper function to play a track or playlist if we've determined to play
   * against the mac spotify desktop app.
   */
  async playSpotifyDesktopPlaylistTrack(devices: PlayerDevice[]) {
    const trackRepeating = await MusicManager.getInstance().isTrackRepeating();

    // get the selected playlist
    const selectedPlaylist = this.dataMgr.selectedPlaylist;
    const isPrem = isPremiumUser();
    const isWin = isWindows();
    // get the selected track
    const selectedTrack = this.dataMgr.selectedTrackItem;
    const isLikedSongsPlaylist = selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;

    if (isLikedSongsPlaylist) {
      if ((!isWin || isPrem) && devices && devices.length > 0) {
        // just play the 1st track
        this.playSpotifyByTrack(selectedTrack, devices);
      } else if (!isWin) {
        // try with the desktop app
        playSpotifyMacDesktopTrack(selectedTrack.id);
      } else {
        // just try to play it since it's windows and we don't have a device
        playSpotifyTrack(selectedTrack.id, "");
      }
    } else {
      if (!isWin) {
        // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
        // make sure the track has spotify:track and the playlist has spotify:playlist
        playSpotifyMacDesktopTrack(selectedTrack.id, selectedPlaylist.id);
      } else {
        this.playSpotifyByTrackAndPlaylist(selectedPlaylist.id, selectedTrack.id);
      }
    }

    setTimeout(async () => {
      if (trackRepeating) {
        // make sure it set to repeat
        commands.executeCommand("musictime.repeatOn");
      } else {
        // set it to not repeat
        commands.executeCommand("musictime.repeatOff");
      }

      setTimeout(() => {
        this.stateMgr.fetchTrack();
      }, 1000);
    }, 2000);
  }

  async playSpotifyByTrackAndPlaylist(playlistId: string, trackId: string) {
    const deviceId = getDeviceId();
    // just play the 1st track
    await playSpotifyPlaylist(playlistId, trackId, deviceId);
  }

  async playSpotifyByTrack(track: PlaylistItem, devices: PlayerDevice[] = []) {
    const deviceId = getDeviceId();

    if (deviceId) {
      playSpotifyTrack(track.id, deviceId);
    } else if (!isWindows()) {
      // try with the desktop app
      playSpotifyMacDesktopTrack(track.id);
    } else {
      // just try to play it without the device
      playSpotifyTrack(track.id, "");
    }
  }

  async setLiked(liked: boolean, overrideTrack: Track = null) {
    const runningTrack: Track = this.dataMgr.runningTrack;

    const track: Track = !overrideTrack ? runningTrack : overrideTrack;

    if (!track || !track.id) {
      window.showInformationMessage(
        `No track currently playing. Please play a track to use this feature.`
      );
      return;
    }

    if (track.playerType === PlayerType.MacItunesDesktop) {
      // await so that the stateCheckHandler fetches
      // the latest version of the itunes track
      await setItunesLoved(liked).catch((err) => {
        console.log(`Error updating itunes loved state: ${err.message}`);
      });
    } else {
      // save the spotify track to the users liked songs playlist
      if (liked) {
        await saveToSpotifyLiked([track.id]);
      } else {
        await removeFromSpotifyLiked([track.id]);
      }
      // clear the liked songs
      MusicDataManager.getInstance().spotifyLikedSongs = [];
      // repopulate the liked songs
      MusicDataManager.getInstance().spotifyLikedSongs = await getSpotifyLikedSongs();
    }

    runningTrack.loved = liked;
    this.dataMgr.runningTrack = runningTrack;
    MusicCommandManager.syncControls(runningTrack, false);

    // check if it's in the recommendation list
    const foundRecTrack = this.dataMgr.recommendationTracks.find((t: Track) => t.id === track.id);

    if (foundRecTrack) {
      this.dataMgr.removeTrackFromRecommendations(track.id);
      commands.executeCommand("musictime.refreshRecommendationsTree");
    }

    // refresh
    commands.executeCommand("musictime.refreshPlaylist");

    setTimeout(() => {
      this.stateMgr.fetchTrack();
    }, 1000);
  }

  async copySpotifyLink(id: string, isPlaylist: boolean) {
    let link = buildSpotifyLink(id, isPlaylist);

    if (id === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
      link = "https://open.spotify.com/collection/tracks";
    }

    let messageContext = "";
    if (isPlaylist) {
      messageContext = "playlist";
    } else {
      messageContext = "track";
    }

    try {
      clipboardy.writeSync(link);
      window.showInformationMessage(`Spotify ${messageContext} link copied to clipboard.`);
    } catch (err) {
      console.log(`Unable to copy to clipboard, error: ${err.message}`);
    }
  }

  copyCurrentTrackLink() {
    // example: https://open.spotify.com/track/7fa9MBXhVfQ8P8Df9OEbD8
    // get the current track
    const selectedItem: PlaylistItem = this.dataMgr.selectedTrackItem;
    this.copySpotifyLink(selectedItem.id, false);
  }

  copyCurrentPlaylistLink() {
    // example: https://open.spotify.com/playlist/0mwG8hCL4scWi8Nkt7jyoV
    const selectedItem: PlaylistItem = this.dataMgr.selectedPlaylist;
    this.copySpotifyLink(selectedItem.id, true);
  }

  shareCurrentPlaylist() {
    const socialShare: SocialShareManager = SocialShareManager.getInstance();
    const selectedItem: PlaylistItem = this.dataMgr.selectedPlaylist;
    const url = buildSpotifyLink(selectedItem.id, true);

    socialShare.shareIt("facebook", { u: url, hashtag: "OneOfMyFavs" });
  }

  async showMenu() {
    let menuOptions = {
      items: [],
    };

    // check if they need to connect to spotify
    const needsSpotifyAccess = requiresSpotifyAccess();

    // check to see if they have the slack access token
    const hasSlackAccess = hasSlackWorkspaces();

    if (!needsSpotifyAccess) {
      // check if we already have a playlist
      const savedPlaylists: PlaylistItem[] = this.dataMgr.savedPlaylists;

      // check if they've generated a playlist yet
      const customPlaylist = this.dataMgr.getMusicTimePlaylistByTypeId(PERSONAL_TOP_SONGS_PLID);

      let personalPlaylistLabel = !customPlaylist
        ? GENERATE_CUSTOM_PLAYLIST_TITLE
        : REFRESH_CUSTOM_PLAYLIST_TITLE;
      const personalPlaylistTooltip = !customPlaylist
        ? GENERATE_CUSTOM_PLAYLIST_TOOLTIP
        : REFRESH_CUSTOM_PLAYLIST_TOOLTIP;

      if (!savedPlaylists || savedPlaylists.length === 0) {
        // show the generate playlist menu item
        menuOptions.items.push({
          label: personalPlaylistLabel,
          detail: personalPlaylistTooltip,
          cb: MusicManager.getInstance().generateUsersWeeklyTopSongs,
        });
      }
    }

    menuOptions.items.push({
      label: "Dashboard",
      detail: "View your latest music metrics right here in your editor",
      cb: displayMusicTimeMetricsMarkdownDashboard,
    });

    menuOptions.items.push({
      label: "Submit an issue on GitHub",
      detail: "Encounter a bug? Submit an issue on our GitHub page",
      url: "https://github.com/swdotcom/swdc-vscode/issues",
    });

    menuOptions.items.push({
      label: "Submit feedback",
      detail: "Send us an email at cody@software.com",
      url: "mailto:cody@software.com",
    });

    menuOptions.items.push({
      label: "More data at Software.com",
      detail: "See music analytics in the web app",
      command: "musictime.launchAnalytics",
    });

    // show divider
    menuOptions.items.push({
      label: "___________________________________________________________________",
      cb: null,
      url: null,
      command: null,
    });

    if (needsSpotifyAccess) {
      menuOptions.items.push({
        label: "Connect Spotify",
        detail: "To see your Spotify playlists in Music Time, please connect your account",
        url: null,
        cb: connectSpotify,
      });
    } else {
      menuOptions.items.push({
        label: "Disconnect Spotify",
        detail: "Disconnect your Spotify oauth integration",
        url: null,
        command: "musictime.disconnectSpotify",
      });

      if (!hasSlackAccess) {
        menuOptions.items.push({
          label: "Connect Slack",
          detail: "To share a playlist or track on Slack, please connect your account",
          url: null,
          cb: connectSlackWorkspace,
        });
      } else {
        menuOptions.items.push({
          label: "Disconnect Slack",
          detail: "Disconnect your Slack oauth integration",
          url: null,
          command: "musictime.disconnectSlack"
        });
      }
    }

    showQuickPick(menuOptions);
  }

  async showCreatePlaylistInputPrompt(placeHolder: string) {
    return await window.showInputBox({
      value: placeHolder,
      placeHolder: "New Playlist",
      validateInput: (text) => {
        return !text || text.trim().length === 0
          ? "Please enter a playlist name to continue."
          : null;
      },
    });
  }

  async createNewPlaylist() {
    const musicControlMgr: MusicControlManager = MusicControlManager.getInstance();
    // !!! important, need to use the get instance as this
    // method may be called within a callback and "this" will be undefined !!!
    const hasPlaylistItemToAdd = musicControlMgr.currentTrackToAdd ? true : false;
    const placeholder: string = hasPlaylistItemToAdd
      ? `${musicControlMgr.currentTrackToAdd.artist} - ${musicControlMgr.currentTrackToAdd.name}`
      : "New Playlist";
    let playlistName = await musicControlMgr.showCreatePlaylistInputPrompt(placeholder);

    if (playlistName && playlistName.trim().length === 0) {
      window.showInformationMessage("Please enter a playlist name to continue.");
      return;
    }

    if (!playlistName) {
      return;
    }

    const playlistItems = hasPlaylistItemToAdd ? [musicControlMgr.currentTrackToAdd] : [];
    MusicPlaylistManager.getInstance().createPlaylist(playlistName, playlistItems);
  }

  async addToPlaylistMenu(playlistItem: PlaylistItem) {
    this.currentTrackToAdd = playlistItem;
    let menuOptions = {
      items: [
        {
          label: "New Playlist",
          cb: this.createNewPlaylist,
        },
      ],
      placeholder: "Select or Create a playlist",
    };
    let playlists: PlaylistItem[] = MusicManager.getInstance().currentPlaylists;

    // filter out the ones with itemType = playlist
    playlists = playlists
      .filter((n: PlaylistItem) => n.itemType === "playlist" && n.name !== "Software Top 40")
      .map((n: PlaylistItem) => n);

    sortPlaylists(playlists);

    playlists.forEach((item: PlaylistItem) => {
      menuOptions.items.push({
        label: item.name,
        cb: null,
      });
    });

    const pick = await showQuickPick(menuOptions);
    if (pick && pick.label) {
      // add it to this playlist
      const matchingPlaylists = playlists
        .filter((n: PlaylistItem) => n.name === pick.label)
        .map((n: PlaylistItem) => n);
      if (matchingPlaylists.length) {
        const matchingPlaylist = matchingPlaylists[0];
        if (matchingPlaylist) {
          const playlistName = matchingPlaylist.name;
          let errMsg = null;

          const trackUri = playlistItem.uri || createUriFromTrackId(playlistItem.id);
          const trackId = playlistItem.id;

          if (matchingPlaylist.name !== "Liked Songs") {
            // it's a non-liked songs playlist update
            // uri:"spotify:track:2JHCaLTVvYjyUrCck0Uvrp" or id
            const codyResponse = await addTracksToPlaylist(matchingPlaylist.id, [trackUri]);
            errMsg = getCodyErrorMessage(codyResponse);

            // populate the spotify playlists
            await populateSpotifyPlaylists();
          } else {
            // it's a liked songs playlist update
            let track: Track = this.dataMgr.runningTrack;
            if (track.id !== trackId) {
              track = new Track();
              track.id = playlistItem.id;
              track.playerType = playlistItem.playerType;
              track.state = playlistItem.state;
            }
            await this.setLiked(true, track);

            // add to the trackIdsForRecommendations
            this.dataMgr.trackIdsForRecommendations.push(trackId);
          }
          if (!errMsg) {
            window.showInformationMessage(`Added ${playlistItem.name} to ${playlistName}`);
            // refresh the playlist and clear the current recommendation metadata
            this.dataMgr.removeTrackFromRecommendations(trackId);
            commands.executeCommand("musictime.refreshPlaylist");
            commands.executeCommand("musictime.refreshRecommendationsTree");
          } else {
            if (errMsg) {
              window.showErrorMessage(
                `Failed to add '${playlistItem.name}' to '${playlistName}'. ${errMsg}`,
                ...[OK_LABEL]
              );
            }
          }
        }
      }
    }
  }
}

export function buildSpotifyLink(id: string, isPlaylist: boolean) {
  let link = "";
  id = createSpotifyIdFromUri(id);
  if (isPlaylist) {
    link = `https://open.spotify.com/playlist/${id}`;
  } else {
    link = `https://open.spotify.com/track/${id}`;
  }

  return link;
}

export async function displayMusicTimeMetricsMarkdownDashboard() {
  const isRegistered = checkRegistration();
  if (!isRegistered) {
    return;
  }

  const musicTimeFile = getMusicTimeMarkdownFile();
  await fetchMusicTimeMetricsMarkdownDashboard();

  const viewOptions = {
    viewColumn: ViewColumn.One,
    preserveFocus: false,
  };
  const localResourceRoots = [Uri.file(getSoftwareDir()), Uri.file(tmpdir())];
  const panel = window.createWebviewPanel(
    "music-time-preview",
    `Music Time Dashboard`,
    viewOptions,
    {
      enableFindWidget: true,
      localResourceRoots,
      enableScripts: true, // enables javascript that may be in the content
    }
  );

  const content = fileIt.readContentFileSync(musicTimeFile);
  panel.webview.html = content;
}
