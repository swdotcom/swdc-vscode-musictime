import {
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
  getRunningTrack,
} from "cody-music";
import { window, commands } from "vscode";
import { MusicCommandManager } from "./MusicCommandManager";
import { showQuickPick } from "../MenuManager";
import { playInitialization, playNextLikedSong, playPreviousLikedSongs } from "../managers/PlaylistControlManager";
import { createSpotifyIdFromUri, createUriFromTrackId, isMac, getCodyErrorMessage, isWindows } from "../Util";
import {
  SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
  OK_LABEL,
  SPOTIFY_LIKED_SONGS_PLAYLIST_ID,
  RECOMMENDATION_PLAYLIST_ID,
} from "../app/utils/view_constants";
import { MusicStateManager } from "./MusicStateManager";
import { SocialShareManager } from "../social/SocialShareManager";
import { MusicPlaylistManager } from "./MusicPlaylistManager";
import { MusicCommandUtil } from "./MusicCommandUtil";
import { connectSpotify, isPremiumUser } from "../managers/SpotifyManager";
import {
  getBestActiveDevice,
  getDeviceSet,
  getSelectedTrackItem,
  getSpotifyPlaylists,
  isLikedSongPlaylistSelected,
  isTrackRepeating,
  removeTracksFromRecommendations,
  sortPlaylists,
  requiresSpotifyAccess,
  removeTrackFromLikedPlaylist,
  getCachedRunningTrack,
  addTrackToLikedPlaylist,
  createPlaylistItemFromTrack,
  getSelectedPlaylistId,
  updateLikedStatusInPlaylist,
} from "../managers/PlaylistDataManager";
import { connectSlackWorkspace, hasSlackWorkspaces } from "../managers/SlackManager";

const clipboardy = require("clipboardy");

export class MusicControlManager {
  private currentTrackToAdd: PlaylistItem = null;

  private static instance: MusicControlManager;

  private constructor() {
    //
  }

  static getInstance(): MusicControlManager {
    if (!MusicControlManager.instance) {
      MusicControlManager.instance = new MusicControlManager();
    }

    return MusicControlManager.instance;
  }

  async nextSong() {
    if (isLikedSongPlaylistSelected()) {
      await playNextLikedSong();
    } else if (this.useSpotifyDesktop()) {
      await next(PlayerName.SpotifyDesktop);
    } else {
      await MusicCommandUtil.getInstance().runSpotifyCommand(next, [PlayerName.SpotifyWeb]);
    }

    setTimeout(() => {
      MusicStateManager.getInstance().fetchTrack();
    }, 1000);
  }

  async previousSong() {
    if (isLikedSongPlaylistSelected()) {
      await playPreviousLikedSongs();
    } else if (this.useSpotifyDesktop()) {
      await previous(PlayerName.SpotifyDesktop);
    } else {
      await MusicCommandUtil.getInstance().runSpotifyCommand(previous, [PlayerName.SpotifyWeb]);
    }

    setTimeout(() => {
      MusicStateManager.getInstance().fetchTrack();
    }, 1000);
  }

  /**
   * {status, state, statusText, message, data.status, error}
   */
  async playSong(tries = 0) {
    let result: any = null;
    const deviceId = getBestActiveDevice();
    const controlMgr: MusicControlManager = MusicControlManager.getInstance();
    if (!deviceId && tries === 1) {
      // initiate the device selection prompt
      await playInitialization(controlMgr.playSong);
    } else {
      let runningTrack = await getRunningTrack();
      if (!runningTrack || !runningTrack.id) {
        runningTrack = await getTrack(PlayerName.SpotifyWeb);
        if (!runningTrack || !runningTrack.id) {
          runningTrack = await MusicStateManager.getInstance().updateRunningTrackToMostRecentlyPlayed();
          const device = getBestActiveDevice();
          const result: any = await MusicCommandUtil.getInstance().runSpotifyCommand(play, [
            PlayerName.SpotifyWeb,
            {
              track_ids: [runningTrack.id],
              device_id: device?.id,
              offset: 0,
            },
          ]);
        }
      } else {
        if (controlMgr.useSpotifyDesktop()) {
          result = await play(PlayerName.SpotifyDesktop);
        } else {
          result = await MusicCommandUtil.getInstance().runSpotifyCommand(play, [PlayerName.SpotifyWeb]);
        }

        if (result && (result.status < 300 || result === "ok")) {
          MusicCommandManager.syncControls(runningTrack, true, TrackStatus.Playing);
        }
      }

      setTimeout(() => {
        MusicStateManager.getInstance().fetchTrack();
      }, 1000);
    }
  }

