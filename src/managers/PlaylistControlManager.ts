import {
  launchPlayer,
  play,
  PlayerName,
  PlaylistItem,
  playSpotifyPlaylist,
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
import { getBestActiveDevice, getDeviceSet } from "../music/MusicUtil";
import { createSpotifyIdFromUri, createUriFromPlaylistId, createUriFromTrackId, isMac, isWindows } from "../Util";
import {
  getSelectedPlayerName,
  getSelectedPlaylistId,
  getSelectedPlaylistItem,
  updateSelectedPlayer,
  updateSelectedPlaylistItem,
} from "./PlaylistDataManager";
import { hasSpotifyUser, isPremiumUser, populateSpotifyUser } from "./SpotifyManager";

// PLAY SELECTED TRACK

export async function playSelectedItem(playlistItem: PlaylistItem) {
  updateSelectedPlaylistItem(playlistItem);

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

async function playInitialization(callback: any = null) {
  const { desktop } = getDeviceSet();
  const device = getBestActiveDevice();

  if (!hasSpotifyUser()) {
    // try again
    await populateSpotifyUser();
  }

  const requiresDesktopLaunch = !isPremiumUser() && isMac() && !desktop ? true : false;

  if (!device || requiresDesktopLaunch) {
    return await showPlayerLaunchConfirmation(callback);
  } else {
    // check to see if we need to change the selected player type
    if (device.type === "Computer" && getSelectedPlayerName() !== PlayerName.SpotifyDesktop) {
      updateSelectedPlayer(PlayerName.SpotifyDesktop);
    }
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
      updateSelectedPlayer(selectedButton === "Desktop Player" ? PlayerName.SpotifyDesktop : PlayerName.SpotifyWeb);

      // start the launch process and pass the callback when complete
      return launchTrackPlayer(getSelectedPlayerName(), callback);
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
        await play(getSelectedPlayerName());
      }
      tries--;
      checkDeviceLaunch(playerName, tries, callback);
    } else {
      const device = getBestActiveDevice();
      if (!device && !isMac()) {
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
      play(getSelectedPlayerName());
    }
  }
}

// async function playRecommendationsOrLikedSongsByPlaylist(playlistItem: PlaylistItem, deviceId: string) {
//   const dataMgr: MusicDataManager = MusicDataManager.getInstance();
//   const trackId = playlistItem.id;
//   const isRecommendationTrack = playlistItem.type === "recommendation" ? true : false;

//   let offset = 0;
//   let track_ids = [];
//   if (isRecommendationTrack) {
//     // RECOMMENDATION track request
//     // get the offset of this track
//     offset = dataMgr.recommendationTracks.findIndex((t: Track) => trackId === t.id);
//     // play the list of recommendation tracks
//     track_ids = dataMgr.recommendationTracks.map((t: Track) => t.id);

//     // make it a list of 50, so get the rest from trackIdsForRecommendations
//     const otherTrackIds = dataMgr.trackIdsForRecommendations.filter((t: string) => !track_ids.includes(t));
//     const spliceLimit = 50 - track_ids.length;
//     const addtionalTrackIds = otherTrackIds.splice(0, spliceLimit);
//     track_ids.push(...addtionalTrackIds);
//   } else {
//     offset = dataMgr.spotifyLikedSongs.findIndex((t: Track) => trackId === t.id);
//     // play the list of recommendation tracks
//     track_ids = dataMgr.spotifyLikedSongs.map((t: Track) => t.id);
//     // trim it down to 50
//     track_ids = track_ids.splice(0, 50);
//   }

//   const result: any = await MusicCommandUtil.getInstance().runSpotifyCommand(play, [
//     PlayerName.SpotifyWeb,
//     {
//       track_ids,
//       device_id: deviceId,
//       offset,
//     },
//   ]);

//   return result;
// }

async function playMusicSelection() {
  const selectedPlaylistItem = getSelectedPlaylistItem();
  if (!selectedPlaylistItem) {
    return;
  }
  const dataMgr: MusicDataManager = MusicDataManager.getInstance();
  const musicCommandUtil: MusicCommandUtil = MusicCommandUtil.getInstance();
  // get the playlist id, track id, and device id

  const device = getBestActiveDevice();

  const playlist_id = getSelectedPlaylistId();
  const isLikedSong = !!(playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_ID);
  const desktopSelected = !!(getSelectedPlayerName() === PlayerName.SpotifyDesktop);
  const isRecommendationTrack = !!(selectedPlaylistItem.type === "recommendation");

  const trackId = createSpotifyIdFromUri(selectedPlaylistItem.id);
  const trackUri = createUriFromTrackId(selectedPlaylistItem.id);
  let result = undefined;
  if (isRecommendationTrack || isLikedSong) {
    try {
      result = await playTrackInContext(PlayerName.SpotifyDesktop, [trackUri]);
    } catch (e) {}
  } else {
    if (isMac() && desktopSelected) {
      // play it using applescript
      const playlistUri = createUriFromPlaylistId(playlist_id);
      const params = [trackUri, playlistUri];
      try {
        result = await playTrackInContext(PlayerName.SpotifyDesktop, params);
      } catch (e) {}
    }
    if (!result || result !== "ok") {
      // try with the web player
      result = await musicCommandUtil.runSpotifyCommand(playSpotifyPlaylist, [playlist_id, trackId, device?.id]);
    }
  }

  setTimeout(() => {
    checkPlayingState(device.id);
  }, 1000);
}