import {
  launchPlayer,
  play,
  PlayerContext,
  PlayerName,
  PlaylistItem,
  playSpotifyPlaylist,
  playTrackInContext,
  TrackStatus,
  transferSpotifyDevice,
} from "cody-music";
import { commands, window } from "vscode";
import { RECOMMENDATION_PLAYLIST_ID, SPOTIFY_LIKED_SONGS_PLAYLIST_ID } from "../Constants";
import { MusicCommandUtil } from "../music/MusicCommandUtil";
import { MusicControlManager } from '../music/MusicControlManager';
import { createSpotifyIdFromUri, createUriFromPlaylistId, createUriFromTrackId, isMac } from "../Util";
import {
  getBestActiveDevice,
  getCachedLikedSongsTracks,
  getDeviceSet,
  getPlaylistById,
  getSelectedPlayerName,
  getSelectedPlaylistId,
  getSelectedTrackItem,
  populateSpotifyDevices,
  updateSelectedPlayer,
  updateSelectedTrackItem,
  getCurrentDevices,
  getLikedURIsFromTrackId,
  getRecommendationURIsFromTrackId,
  getSelectedTrackItems,
  updateSelectedTrackItems,
  getPlayerContext,
} from "./PlaylistDataManager";
import { hasSpotifyUser, isPremiumUser, populateSpotifyUser } from "./SpotifyManager";

// Play selected tracks
export async function playSelectedItems(playlistItems: PlaylistItem[]) {
  updateSelectedTrackItems(playlistItems);
  // ask to launch web or desktop if neither are running
  await playInitialization(playSelectedTrackItems);
}

// PLAY SELECTED TRACK
export async function playSelectedItem(playlistItem: PlaylistItem) {
  updateSelectedTrackItem(playlistItem, TrackStatus.Playing);

  // ask to launch web or desktop if neither are running
  await playInitialization(playMusicSelection);
}

