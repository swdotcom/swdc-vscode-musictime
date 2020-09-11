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
} from "cody-music";
import { window, ViewColumn, Uri, commands } from "vscode";
import { MusicCommandManager } from "./MusicCommandManager";
import { showQuickPick } from "../MenuManager";
import {
  refetchSpotifyConnectStatusLazily,
  getAppJwt,
  populateLikedSongs,
  populateSpotifyPlaylists,
} from "../DataController";
import {
  getItem,
  isLinux,
  logIt,
  launchWebUrl,
  createSpotifyIdFromUri,
  createUriFromTrackId,
  setItem,
  isMac,
  getCodyErrorMessage,
  isWindows,
} from "../Util";
import { softwareGet, softwarePut, isResponseOk } from "../HttpClient";
import {
  api_endpoint,
  REFRESH_CUSTOM_PLAYLIST_TITLE,
  GENERATE_CUSTOM_PLAYLIST_TITLE,
  REFRESH_CUSTOM_PLAYLIST_TOOLTIP,
  GENERATE_CUSTOM_PLAYLIST_TOOLTIP,
  SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
  PERSONAL_TOP_SONGS_PLID,
  YES_LABEL,
  OK_LABEL,
} from "../Constants";
import { MusicStateManager } from "./MusicStateManager";
import { SocialShareManager } from "../social/SocialShareManager";
import { tmpdir } from "os";
import { connectSlack } from "../slack/SlackControlManager";
import { MusicManager } from "./MusicManager";
import { MusicPlaylistManager } from "./MusicPlaylistManager";
import { sortPlaylists, requiresSpotifyAccess, getDeviceSet, getDeviceId } from "./MusicUtil";
import { MusicDataManager } from "./MusicDataManager";
import { MusicCommandUtil } from "./MusicCommandUtil";
import {
  getMusicTimeFile,
  getMusicTimeMarkdownFile,
  getSoftwareDir,
} from "../managers/FileManager";

const fileIt = require("file-it");
const moment = require("moment-timezone");
const clipboardy = require("clipboardy");
const fs = require("fs");
const dataMgr: MusicDataManager = MusicDataManager.getInstance();
const musicCmdUtil: MusicCommandUtil = MusicCommandUtil.getInstance();
const stateMgr: MusicStateManager = MusicStateManager.getInstance();

const NO_DATA = `MUSIC TIME
    Listen to Spotify while coding to generate this playlist`;

