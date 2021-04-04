import {
  CodyResponse,
  CodyResponseType,
  getPlaylists,
  getPlaylistTracks,
  getSpotifyLikedSongs,
  launchPlayer,
  PaginationItem,
  play,
  PlayerDevice,
  PlayerName,
  PlayerType,
  PlaylistItem,
  PlaylistTrackInfo,
  playSpotifyPlaylist,
  playSpotifyTrack,
  playTrackInContext,
  Track,
  TrackStatus,
  transferSpotifyDevice,
} from "cody-music";
import { commands, window } from "vscode";
import { SPOTIFY_LIKED_SONGS_PLAYLIST_ID, SPOTIFY_LIKED_SONGS_PLAYLIST_NAME } from "../Constants";
import { populateSpotifyDevices } from "../DataController";
import { MusicCommandUtil } from "../music/MusicCommandUtil";
import { MusicDataManager } from "../music/MusicDataManager";
import { MusicStateManager } from "../music/MusicStateManager";
import { getDeviceId, getDeviceSet } from "../music/MusicUtil";
import { createUriFromPlaylistId, createUriFromTrackId, isMac, isWindows } from "../Util";
import { getSpotifyIntegration, hasSpotifyUser, isPremiumUser, populateSpotifyUser } from "./SpotifyManager";

let spotifyLikedSongs: Track[] = undefined;
let spotifyPlaylists: PlaylistItem[] = undefined;
let playlistTracks: any = {};
let selectedPlaylistId = undefined;
let selectedPlaylistItem = undefined;
let selectedPlayerName = PlayerName.SpotifyWeb;

// CLEAR TRACK LISTS

export async function clearSpotifyLikedSongsCache() {
  spotifyLikedSongs = undefined;
}

export async function clearSpotifyPlaylistsCache() {
  spotifyPlaylists = undefined;
}

// CACHE FETCH

export function getCachedPlaylistTracks() {
  return playlistTracks;
}

export function getCachedLikedSongsTracks() {
  return spotifyLikedSongs;
}

export function getSelectedPlaylistId() {
  return selectedPlaylistId;
}

// PLAYLIST TYPES

export async function getSpotifyPlaylists(): Promise<PlaylistItem[]> {
  if (requiresSpotifyAccess()) {
    return [];
  }

  if (spotifyPlaylists) {
    return spotifyPlaylists;
  }
  spotifyPlaylists = await getPlaylists(PlayerName.SpotifyWeb, { all: true });
  return spotifyPlaylists;
}

export function getSpotifyLikedSongsPlaylist() {
  const item: PlaylistItem = new PlaylistItem();
  item.type = "playlist";
  item.id = SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
  item.tracks = new PlaylistTrackInfo();
  // set set a number so it shows up
  item.tracks.total = 1;
  item.playerType = PlayerType.WebSpotify;
  item.tag = "spotify-liked-songs";
  item.itemType = "playlist";
  item.name = SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
  item["icon"] = "heart-filled.svg";
  return item;
}

// FETCH TRACKS

export async function fetchTracksForLikedSongs() {
  selectedPlaylistId = SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
  if (!spotifyLikedSongs) {
    spotifyLikedSongs = await getSpotifyLikedSongs();
		// add the playlist id to the tracks
		if (spotifyLikedSongs?.length) {
			spotifyLikedSongs = spotifyLikedSongs.map(t => {
				return {...t, playlist_id: SPOTIFY_LIKED_SONGS_PLAYLIST_ID}
			});
		}
  }

  // refresh the webview
  commands.executeCommand("musictime.refreshMusicTimeView");
}

export async function fetchTracksForPlaylist(playlist_id) {
  selectedPlaylistId = playlist_id;
  if (!playlistTracks[playlist_id]) {
    const results: CodyResponse = await getPlaylistTracks(PlayerName.SpotifyWeb, playlist_id);
    let tracks: PlaylistItem[] = getPlaylistItemTracksFromCodyResponse(results);
		// add the playlist id to the tracks
		if (tracks?.length) {
			tracks = tracks.map(t => {
				return {...t, playlist_id}
			});
		}
    playlistTracks[playlist_id] = tracks;
  }
  // refresh the webview
  commands.executeCommand("musictime.refreshMusicTimeView");
}