export async function launchTrackPlayer(playerName: PlayerName = null, callback: any = null) {
  const { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice, activeDesktopPlayerDevice } = getDeviceSet();

  const hasDesktopDevice = activeDesktopPlayerDevice || desktop ? true : false;

  const requiresDesktopLaunch = !isPremiumUser() && isMac() && !hasDesktopDevice ? true : false;

  if (requiresDesktopLaunch && playerName !== PlayerName.SpotifyDesktop) {
    window.showInformationMessage("Launching Spotify desktop instead of the web player to allow playback as a non-premium account");
  }

  if (requiresDesktopLaunch || playerName === PlayerName.SpotifyDesktop) {
    updateSelectedPlayer(PlayerName.SpotifyDesktop);
  } else {
    updateSelectedPlayer(PlayerName.SpotifyWeb);
  }

  // {playlist_id | album_id | track_id, quietly }
  const options = {
    quietly: false,
  };

  const selectedTrack = getSelectedTrackItem();

  if (selectedTrack) {
    const selectedPlaylist = getPlaylistById(selectedTrack["playlist_id"]);

    if (selectedPlaylist) {
      options["playlist_id"] = selectedTrack["playlist_id"];
    } else if (selectedTrack) {
      options["track_id"] = selectedTrack.id;
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

  setTimeout(async () => {
    await play(getSelectedPlayerName());
    checkDeviceLaunch(playerName, 5, callback);
  }, 3000);
}

// PRIVATE FUNCTIONS

export async function playInitialization(callback: any = null) {
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

export async function showPlayerLaunchConfirmation(callback: any = null) {
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

    const devices = getCurrentDevices();

    if ((!devices || devices.length == 0) && tries >= 0) {
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
  }, 1100);
}

async function checkPlayingState(deviceId: string, tries = 3) {
  tries--;
  const playerContext: PlayerContext = await getPlayerContext();
  if (!playerContext || !playerContext.item || playerContext.item !== TrackStatus.Playing) {
    if (tries >= 0) {
      setTimeout(() => {
        checkPlayingState(deviceId, tries);
      }, 2000);
      return;
    } else {
      // try to play it
      await transferSpotifyDevice(deviceId, true);
      play(getSelectedPlayerName());
    }
  }

  // get the selected track and execute post play commands like 'repeat'
  setTimeout(() => {
    const trackItem:PlaylistItem = getSelectedTrackItem();
    if (!!trackItem['repeat']) {
      MusicControlManager.getInstance().setRepeatTrackOn();
    }
    commands.executeCommand("musictime.refreshMusicTimeView");
  }, 1000);
}

async function playSelectedTrackItems() {
  const selectedTrackItems = getSelectedTrackItems();
  const device = getBestActiveDevice();
  const uris: any[] = selectedTrackItems.map((item: PlaylistItem) => {
    let track_id = item.id ? item.id : item["song_id"];
    if (track_id && !track_id.includes("spotify:track:")) {
      track_id = `spotify:track:${track_id}`;
    }

    return track_id;
  });
  play(PlayerName.SpotifyWeb, { device_id: device?.id, uris, offset: 0 });
  setTimeout(() => {
    checkPlayingState(device.id);
  }, 1000);
}

async function playMusicSelection() {
  const selectedPlaylistItem = getSelectedTrackItem();
  if (!selectedPlaylistItem) {
    return;
  }
  const musicCommandUtil: MusicCommandUtil = MusicCommandUtil.getInstance();
  // get the playlist id, track id, and device id

  const device = getBestActiveDevice();

  const playlist_id = getSelectedPlaylistId();
  const selectedPlayer = getSelectedPlayerName() || PlayerName.SpotifyWeb;
  const isLikedSong = !!(playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_ID);
  const desktopSelected = !!(selectedPlayer === PlayerName.SpotifyDesktop);
  const isRecommendationTrack = !!(
    selectedPlaylistItem.type === "recommendation" ||
    selectedPlaylistItem["playlist_id"] === RECOMMENDATION_PLAYLIST_ID
  );
  const isRankedTrack = !!(selectedPlaylistItem["rank"])

  const songId = selectedPlaylistItem.id ? selectedPlaylistItem.id : selectedPlaylistItem["song_id"];
  const trackId = createSpotifyIdFromUri(songId);
  const trackUri = createUriFromTrackId(songId);
  let result = undefined;

  if (isRecommendationTrack || isLikedSong || isRankedTrack) {
    try {
      if (isRankedTrack) {
        play(PlayerName.SpotifyWeb, { device_id: device?.id, uris: [trackUri], offset: 0 });
      } else if (isRecommendationTrack) {
        const recommendationTrackUris = getRecommendationURIsFromTrackId(trackId);
        play(PlayerName.SpotifyWeb, { device_id: device?.id, uris: recommendationTrackUris, offset: 0 });
      } else {
        const likedTrackUris = getLikedURIsFromTrackId(trackId);
        play(PlayerName.SpotifyWeb, { device_id: device?.id, uris: likedTrackUris, offset: 0 });
      }
    } catch (e) {}
  } else {
    if (isMac() && desktopSelected) {
      // play it using applescript
      const playlistUri = createUriFromPlaylistId(playlist_id);
      const params = [trackUri, playlistUri];
      try {
        result = await playTrackInContext(selectedPlayer, params);
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

export async function playNextLikedSong() {
  const likedSongs: PlaylistItem[] = await getCachedLikedSongsTracks();
  const nextIdx = await getNextOrPrevLikedIndex(true);

  let nextLikedTrack = likedSongs[nextIdx];

  const selectedPlayer = getSelectedPlayerName() || PlayerName.SpotifyWeb;
  playTrackInContext(selectedPlayer, [createUriFromTrackId(nextLikedTrack.id)]);
}

export async function playPreviousLikedSongs() {
  const likedSongs: PlaylistItem[] = await getCachedLikedSongsTracks();
  const prevIdx = await getNextOrPrevLikedIndex(false);

  let nextLikedTrack = likedSongs[prevIdx];

  const selectedPlayer = getSelectedPlayerName() || PlayerName.SpotifyWeb;
  playTrackInContext(selectedPlayer, [createUriFromTrackId(nextLikedTrack.id)]);
}

async function getNextOrPrevLikedIndex(get_next: boolean) {
  const likedSongs: PlaylistItem[] = await getCachedLikedSongsTracks();
  const selectedTrack = getSelectedTrackItem();
  const nextIdx = likedSongs?.findIndex((n: PlaylistItem) => n.id === selectedTrack.id);
  if (get_next) {
    // get next
    if (nextIdx + 1 >= likedSongs.length) {
      return 0;
    }
    return nextIdx + 1;
  }
  // get prev
  if (nextIdx - 1 < 0) {
    return likedSongs.length - 1;
  } else {
    return nextIdx - 1;
  }
}