  async pauseSong() {
    let result: any = null;
    if (this.useSpotifyDesktop()) {
      result = await pause(PlayerName.SpotifyDesktop);
    } else {
      result = await MusicCommandUtil.getInstance().runSpotifyCommand(pause, [PlayerName.SpotifyWeb]);
    }

    if (result && (result.status < 300 || result === "ok")) {
      MusicCommandManager.syncControls(await getRunningTrack(), true, TrackStatus.Paused);
    }

    setTimeout(() => {
      MusicStateManager.getInstance().fetchTrack();
    }, 1000);
  }

  async setShuffleOn() {
    const device = getBestActiveDevice();
    await setShuffle(PlayerName.SpotifyWeb, true, device?.id);

    setTimeout(() => {
      MusicStateManager.getInstance().fetchTrack();
    }, 1000);
  }

  async setShuffleOff() {
    const device = getBestActiveDevice();
    await setShuffle(PlayerName.SpotifyWeb, false, device?.id);

    setTimeout(() => {
      MusicStateManager.getInstance().fetchTrack();
    }, 1000);
  }

  async setRepeatTrackOn() {
    const device = getBestActiveDevice();
    await setRepeatTrack(PlayerName.SpotifyWeb, device?.id);

    setTimeout(() => {
      MusicStateManager.getInstance().fetchTrack();
    }, 1000);
  }

  async setRepeatPlaylistOn() {
    const device = getBestActiveDevice();
    await setRepeatPlaylist(PlayerName.SpotifyWeb, device?.id);

    setTimeout(() => {
      MusicStateManager.getInstance().fetchTrack();
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
      MusicStateManager.getInstance().fetchTrack();
    }, 1000);
  }

  async setMuteOn() {
    const playerDevice: PlayerDevice = getBestActiveDevice();
    await MusicCommandUtil.getInstance().runSpotifyCommand(mute, [PlayerName.SpotifyWeb, playerDevice?.id]);
    setTimeout(() => {
      MusicStateManager.getInstance().fetchTrack();
    }, 1000);
  }

  async setMuteOff() {
    const playerDevice: PlayerDevice = getBestActiveDevice();
    // setVolume(PlayerName.SpotifyWeb, 50);
    const result = await MusicCommandUtil.getInstance().runSpotifyCommand(unmute, [PlayerName.SpotifyWeb, playerDevice?.id]);
    setTimeout(() => {
      MusicStateManager.getInstance().fetchTrack();
    }, 1000);
  }