// PLAY SELECTED TRACK

export async function playSelectedItem(playlistItem: PlaylistItem) {
  selectedPlaylistItem = playlistItem;

  // // ask to launch web or desktop if neither are running
  await playInitialization(playMusicSelection);
}

export async function launchTrackPlayer(playerName: PlayerName = null, callback: any = null) {
  const dataMgr = MusicDataManager.getInstance();
  const { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice, activeDesktopPlayerDevice } = getDeviceSet();

  const hasDesktopDevice = activeDesktopPlayerDevice || desktop ? true : false;

  const requiresDesktopLaunch = !isPremiumUser() && isMac() && !hasDesktopDevice ? true : false;

  if (requiresDesktopLaunch && playerName !== PlayerName.SpotifyDesktop) {
    window.showInformationMessage("Launching Spotify desktop instead of the web player to allow playback as a non-premium account");
  }

  if (requiresDesktopLaunch || playerName === PlayerName.SpotifyDesktop) {
    playerName = PlayerName.SpotifyDesktop;
  } else {
    playerName = PlayerName.SpotifyWeb;
  }

  // {playlist_id | album_id | track_id, quietly }
  const options = {
    quietly: false,
  };

  const hasSelectedTrackItem = dataMgr.selectedTrackItem && dataMgr.selectedTrackItem.id ? true : false;
  const hasSelectedPlaylistItem = dataMgr.selectedPlaylist && dataMgr.selectedPlaylist.id ? true : false;

  if (!isPremiumUser() && (hasSelectedTrackItem || hasSelectedPlaylistItem)) {
    // show the track or playlist
    const isRecommendationTrack = dataMgr.selectedTrackItem.type === "recommendation" ? true : false;
    const isLikedSong = dataMgr.selectedPlaylist && dataMgr.selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME ? true : false;
    if (hasSelectedTrackItem && (isRecommendationTrack || isLikedSong)) {
      options["track_id"] = dataMgr.selectedTrackItem.id;
    } else {
      options["playlist_id"] = dataMgr.selectedPlaylist.id;
    }
  }

  // spotify device launch error would look like ..
  // error:"Command failed: open -a spotify\nUnable to find application named 'spotify'\n"
  const result = await launchPlayer(playerName, options);

  // test if there was an error, fallback to the web player
  if (playerName === PlayerName.SpotifyDesktop && result && result.error && result.error.includes("failed")) {
    // start the process of launching the web player
    playerName = PlayerName.SpotifyWeb;
    await launchPlayer(playerName, options);
  }

  setTimeout(() => {
    checkDeviceLaunch(playerName, 5, callback);
  }, 1500);
}

// PRIVATE FUNCTIONS

function getPlaylistItemTracksFromCodyResponse(codyResponse: CodyResponse): PlaylistItem[] {
  let playlistItems: PlaylistItem[] = [];
  if (codyResponse && codyResponse.state === CodyResponseType.Success) {
    let paginationItem: PaginationItem = codyResponse.data;

    if (paginationItem && paginationItem.items) {
      playlistItems = paginationItem.items.map((track: Track, idx: number) => {
        const position = idx + 1;
        let playlistItem: PlaylistItem = createPlaylistItemFromTrack(track, position);

        return playlistItem;
      });
    }
  }

  return playlistItems;
}

function createPlaylistItemFromTrack(track: Track, position: number) {
  const popularity = track.popularity ? track.popularity : null;
  const artistName = getArtist(track);

  let tooltip = track.name;
  if (artistName) {
    tooltip += ` - ${artistName}`;
  }
  if (popularity) {
    tooltip += ` (Popularity: ${popularity})`;
  }

  let playlistItem: PlaylistItem = new PlaylistItem();
  playlistItem.type = "track";
  playlistItem.name = track.name;
  playlistItem.tooltip = tooltip;
  playlistItem.id = track.id;
  playlistItem.uri = track.uri;
  playlistItem.popularity = track.popularity;
  playlistItem.position = position;
  playlistItem.artist = artistName;
  playlistItem.playerType = track.playerType;
  playlistItem.itemType = "track";
  playlistItem["icon"] = "track.svg";
  playlistItem["albumId"] = track?.album?.id;
  playlistItem["albumName"] = track?.album?.name;

  delete playlistItem.tracks;

  return playlistItem;
}