let lastDayOfMonth = -1;

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

  isLikedSongPlaylist() {
    return dataMgr.selectedPlaylist &&
      dataMgr.selectedPlaylist.id === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME
      ? true
      : false;
  }

  async nextSong() {
    if (this.isLikedSongPlaylist()) {
      await MusicManager.getInstance().playNextLikedSong();
    } else if (this.useSpotifyDesktop()) {
      await next(PlayerName.SpotifyDesktop);
    } else {
      await musicCmdUtil.runSpotifyCommand(next, [PlayerName.SpotifyWeb]);
    }

    setTimeout(() => {
      stateMgr.gatherMusicInfoRequest();
    }, 500);
  }

  async previousSong() {
    if (this.isLikedSongPlaylist()) {
      await MusicManager.getInstance().playPreviousLikedSong();
    } else if (this.useSpotifyDesktop()) {
      await previous(PlayerName.SpotifyDesktop);
    } else {
      await musicCmdUtil.runSpotifyCommand(previous, [PlayerName.SpotifyWeb]);
    }

    setTimeout(() => {
      stateMgr.gatherMusicInfoRequest();
    }, 500);
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
      if (!dataMgr.runningTrack || !dataMgr.runningTrack.id) {
        dataMgr.runningTrack = await getTrack(PlayerName.SpotifyWeb);
        if (!dataMgr.runningTrack || !dataMgr.runningTrack.id) {
          await stateMgr.updateRunningTrackToMostRecentlyPlayed();
          const result: any = await MusicCommandUtil.getInstance().runSpotifyCommand(play, [
            PlayerName.SpotifyWeb,
            {
              track_ids: [dataMgr.runningTrack.id],
              device_id: getDeviceId(),
              offset: 0,
            },
          ]);
          setTimeout(() => {
            stateMgr.gatherMusicInfoRequest();
          }, 3000);
        }
      } else {
        if (controlMgr.useSpotifyDesktop()) {
          result = await play(PlayerName.SpotifyDesktop);
        } else {
          result = await musicCmdUtil.runSpotifyCommand(play, [PlayerName.SpotifyWeb]);
        }

        if (result && (result.status < 300 || result === "ok")) {
          MusicCommandManager.syncControls(dataMgr.runningTrack, true, TrackStatus.Playing);
        }

        setTimeout(() => {
          stateMgr.gatherMusicInfoRequest();
        }, 500);
      }
    }
  }

  async pauseSong() {
    let result: any = null;
    if (this.useSpotifyDesktop()) {
      result = await pause(PlayerName.SpotifyDesktop);
    } else {
      result = await musicCmdUtil.runSpotifyCommand(pause, [PlayerName.SpotifyWeb]);
    }

    if (result && (result.status < 300 || result === "ok")) {
      MusicCommandManager.syncControls(dataMgr.runningTrack, true, TrackStatus.Paused);
    }

    setTimeout(() => {
      stateMgr.gatherMusicInfoRequest();
    }, 500);
  }

  async setShuffleOn() {
    const deviceId = getDeviceId();
    await setShuffle(PlayerName.SpotifyWeb, true, deviceId);

    setTimeout(() => {
      stateMgr.gatherMusicInfoRequest();
    }, 500);
  }

  async setShuffleOff() {
    const deviceId = getDeviceId();
    await setShuffle(PlayerName.SpotifyWeb, false, deviceId);

    setTimeout(() => {
      stateMgr.gatherMusicInfoRequest();
    }, 500);
  }

  async setRepeatTrackOn() {
    const deviceId = getDeviceId();
    await setRepeatTrack(PlayerName.SpotifyWeb, deviceId);

    setTimeout(() => {
      stateMgr.gatherMusicInfoRequest();
    }, 500);
  }

  async setRepeatPlaylistOn() {
    const deviceId = getDeviceId();
    await setRepeatPlaylist(PlayerName.SpotifyWeb, deviceId);

    setTimeout(() => {
      stateMgr.gatherMusicInfoRequest();
    }, 500);
  }

  async setRepeatOnOff(setToOn: boolean) {
    let result = null;
    if (setToOn) {
      result = await repeatOn(PlayerName.SpotifyWeb);
    } else {
      result = await repeatOff(PlayerName.SpotifyWeb);
    }

    setTimeout(() => {
      stateMgr.gatherMusicInfoRequest();
    }, 500);
  }

  async setMuteOn() {
    await musicCmdUtil.runSpotifyCommand(mute, [PlayerName.SpotifyWeb]);
  }

  async setMuteOff() {
    await musicCmdUtil.runSpotifyCommand(unmute, [PlayerName.SpotifyWeb]);
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
    const selectedPlaylist = dataMgr.selectedPlaylist;
    // get the selected track
    const selectedTrack = dataMgr.selectedTrackItem;

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
        stateMgr.gatherMusicInfoRequest();
      }, 1500);
    }, 2000);
  }

  /**
   * Helper function to play a track or playlist if we've determined to play
   * against the mac spotify desktop app.
   */
  async playSpotifyDesktopPlaylistTrack(devices: PlayerDevice[]) {
    const trackRepeating = await MusicManager.getInstance().isTrackRepeating();

    // get the selected playlist
    const selectedPlaylist = dataMgr.selectedPlaylist;
    const isPrem = MusicManager.getInstance().isSpotifyPremium();
    const isWin = isWindows();
    // get the selected track
    const selectedTrack = dataMgr.selectedTrackItem;
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
        stateMgr.gatherMusicInfoRequest();
      }, 1500);
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
    const runningTrack: Track = dataMgr.runningTrack;

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
        logIt(`Error updating itunes loved state: ${err.message}`);
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
      await populateLikedSongs();
    }

    runningTrack.loved = liked;
    dataMgr.runningTrack = runningTrack;
    MusicCommandManager.syncControls(runningTrack, false);

    let type = "spotify";
    if (track.playerType === PlayerType.MacItunesDesktop) {
      type = "itunes";
    }
    const api = `/music/liked/track/${track.id}?type=${type}`;
    const resp = await softwarePut(api, { liked }, getItem("jwt"));
    if (!isResponseOk(resp)) {
      logIt(`Error updating track like state: ${resp.message}`);
    }

    // check if it's in the recommendation list
    const foundRecTrack = dataMgr.recommendationTracks.find((t: Track) => t.id === track.id);

    if (foundRecTrack) {
      dataMgr.removeTrackFromRecommendations(track.id);
      commands.executeCommand("musictime.refreshRecommendationsTree");
    }

    // refresh
    commands.executeCommand("musictime.refreshPlaylist");

    setTimeout(() => {
      stateMgr.gatherMusicInfoRequest();
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
      logIt(`Unable to copy to clipboard, error: ${err.message}`);
    }
  }

  copyCurrentTrackLink() {
    // example: https://open.spotify.com/track/7fa9MBXhVfQ8P8Df9OEbD8
    // get the current track
    const selectedItem: PlaylistItem = dataMgr.selectedTrackItem;
    this.copySpotifyLink(selectedItem.id, false);
  }

  copyCurrentPlaylistLink() {
    // example: https://open.spotify.com/playlist/0mwG8hCL4scWi8Nkt7jyoV
    const selectedItem: PlaylistItem = dataMgr.selectedPlaylist;
    this.copySpotifyLink(selectedItem.id, true);
  }

  shareCurrentPlaylist() {
    const socialShare: SocialShareManager = SocialShareManager.getInstance();
    const selectedItem: PlaylistItem = dataMgr.selectedPlaylist;
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
    const slackAccessToken = getItem("slack_access_token");

    if (!needsSpotifyAccess) {
      // check if we already have a playlist
      const savedPlaylists: PlaylistItem[] = dataMgr.savedPlaylists;

      // check if they've generated a playlist yet
      const customPlaylist = dataMgr.getMusicTimePlaylistByTypeId(PERSONAL_TOP_SONGS_PLID);

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

    if (!needsSpotifyAccess) {
      menuOptions.items.push({
        label: "Open dashboard",
        detail: "View your latest music metrics right here in your editor",
        cb: displayMusicTimeMetricsMarkdownDashboard,
      });
    }

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

    if (!needsSpotifyAccess) {
      menuOptions.items.push({
        label: "See web analytics",
        detail: "See music analytics in the web app",
        command: "musictime.launchAnalytics",
      });
    }

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

      if (!slackAccessToken) {
        menuOptions.items.push({
          label: "Connect Slack",
          detail: "To share a playlist or track on Slack, please connect your account",
          url: null,
          cb: connectSlack,
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
            let track: Track = dataMgr.runningTrack;
            if (track.id !== trackId) {
              track = new Track();
              track.id = playlistItem.id;
              track.playerType = playlistItem.playerType;
              track.state = playlistItem.state;
            }
            await this.setLiked(true, track);

            // add to the trackIdsForRecommendations
            dataMgr.trackIdsForRecommendations.push(trackId);
          }
          if (!errMsg) {
            window.showInformationMessage(`Added ${playlistItem.name} to ${playlistName}`);
            // refresh the playlist and clear the current recommendation metadata
            dataMgr.removeTrackFromRecommendations(trackId);
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

export async function connectSpotify() {
  let jwt = getItem("jwt");
  if (!jwt) {
    // no jwt, get the app jwt
    jwt = await getAppJwt();
    await setItem("jwt", jwt);
  }

  // check if they're already connected, if so then ask if they would
  // like to continue as we'll need to disconnect the current connection
  const needsSpotifyAccess = requiresSpotifyAccess();
  if (!needsSpotifyAccess) {
    // disconnectSpotify
    const selection = await window.showInformationMessage(
      `Connect with a different Spotify account?`,
      ...[YES_LABEL]
    );
    if (!selection || selection !== YES_LABEL) {
      return;
    }
    // disconnect the current connection
    await disconnectSpotify(false /*confirmDisconnect*/);
  }

  const encodedJwt = encodeURIComponent(jwt);
  const mac = isMac() ? "true" : "false";
  const qryStr = `token=${encodedJwt}&mac=${mac}`;
  const endpoint = `${api_endpoint}/auth/spotify?${qryStr}`;
  launchWebUrl(endpoint);
  refetchSpotifyConnectStatusLazily();
}

export async function switchSpotifyAccount() {
  const selection = await window.showInformationMessage(
    `Are you sure you would like to connect to a different Spotify account?`,
    ...[YES_LABEL]
  );
  if (selection === YES_LABEL) {
    await disconnectSpotify(false);
    connectSpotify();
  }
}

export async function disconnectSpotify(confirmDisconnect = true) {
  await disconnectOauth("Spotify", confirmDisconnect);
}

export async function disconnectSlack(confirmDisconnect = true) {
  await disconnectOauth("Slack", confirmDisconnect);
}

export async function disconnectOauth(type: string, confirmDisconnect = true) {
  const selection = confirmDisconnect
    ? await window.showInformationMessage(
        `Are you sure you would like to disconnect ${type}?`,
        ...[YES_LABEL]
      )
    : YES_LABEL;

  if (selection === YES_LABEL) {
    const type_lc = type.toLowerCase();
    await softwarePut(`/auth/${type_lc}/disconnect`, {}, getItem("jwt"));

    // oauth is not null, initialize spotify
    if (type_lc === "slack") {
      await MusicManager.getInstance().updateSlackAccessInfo(null);
    } else if (type_lc === "spotify") {
      await MusicManager.getInstance().updateSpotifyAccessInfo(null);

      // clear the spotify playlists
      dataMgr.disconnect();

      setTimeout(() => {
        commands.executeCommand("musictime.refreshPlaylist");
        commands.executeCommand("musictime.refreshRecommendations");
      }, 1000);

      // update the status bar
      MusicCommandManager.syncControls(dataMgr.runningTrack, false);
    }

    if (confirmDisconnect) {
      window.showInformationMessage(`Successfully disconnected your ${type} connection.`);
    }
  }
}

export async function fetchMusicTimeMetricsMarkdownDashboard() {
  let file = getMusicTimeMarkdownFile();

  const dayOfMonth = moment().startOf("day").date();
  if (!fs.existsSync(file) || lastDayOfMonth !== dayOfMonth) {
    lastDayOfMonth = dayOfMonth;
    await fetchDashboardData(file, true);
  }
}

export async function fetchMusicTimeMetricsDashboard() {
  let file = getMusicTimeFile();

  const dayOfMonth = moment().startOf("day").date();
  if (fs.existsSync(file) || lastDayOfMonth !== dayOfMonth) {
    lastDayOfMonth = dayOfMonth;
    await fetchDashboardData(file, false);
  }
}

async function fetchDashboardData(fileName: string, isHtml: boolean) {
  const musicSummary = await softwareGet(
    `/dashboard/music?linux=${isLinux()}&html=${isHtml}`,
    getItem("jwt")
  );

  // get the content
  let content = musicSummary && musicSummary.data ? musicSummary.data : NO_DATA;

  fileIt.writeContentFileSync(fileName, content);
}