  useSpotifyDesktop() {
    const { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice, activeDesktopPlayerDevice } = getDeviceSet();

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
    const trackRepeating = await isTrackRepeating();

    // get the selected track
    const selectedTrack = getSelectedTrackItem();

    const isLikedSongsPlaylist = selectedTrack["playlist_id"] === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
    const playlistId = isLikedSongsPlaylist ? "" : selectedTrack["playlist_id"];

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
        MusicStateManager.getInstance().fetchTrack();
      }, 1000);
    }, 2000);
  }

  /**
   * Helper function to play a track or playlist if we've determined to play
   * against the mac spotify desktop app.
   */
  async playSpotifyDesktopPlaylistTrack(devices: PlayerDevice[]) {
    const trackRepeating = await isTrackRepeating();

    const selectedTrack: PlaylistItem = getSelectedTrackItem();

    // get the selected playlist
    const isPrem = isPremiumUser();
    const isWin = isWindows();
    // get the selected track
    const isLikedSongsPlaylist = selectedTrack["playlist_id"] === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;

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
        playSpotifyMacDesktopTrack(selectedTrack.id, selectedTrack["playlist_id"]);
      } else {
        this.playSpotifyByTrackAndPlaylist(selectedTrack["playlist_id"], selectedTrack.id);
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
        MusicStateManager.getInstance().fetchTrack();
      }, 1000);
    }, 2000);
  }

  async playSpotifyByTrackAndPlaylist(playlistId: string, trackId: string) {
    const device = getBestActiveDevice();
    // just play the 1st track
    await playSpotifyPlaylist(playlistId, trackId, device?.id);
  }

  async playSpotifyByTrack(track: PlaylistItem, devices: PlayerDevice[] = []) {
    const device = getBestActiveDevice();

    if (device) {
      playSpotifyTrack(track.id, device.id);
    } else if (!isWindows()) {
      // try with the desktop app
      playSpotifyMacDesktopTrack(track.id);
    } else {
      // just try to play it without the device
      playSpotifyTrack(track.id, "");
    }
  }

  async setLiked(track: any, liked: boolean) {
    let trackId = track?.id;
    if (!trackId) {
      // check to see if we have a running track
      const runningTrack: Track = await getCachedRunningTrack();
      track = createPlaylistItemFromTrack(runningTrack, 0);
      trackId = runningTrack?.id;
    }
    if (!trackId) {
      window.showInformationMessage(`No track currently playing. Please play a track to use this feature.`);
      return;
    }

    let isRecommendationTrack = false;
    let selectedPlaylistId = getSelectedPlaylistId();
    if (!selectedPlaylistId) {
      selectedPlaylistId = track["playlist_id"];
    }
    if (selectedPlaylistId === RECOMMENDATION_PLAYLIST_ID) {
      isRecommendationTrack = true;
    }

    // save the spotify track to the users liked songs playlist
    if (liked) {
      await saveToSpotifyLiked([trackId]);
      // add it to the liked songs playlist
      addTrackToLikedPlaylist(track);
    } else {
      await removeFromSpotifyLiked([trackId]);
      // remove from the cached liked list
      removeTrackFromLikedPlaylist(trackId);
    }

    if (isRecommendationTrack) {
      updateLikedStatusInPlaylist(selectedPlaylistId, trackId, liked);
      commands.executeCommand("musictime.refreshMusicTimeView", "recommendations", selectedPlaylistId);
    } else {
      // update liked state in the playlist the track is in
      if (selectedPlaylistId !== SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
        updateLikedStatusInPlaylist(selectedPlaylistId, trackId, liked);
      }
      if (selectedPlaylistId) {
        commands.executeCommand("musictime.refreshMusicTimeView", "playlists", selectedPlaylistId);
      }
    }

    setTimeout(() => {
      MusicStateManager.getInstance().fetchTrack();
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
    const selectedItem: PlaylistItem = getSelectedTrackItem();
    this.copySpotifyLink(selectedItem.id, false);
  }

  copyCurrentPlaylistLink() {
    // example: https://open.spotify.com/playlist/0mwG8hCL4scWi8Nkt7jyoV
    const selectedItem: PlaylistItem = getSelectedTrackItem();
    this.copySpotifyLink(selectedItem["playlist_id"], true);
  }

  shareCurrentPlaylist() {
    const socialShare: SocialShareManager = SocialShareManager.getInstance();
    const selectedItem: PlaylistItem = getSelectedTrackItem();
    const url = buildSpotifyLink(selectedItem["playlist_id"], true);

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

    menuOptions.items.push({
      label: "Submit an issue on GitHub",
      detail: "Encounter a bug? Submit an issue on our GitHub page",
      url: "https://github.com/swdotcom/swdc-vscode-musictime/issues",
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
          command: "musictime.disconnectSlack",
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
        return !text || text.trim().length === 0 ? "Please enter a playlist name to continue." : null;
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
    let playlists: PlaylistItem[] = await getSpotifyPlaylists();

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
      const matchingPlaylists = playlists.filter((n: PlaylistItem) => n.name === pick.label).map((n: PlaylistItem) => n);
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
            await getSpotifyPlaylists(true);
          } else {
            // it's a liked songs playlist update
            let track: Track = await getRunningTrack();
            if (track.id !== trackId) {
              track = new Track();
              track.id = playlistItem.id;
              track.playerType = playlistItem.playerType;
              track.state = playlistItem.state;
            }
            await this.setLiked(playlistItem, true);
          }
          if (!errMsg) {
            window.showInformationMessage(`Added ${playlistItem.name} to ${playlistName}`);
            // refresh the playlist and clear the current recommendation metadata
            removeTracksFromRecommendations(trackId);
            commands.executeCommand("musictime.refreshMusicTimeView");
          } else {
            if (errMsg) {
              window.showErrorMessage(`Failed to add '${playlistItem.name}' to '${playlistName}'. ${errMsg}`, ...[OK_LABEL]);
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