function getArtist(track: any) {
  if (!track) {
    return null;
  }
  if (track.artist) {
    return track.artist;
  }
  if (track.artists && track.artists.length > 0) {
    const trackArtist = track.artists[0];
    return trackArtist.name;
  }
  return null;
}

function requiresSpotifyAccess() {
  const spotifyIntegration = getSpotifyIntegration();
  // no spotify access token then return true, the user requires spotify access
  return !spotifyIntegration ? true : false;
}

async function playInitialization(callback: any = null) {
  const devices: PlayerDevice[] = MusicDataManager.getInstance().currentDevices;

  const { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice, activeDesktopPlayerDevice } = getDeviceSet();

  if (!hasSpotifyUser()) {
    // try again
    await populateSpotifyUser();
  }

  const hasDesktopLaunched = desktop || activeDesktopPlayerDevice ? true : false;

  const hasDesktopOrWebLaunched = hasDesktopLaunched || webPlayer || activeWebPlayerDevice ? true : false;

  const requiresDesktopLaunch = !isPremiumUser() && isMac() && !hasDesktopLaunched ? true : false;

  if (!hasDesktopOrWebLaunched || requiresDesktopLaunch) {
    return await showPlayerLaunchConfirmation(callback);
  }

  // we have a device, continue to the callback if we have it
  if (callback) {
    callback();
  }
}

async function showPlayerLaunchConfirmation(callback: any = null) {
  // if they're a mac non-premium user, just launch the desktop player

  if (isMac() && !isPremiumUser()) {
    return launchTrackPlayer(PlayerName.SpotifyDesktop, callback);
  } else {
    const buttons = ["Web Player", "Desktop Player"];

    // no devices found at all OR no active devices and a computer device is not found in the list
    const selectedButton = await window.showInformationMessage(
      `Music Time requires a running Spotify player. Choose a player to launch.`,
      ...buttons
    );

    if (selectedButton === "Desktop Player" || selectedButton === "Web Player") {
      selectedPlayerName = selectedButton === "Desktop Player" ? PlayerName.SpotifyDesktop : PlayerName.SpotifyWeb;

      // start the launch process and pass the callback when complete
      return launchTrackPlayer(selectedPlayerName, callback);
    }
  }
  return;
}

async function checkDeviceLaunch(playerName: PlayerName, tries: number = 5, callback: any = null) {
  setTimeout(async () => {
    await populateSpotifyDevices(true /*retry*/);
    const devices = MusicDataManager.getInstance().currentDevices;
    if ((!devices || devices.length == 0) && tries >= 0) {
      if (!isWindows() && tries === 1) {
        // play it to get spotify to update the device ID
        await play(selectedPlayerName);
      }
      tries--;
      checkDeviceLaunch(playerName, tries, callback);
    } else {
      const deviceId = getDeviceId();
      if (!deviceId && !isMac()) {
        window.showInformationMessage("Unable to detect a connected Spotify device. Please make sure you are logged into your account.");
      }

      commands.executeCommand("musictime.refreshDeviceInfo");

      if (callback) {
        callback();
      }
    }
  }, 1500);
}

async function checkPlayingState(deviceId: string, tries = 3) {
  tries--;
  const track: Track = await MusicStateManager.getInstance().fetchPlayingTrack();
  if (!track || track.state !== TrackStatus.Playing) {
    if (tries >= 0) {
      setTimeout(() => {
        checkPlayingState(deviceId, tries);
      }, 2000);
    } else {
      // try to play it
      await transferSpotifyDevice(deviceId, true);
      play(selectedPlayerName);
    }
  }
}

async function playRecommendationsOrLikedSongsByPlaylist(playlistItem: PlaylistItem, deviceId: string) {
  const dataMgr: MusicDataManager = MusicDataManager.getInstance();
  const trackId = playlistItem.id;
  const isRecommendationTrack = playlistItem.type === "recommendation" ? true : false;

  let offset = 0;
  let track_ids = [];
  if (isRecommendationTrack) {
    // RECOMMENDATION track request
    // get the offset of this track
    offset = dataMgr.recommendationTracks.findIndex((t: Track) => trackId === t.id);
    // play the list of recommendation tracks
    track_ids = dataMgr.recommendationTracks.map((t: Track) => t.id);

    // make it a list of 50, so get the rest from trackIdsForRecommendations
    const otherTrackIds = dataMgr.trackIdsForRecommendations.filter((t: string) => !track_ids.includes(t));
    const spliceLimit = 50 - track_ids.length;
    const addtionalTrackIds = otherTrackIds.splice(0, spliceLimit);
    track_ids.push(...addtionalTrackIds);
  } else {
    offset = dataMgr.spotifyLikedSongs.findIndex((t: Track) => trackId === t.id);
    // play the list of recommendation tracks
    track_ids = dataMgr.spotifyLikedSongs.map((t: Track) => t.id);
    // trim it down to 50
    track_ids = track_ids.splice(0, 50);
  }

  const result: any = await MusicCommandUtil.getInstance().runSpotifyCommand(play, [
    PlayerName.SpotifyWeb,
    {
      track_ids,
      device_id: deviceId,
      offset,
    },
  ]);

  return result;
}

async function playMusicSelection() {
  const dataMgr: MusicDataManager = MusicDataManager.getInstance();
  const musicCommandUtil: MusicCommandUtil = MusicCommandUtil.getInstance();
  // get the playlist id, track id, and device id
	console.log("selectedPlaylistItem: ", selectedPlaylistItem);
	console.log("id: ", selectedPlaylistItem.id);
  // const playlistId = dataMgr.selectedPlaylist ? dataMgr.selectedPlaylist.id : null;
  // let trackId = dataMgr.selectedTrackItem ? dataMgr.selectedTrackItem.id : null;

  // const deviceId = getDeviceId();

  // const isLikedSong = dataMgr.selectedPlaylist && dataMgr.selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME ? true : false;
  // const isRecommendationTrack = dataMgr.selectedTrackItem.type === "recommendation" ? true : false;

  // let result = null;
  // if (isRecommendationTrack || isLikedSong) {
  //   if (isMac() && selectedPlayerName === PlayerName.SpotifyDesktop) {
  //     // play it using applescript prevent 502 or 499s
  //     const trackUri = createUriFromTrackId(dataMgr.selectedTrackItem.id);
  //     const params = [trackUri];
  //     try {
  //       result = await playTrackInContext(PlayerName.SpotifyDesktop, params);
  //     } catch (e) {}
  //   }
  //   if (!result || result !== "ok") {
  //     // try with the web player
  //     result = await playRecommendationsOrLikedSongsByPlaylist(dataMgr.selectedTrackItem, deviceId);
  //   }
  // } else if (playlistId) {
  //   if (isMac() && selectedPlayerName === PlayerName.SpotifyDesktop) {
  //     // play it using applescript
  //     const trackUri = createUriFromTrackId(trackId);
  //     const playlistUri = createUriFromPlaylistId(playlistId);
  //     const params = [trackUri, playlistUri];
  //     try {
  //       result = await playTrackInContext(PlayerName.SpotifyDesktop, params);
  //     } catch (e) {}
  //   }
  //   if (!result || result !== "ok") {
  //     // try with the web player
  //     result = await musicCommandUtil.runSpotifyCommand(playSpotifyPlaylist, [playlistId, trackId, deviceId]);
  //   }
  // } else {
  //   if (isMac() && selectedPlayerName === PlayerName.SpotifyDesktop) {
  //     // play it using applescript
  //     const trackUri = createUriFromTrackId(trackId);
  //     const params = [trackUri];
  //     try {
  //       result = await playTrackInContext(PlayerName.SpotifyDesktop, params);
  //     } catch (e) {}
  //   }
  //   if (!result || result !== "ok") {
  //     // else it's not a liked or recommendation play request, just play the selected track
  //     result = await musicCommandUtil.runSpotifyCommand(playSpotifyTrack, [trackId, deviceId]);
  //   }
  // }

  // setTimeout(() => {
  //   checkPlayingState(deviceId);
  // }, 1000);
}
