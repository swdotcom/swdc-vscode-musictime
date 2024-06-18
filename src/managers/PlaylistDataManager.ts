import {
  CodyResponse,
  CodyResponseType,
  followPlaylist,
  getPlaylists,
  getPlaylistTracks,
  getRecommendationsForTracks,
  getRunningTrack,
  getSpotifyAlbumTracks,
  getSpotifyAudioFeatures,
  getSpotifyDevices,
  getSpotifyLikedSongs,
  getSpotifyPlayerContext,
  getSpotifyPlaylist,
  PaginationItem,
  PlayerContext,
  PlayerDevice,
  PlayerName,
  PlayerType,
  PlaylistItem,
  PlaylistTrackInfo,
  removeTracksFromPlaylist,
  Track,
  TrackStatus,
} from "cody-music";
import { commands, window } from "vscode";
import { RECOMMENDATION_LIMIT, RECOMMENDATION_PLAYLIST_ID, SOFTWARE_TOP_40_PLAYLIST_ID, OK_LABEL, SPOTIFY_LIKED_SONGS_PLAYLIST_ID, SPOTIFY_LIKED_SONGS_PLAYLIST_NAME, YES_LABEL } from "../Constants";
import { app_endpoint } from '../Constants';
import AudioFeatures from '../model/AudioFeatures';
import { MusicCommandManager } from "../music/MusicCommandManager";
import { MusicCommandUtil } from "../music/MusicCommandUtil";
import { MusicControlManager } from "../music/MusicControlManager";
import { getCodyErrorMessage, launchWebUrl, getItem, logIt } from "../Util";
import { getSpotifyIntegration, populateSpotifyUser, updateCodyConfig, updateSpotifyClientInfo } from "./SpotifyManager";
import { isMac } from "./DeviceManager";

let currentDevices: PlayerDevice[] = [];
let spotifyLikedTracks: PlaylistItem[] = undefined;
let spotifyPlaylists: PlaylistItem[] = undefined;
let softwareTop40Playlist: PlaylistItem = undefined;
let recommendedTracks: PlaylistItem[] = undefined;
const playlistTracks: any = {};
let selectedPlaylistId = undefined;
let expandedPlaylistId: string = '';
let selectedTrackItem: PlaylistItem = undefined;
let selectedTrackItems: PlaylistItem[] = undefined;
let cachedRunningTrack: Track = undefined;
let spotifyContext: PlayerContext = undefined;
let selectedPlayerName = PlayerName.SpotifyWeb;
// playlists, recommendations, metrics
let selectedTabView: string = "playlists";
let metricsTypeSelected: string = "you";
let recommendationMetadata: any = undefined;
let recommendationInfo: any = undefined;
let sortAlphabetically: boolean = false;
let audioFeatures: AudioFeatures = undefined;

////////////////////////////////////////////////////////////////
// UPDATE EXPORTS
////////////////////////////////////////////////////////////////

export function updateSpotifyLikedTracks(songs) {
  spotifyLikedTracks = songs;
}

export function removeTrackFromLikedPlaylist(trackId) {
  spotifyLikedTracks = spotifyLikedTracks.filter((n) => n.id !== trackId);
}

export function addTrackToLikedPlaylist(playlistItem: PlaylistItem) {
  playlistItem["liked"] = true;
  playlistItem["playlist_id"] = SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
  spotifyLikedTracks.unshift(playlistItem);
}

export function clearSelectedTrackInfo() {
  selectedPlaylistId = undefined;
  selectedTrackItem = undefined;
}

export function updateSelectedTrackStatus(status: TrackStatus) {
  if (selectedTrackItem) {
    selectedTrackItem.state = status;
  }
}

export function updateSelectedTrackItem(item, status: TrackStatus) {
  selectedTrackItem = item;
  selectedTrackItem.state = status;
  selectedPlaylistId = item["playlist_id"];
}

export function updateSelectedTrackItems(items: PlaylistItem[]) {
  selectedTrackItems = items;
}

export function updateSelectedPlaylistId(playlist_id) {
  selectedPlaylistId = playlist_id;
}

export function updateExpandedPlaylistId(playlist_id: string) {
  expandedPlaylistId = playlist_id;
}

export function updateSelectedPlayer(player: PlayerName) {
  selectedPlayerName = player;
}

export function updateSelectedTabView(tabView: string) {
  selectedTabView = tabView;
}

export function updateSelectedMetricSelection(type: string) {
  metricsTypeSelected = type;
}

export function updateSort(alphabetically: boolean) {
  sortAlphabetically = alphabetically;
  sortPlaylists(spotifyPlaylists, alphabetically);
  commands.executeCommand("musictime.refreshMusicTimeView");
}

export async function getCachedAudioMetrics() {
  if (!audioFeatures || Object.keys(audioFeatures).length === 0) {
    audioFeatures = new AudioFeatures(await getAudioFeatures())
  }
  return audioFeatures.getMetrics();
}

export async function getCachedFeaturesForRecomendations() {
  await getCachedAudioMetrics();
  return audioFeatures.getFeaturesForRecommendations();
}

export function updateCachedRunningTrack(track: Track) {
  cachedRunningTrack = track;
}

export function updateLikedStatusInPlaylist(playlist_id, track_id, liked_state) {
  let item: PlaylistItem = playlistTracks[playlist_id]?.length ? playlistTracks[playlist_id].find((n) => n.id === track_id) : null;
  if (item) {
    item["liked"] = liked_state;
  }

  if (recommendationInfo?.tracks) {
    // it might be in the recommendations list
    item = recommendationInfo.tracks?.find((n) => n.id === track_id);
    if (item) {
      item["liked"] = liked_state;
    }
  }
}

////////////////////////////////////////////////////////////////
// CACHE GETTERS
////////////////////////////////////////////////////////////////

export async function getCachedSpotifyPlaylists() {
  if (!spotifyPlaylists || spotifyPlaylists.length === 0) {
    spotifyPlaylists = await getSpotifyPlaylists();
  }
  return spotifyPlaylists;
}

export function getCachedPlaylistTracks() {
  return playlistTracks ?? {};
}

export function sortingAlphabetically() {
  return sortAlphabetically;
}

export async function getCachedLikedSongsTracks() {
  if (!spotifyLikedTracks || spotifyLikedTracks.length === 0) {
    await populateLikedSongs()
  }
  return spotifyLikedTracks;
}

export async function getCachedSoftwareTop40Playlist() {
  if (!softwareTop40Playlist) {
    softwareTop40Playlist = await getSoftwareTop40Playlist();
  }
  return softwareTop40Playlist;
}

export function getCachedRecommendationInfo() {
  return recommendationInfo;
}

export function getCachedRecommendationMetadata() {
  return recommendationMetadata;
}

export async function getPlayerContext() {
  return await getSpotifyPlayerContext();
}

export function getCachedRunningTrack() {
  return cachedRunningTrack;
}

export function getSelectedPlaylistId() {
  return selectedPlaylistId;
}

export function getExpandedPlaylistId() {
  return expandedPlaylistId;
}

export function getSelectedPlayerName() {
  return selectedPlayerName;
}

export function getSelectedTrackItem() {
  return selectedTrackItem;
}

export function getSelectedTrackItems() {
  return selectedTrackItems;
}

export function getSelectedTabView() {
  return selectedTabView;
}

export function getUserMetricsSelected() {
  return metricsTypeSelected;
}

// only playlists (not liked or recommendations)
export function getPlaylistById(playlist_id) {
  if (SOFTWARE_TOP_40_PLAYLIST_ID === playlist_id) {
    return softwareTop40Playlist;
  }
  return spotifyPlaylists?.find((n) => n.id === playlist_id);
}

export async function getTrackByPlaylistIdAndTrackId(playlist_id, track_id) {
  if (!track_id) {
    // get the current spotify context
    const playerContext = await getPlayerContext();
    if (playerContext?.item) {
      track_id = playerContext.item.id;
    }
  }
  let tracks: PlaylistItem[] = [];
  if (!playlist_id) {
    tracks.push(...await getCachedLikedSongsTracks())
    tracks.push(...Object.keys(playlistTracks).map((key) => {
      return playlistTracks[key]
    }))
  } else if (playlist_id === RECOMMENDATION_PLAYLIST_ID) {
    tracks = recommendedTracks;
  } else if (playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
    tracks = await getCachedLikedSongsTracks();
  } else {
    tracks = playlistTracks[playlist_id];
  }
  if (tracks?.length) {
    const trackItem: PlaylistItem = tracks.find(n => { return n.id === track_id; });
    if (trackItem) {
      return trackItem;
    }
  }
  const currentTrack: Track = await getRunningTrack();
  if (currentTrack) {
    return createPlaylistItemFromTrack(currentTrack)
  }
  return null;
}

export function isLikedSongPlaylistSelected() {
  return !!(selectedPlaylistId === SPOTIFY_LIKED_SONGS_PLAYLIST_ID);
}

export function getLikedURIsFromTrackId(trackId) {
  return getTracksFromTrackId(trackId, spotifyLikedTracks);
}

export function getRecommendationURIsFromTrackId(trackId) {
  return getTracksFromTrackId(trackId, recommendationInfo?.tracks);
}

function createUriFromTrackId(track_id: string) {
  if (track_id && !track_id.includes("spotify:track:")) {
    track_id = `spotify:track:${track_id}`;
  }

  return track_id;
}

function getTracksFromTrackId(trackId, existingTracks) {
  const uris = [];
  let foundTrack = false;
  if (existingTracks?.length) {
    for (const track of existingTracks) {
      if (!foundTrack && track.id === trackId) {
        foundTrack = true;
      }

      if (foundTrack) {
        uris.push(createUriFromTrackId(track.id));
      }
    }
  }

  if (existingTracks?.length && uris.length < 10) {
    const limit = 10;
    // add the ones to the beginning until we've reached 10 or the found track
    let idx = 0;
    for (const track of existingTracks) {
      if (idx >= 10 || (!foundTrack && track.id === trackId)) {
        break;
      }
      uris.push(createUriFromTrackId(track.id));
      idx++;
    }
  }
  return uris;
}

////////////////////////////////////////////////////////////////
// PLAYLIST AND TRACK EXPORTS
////////////////////////////////////////////////////////////////

// PLAYLISTS
export async function getSpotifyPlaylists(clear = false): Promise<PlaylistItem[]> {
  if (await requiresSpotifyAccess()) {
    return [];
  }

  if (!clear && spotifyPlaylists?.length) {
    return spotifyPlaylists;
  }
  try {
    spotifyPlaylists = await getPlaylists(PlayerName.SpotifyWeb, { all: true });
  } catch (e) {
    logIt(`Error fetching playlists. ${e.message}`)
  }
  spotifyPlaylists = spotifyPlaylists?.map((n, index) => {
    return { ...n, index };
  });
  return spotifyPlaylists;
}

// LIKED SONGS
export function getSpotifyLikedPlaylist(): PlaylistItem {
  const item: PlaylistItem = new PlaylistItem();
  item.type = "playlist";
  item.id = SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
  item.tracks = new PlaylistTrackInfo();
  // set a number so it shows up
  item.tracks.total = 1;
  item.playerType = PlayerType.WebSpotify;
  item.tag = "spotify-liked-songs";
  item.itemType = "playlist";
  item.name = SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
  return item;
}

// SOFTWARE TOP 40
export async function getSoftwareTop40Playlist() {
  softwareTop40Playlist = await getSpotifyPlaylist(SOFTWARE_TOP_40_PLAYLIST_ID);
  if (softwareTop40Playlist && softwareTop40Playlist.tracks && softwareTop40Playlist.tracks["items"]) {
    softwareTop40Playlist.tracks["items"] = softwareTop40Playlist.tracks["items"].map((n) => {
      const albumName = getAlbumName(n.track);
      const description = getArtistAlbumDescription(n.track);
      n.track = { ...n.track, albumName, description, playlist_id: SOFTWARE_TOP_40_PLAYLIST_ID };
      return { ...n };
    });
  }
  return softwareTop40Playlist;
}

// LIKED PLAYLIST TRACKS
export async function fetchTracksForLikedSongs() {
  selectedPlaylistId = SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
  if (!spotifyLikedTracks) {
    await populateLikedSongs();
  }

  // refresh the webview
  commands.executeCommand("musictime.refreshMusicTimeView");
}

// TRACKS FOR A SPECIFIED PLAYLIST
export async function fetchTracksForPlaylist(playlist_id) {
  updateSelectedPlaylistId(playlist_id);

  if (!playlistTracks[playlist_id] && playlist_id !== SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
    const results: CodyResponse = await getPlaylistTracks(PlayerName.SpotifyWeb, playlist_id);
    const tracks: PlaylistItem[] = await getPlaylistItemTracksFromCodyResponse(results);
    // add the playlist id to the tracks
    if (tracks?.length) {
      for await (const t of tracks) {
        const albumName = getAlbumName(t);
        const description = getArtistAlbumDescription(t);
        t["playlist_id"] = playlist_id;
        t["albumName"] = albumName;
        t["description"] = description;
        t["liked"] = await isLikedSong(t);
      }
    }
    playlistTracks[playlist_id] = tracks;
  } else if (playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
    await getCachedLikedSongsTracks();
  }
}

////////////////////////////////////////////////////////////////
// METRICS EXPORTS
////////////////////////////////////////////////////////////////

export async function getAudioFeatures() {
  const ids: string[] = (await getCachedLikedSongsTracks()).map((n) => {
    return n.id
  });
  return await getSpotifyAudioFeatures(ids.slice(0, 100));
}

export async function populateLikedSongs() {
  const tracks: Track[] = (await getSpotifyLikedSongs()) ?? [];
  // add the playlist id to the tracks
  if (tracks?.length) {
    spotifyLikedTracks = tracks.map((t, idx) => {
      const playlistItem: PlaylistItem = createPlaylistItemFromTrack(t, idx);
      playlistItem["playlist_id"] = SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
      playlistItem["liked"] = true;
      return playlistItem;
    });
  }
}

////////////////////////////////////////////////////////////////
// RECOMMENDATION TRACKS EXPORTS
////////////////////////////////////////////////////////////////

export function getCurrentRecommendations() {
  if (recommendationMetadata) {
    getRecommendations(
      recommendationMetadata.length,
      recommendationMetadata.seedLimit,
      recommendationMetadata.seed_genres,
      recommendationMetadata.features,
      0
    );
  } else {
    getFamiliarRecs();
  }
}

export function getFamiliarRecs() {
  return getRecommendations("Familiar", 5);
}

export function getHappyRecs() {
  return getRecommendations("Happy", 5, [], { min_valence: 0.7, target_valence: 1 });
}

export function getEnergeticRecs() {
  return getRecommendations("Energetic", 5, [], { min_energy: 0.7, target_energy: 1 });
}

export function getDanceableRecs() {
  return getRecommendations("Danceable", 5, [], { min_danceability: 0.5, target_danceability: 1 });
}

export function getInstrumentalRecs() {
  return getRecommendations("Instrumental", 5, [], { min_instrumentalness: 0.6, target_instrumentalness: 1 });
}

export function getQuietMusicRecs() {
  return getRecommendations("Quiet music", 5, [], { min_loudness: -40, target_loudness: 0});
}

export function getMixedAudioFeatureRecs(features) {
  if (!features) {
    // fetch familiar
    getFamiliarRecs();
    return;
  }
  return getRecommendations("Audio mix", 5, [], features);
}

export function getTrackRecommendations(playlistItem: PlaylistItem) {
  return getRecommendations(playlistItem.name, 5, [], {}, 0, [playlistItem]);
}

export async function getAlbumForTrack(playlistItem: PlaylistItem) {
  let albumId = playlistItem["albumId"];
  const albumName = playlistItem["album"] ? playlistItem["album"]["name"] : "";
  if (!albumId && playlistItem["album"]) {
    albumId = playlistItem["album"]["id"];
  }

  if (albumId) {
    const albumTracks: Track[] = await getSpotifyAlbumTracks(albumId);
    const items: PlaylistItem[] = [];

    if (albumTracks?.length) {
      let idx = 1;
      for await (const t of albumTracks) {
        const playlistItem: PlaylistItem = createPlaylistItemFromTrack(t, idx);
        if (!t["albumName"]) {
          t["albumName"] = albumName;
        }
        playlistItem["liked"] = await isLikedSong(t);
        idx++;
        items.push(playlistItem);
      }
    }
    populateRecommendationTracks(playlistItem["albumName"], items);
  }
}

export function refreshRecommendations() {
  if (!recommendationInfo) {
    return getFamiliarRecs();
  } else {
    let offset = (recommendationMetadata.offset += 5);
    if (offset.length - 5 < offset) {
      // start back at the beginning
      offset = 0;
    }
    getRecommendations(
      recommendationMetadata.label,
      recommendationMetadata.seedLimit,
      recommendationMetadata.seed_genres,
      recommendationMetadata.features,
      offset
    );
  }
}

export async function getRecommendations(
  label: string = "Familiar",
  seedLimit: number = 5,
  seed_genres: string[] = [],
  features: any = {},
  offset: number = 0,
  seedTracks = []
) {

  // fetching recommendations based on a set of genre requires 0 seed track IDs
  seedLimit = seed_genres.length ? 0 : Math.max(seedLimit, 5);

  recommendationMetadata = {
    label,
    seedLimit,
    seed_genres,
    features,
    offset,
  };

  recommendedTracks = await getTrackIdsForRecommendations(seedLimit, seedTracks, offset).then(async (trackIds) => {
    const tracks: Track[] = await getRecommendationsForTracks(
      trackIds,
      RECOMMENDATION_LIMIT,
      "" /*market*/,
      20,
      100,
      seed_genres,
      [] /*artists*/,
      features
    );

    const items: PlaylistItem[] = [];
    if (tracks?.length) {
      let idx = 1;
      for await (const t of tracks) {
        const playlistItem: PlaylistItem = createPlaylistItemFromTrack(t, idx);
        playlistItem["playlist_id"] = RECOMMENDATION_PLAYLIST_ID;
        playlistItem["liked"] = await isLikedSong(t);
        items.push(playlistItem);
        idx++;
      }
    }

    return items;
  });

  populateRecommendationTracks(label, recommendedTracks);
}

export function populateRecommendationTracks(label: string, tracks: PlaylistItem[]) {
  if (tracks?.length) {
    tracks = tracks.map((t) => {
      t["playlist_id"] = RECOMMENDATION_PLAYLIST_ID;
      const albumName = getAlbumName(t);
      const description = getArtistAlbumDescription(t);
      return { ...t, albumName, description };
    });
  }

  selectedPlaylistId = RECOMMENDATION_PLAYLIST_ID;

  recommendationInfo = {
    label,
    tracks,
  };

  // refresh the webview
  commands.executeCommand(
    "musictime.refreshMusicTimeView",
    { tabView: "recommendations", playlistId: RECOMMENDATION_PLAYLIST_ID }
  );
}

export function removeTracksFromRecommendations(trackId) {
  let foundIdx = -1;
  for (let i = 0; i < recommendationInfo.tracks.length; i++) {
    if (recommendationInfo.tracks[i].id === trackId) {
      foundIdx = i;
      break;
    }
  }
  if (foundIdx > -1) {
    // splice it out
    recommendationInfo.tracks.splice(foundIdx, 1);
  }

  if (recommendationInfo.tracks.length < 2) {
    // refresh
    commands.executeCommand("musictime.refreshMusicTimeView");
  }
}

////////////////////////////////////////////////////////////////
// DEVICE EXPORTS
////////////////////////////////////////////////////////////////

// POPULATE
export async function populateSpotifyDevices(tryAgain = false) {
  const devices = await MusicCommandUtil.getInstance().runSpotifyCommand(getSpotifyDevices);

  if (devices.status && devices.status === 429 && tryAgain) {
    // try one more time in lazily since its not a device launch request.
    // the device launch requests retries a few times every couple seconds.
    setTimeout(() => {
      // use true to specify its a device launch so this doens't try continuously
      populateSpotifyDevices(false);
    }, 5000);
    return;
  }

  const fetchedDeviceIds = [];
  if (devices.length) {
    devices.forEach((el: PlayerDevice) => {
      fetchedDeviceIds.push(el.id);
    });
  }

  let diffDevices = [];
  if (currentDevices.length) {
    // get any differences from the fetched devices if any
    diffDevices = currentDevices.filter((n: PlayerDevice) => !fetchedDeviceIds.includes(n.id));
  } else if (fetchedDeviceIds.length) {
    // no current devices, set diff to whatever we fetched
    diffDevices = [...devices];
  }

  if (diffDevices.length || currentDevices.length !== diffDevices.length) {
    // new devices available or setting to empty
    currentDevices = devices;
  }
}

export function getCurrentDevices() {
  return currentDevices;
}

export function requiresSpotifyReAuthentication() {
  const requiresSpotifyReAuth = getItem("requiresSpotifyReAuth");
  return requiresSpotifyReAuth ? true : false;
}

export async function showReconnectPrompt(email) {
  const reconnectButtonLabel = "Reconnect";
  const msg = `To continue using Music Time, please reconnect your Spotify account (${email}).`;
  const selection = await window.showInformationMessage(msg, ...[reconnectButtonLabel]);

  if (selection === reconnectButtonLabel) {
    // now launch re-auth
    launchWebUrl(`${app_endpoint}/data_sources/integration_types/spotify`);
  }
}

/**
 * returns { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice }
 * Either of these values can be null
 */
export function getDeviceSet() {
  const webPlayer = currentDevices?.find((d: PlayerDevice) => d.name.toLowerCase().includes("web player"));

  const desktop = currentDevices?.find((d: PlayerDevice) => d.type.toLowerCase() === "computer" && !d.name.toLowerCase().includes("web player"));

  const activeDevice = currentDevices?.find((d: PlayerDevice) => d.is_active);

  const activeComputerDevice = currentDevices?.find((d: PlayerDevice) => d.is_active && d.type.toLowerCase() === "computer");

  const activeWebPlayerDevice = currentDevices?.find(
    (d: PlayerDevice) => d.is_active && d.type.toLowerCase() === "computer" && d.name.toLowerCase().includes("web player")
  );

  const activeDesktopPlayerDevice = currentDevices?.find(
    (d: PlayerDevice) => d.is_active && d.type.toLowerCase() === "computer" && !d.name.toLowerCase().includes("web player")
  );

  const deviceData = {
    webPlayer,
    desktop,
    activeDevice,
    activeComputerDevice,
    activeWebPlayerDevice,
    activeDesktopPlayerDevice,
  };
  return deviceData;
}

export function getDeviceMenuInfo() {
  const { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice } = getDeviceSet();

  const devices: PlayerDevice[] = getCurrentDevices() ?? [];

  let primaryText = "";
  let secondaryText = "";
  let isActive = true;
  if (activeDevice) {
    // found an active device
    primaryText = `Listening on your ${activeDevice.name}`;
  } else if (isMac() && desktop) {
    // show that the desktop player is an active device
    primaryText = `Listening on your ${desktop.name}`;
  } else if (webPlayer) {
    // show that the web player is an active device
    primaryText = `Listening on your ${webPlayer.name}`;
  } else if (desktop) {
    // show that the desktop player is an active device
    primaryText = `Listening on your ${desktop.name}`;
  } else if (devices.length) {
    // no active device but found devices
    const names = devices.map((d: PlayerDevice) => d.name);
    primaryText = `Spotify devices available`;
    secondaryText = `${names.join(", ")}`;
    isActive = false;
  } else if (devices.length === 0) {
    // no active device and no devices
    primaryText = "Connect to a Spotify device";
    secondaryText = "Launch the web or desktop player";
    isActive = false;
  }

  return { primaryText, secondaryText, isActive };
}

export function getBestActiveDevice() {
  const { webPlayer, desktop, activeDevice } = getDeviceSet();

  const device = activeDevice ? activeDevice : desktop ? desktop : webPlayer ? webPlayer : null;
  return device;
}

////////////////////////////////////////////////////////////////
// PLAYER CONTEXT FUNCTIONS
////////////////////////////////////////////////////////////////

export async function populatePlayerContext() {
  spotifyContext = await getSpotifyPlayerContext();
  MusicCommandManager.syncControls();
}

////////////////////////////////////////////////////////////////
// UTIL FUNCTIONS
////////////////////////////////////////////////////////////////

export async function requiresSpotifyAccess() {
  const spotifyIntegration = await getSpotifyIntegration();
  // no spotify access token then return true, the user requires spotify access
  return !spotifyIntegration ? true : false;
}

export async function initializeSpotify(reload: boolean = true) {
  // get the client id and secret
  await updateSpotifyClientInfo();

  // ensure cody-music has the latest access token
  await updateCodyConfig();

  // get the spotify user
  await populateSpotifyUser(true);

  await populateSpotifyDevices(false);

  // initialize the status bar music controls
  MusicCommandManager.initialize();

  setTimeout(() => {
    if (reload) {
      commands.executeCommand("musictime.reloadMusicTimeView");
    } else {
      commands.executeCommand("musictime.refreshMusicTimeView");
    }
  }, 1000)
}

export async function isTrackRepeating(): Promise<boolean> {
  // get the current repeat state
  if (!spotifyContext) {
    spotifyContext = await getSpotifyPlayerContext();
  }
  // "off", "track", "context", ""
  const repeatState = spotifyContext ? spotifyContext.repeat_state : "";
  return repeatState && repeatState === "track" ? true : false;
}

export async function removeTrackFromPlaylist(trackItem: PlaylistItem) {
  // get the playlist it's in
  const currentPlaylistId = trackItem["playlist_id"];
  const foundPlaylist = getPlaylistById(currentPlaylistId);
  if (foundPlaylist) {
    // if it's the liked songs, then send it to the setLiked(false) api
    if (foundPlaylist.id === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
      const buttonSelection = await window.showInformationMessage(
        `Are you sure you would like to remove '${trackItem.name}' from your '${SPOTIFY_LIKED_SONGS_PLAYLIST_NAME}' playlist?`,
        ...[YES_LABEL]
      );

      if (buttonSelection === YES_LABEL) {
        await MusicControlManager.getInstance().setLiked(trackItem, false);
      }
    } else {
      // remove it from a playlist
      const tracks = [trackItem.id];
      const result = await removeTracksFromPlaylist(currentPlaylistId, tracks);

      const errMsg = getCodyErrorMessage(result);
      if (errMsg) {
        window.showInformationMessage(`Unable to remove the track from your playlist. ${errMsg}`);
      } else {
        // remove it from the cached list
        playlistTracks[currentPlaylistId] = playlistTracks[currentPlaylistId].filter((n) => n.id !== trackItem.id);

        window.showInformationMessage("Song removed successfully");
        commands.executeCommand("musictime.refreshMusicTimeView");
      }
    }
  }
}

export async function followSpotifyPlaylist(playlist: PlaylistItem) {
  const codyResp: CodyResponse = await followPlaylist(playlist.id);
  if (codyResp.state === CodyResponseType.Success) {
    window.showInformationMessage(`Successfully following the '${playlist.name}' playlist.`);

    // repopulate the playlists since we've changed the state of the playlist
    await getSpotifyPlaylists();

    commands.executeCommand("musictime.refreshMusicTimeView");
  } else {
    window.showInformationMessage(`Unable to follow ${playlist.name}. ${codyResp.message}`, ...[OK_LABEL]);
  }
}

export async function isLikedSong(song: any) {
  if (!song) {
    return false;
  }
  const trackId = getSongId(song);
  if (!trackId) {
    return false;
  }
  if (!spotifyLikedTracks || spotifyLikedTracks.length === 0) {
    // fetch the liked tracks
    await populateLikedSongs();
  }
  return !!spotifyLikedTracks?.find((n) => n.id === trackId);
}

export async function isLikedTrackId(trackId) {
  if (!spotifyLikedTracks || spotifyLikedTracks.length === 0) {
    // fetch the liked tracks
    await populateLikedSongs();
  }
  return !!spotifyLikedTracks?.find((n) => n.id === trackId);
}

////////////////////////////////////////////////////////////////
// PRIVATE FUNCTIONS
////////////////////////////////////////////////////////////////

function getSongId(song) {
  if (song.id) {
    return createSpotifyIdFromUri(song.id);
  } else if (song.uri) {
    return createSpotifyIdFromUri(song.uri);
  } else if (song.song_id) {
    return createSpotifyIdFromUri(song.song_id);
  }
  return null;
}

export function createSpotifyIdFromUri(id: string) {
  if (id && id.indexOf("spotify:") === 0) {
    return id.substring(id.lastIndexOf(":") + 1);
  }
  return id;
}

async function getPlaylistItemTracksFromCodyResponse(codyResponse: CodyResponse): Promise<PlaylistItem[]> {
  const playlistItems: PlaylistItem[] = [];
  if (codyResponse && codyResponse.state === CodyResponseType.Success) {
    const paginationItem: PaginationItem = codyResponse.data;

    if (paginationItem && paginationItem.items) {
      let idx = 1;
      for await (const t of paginationItem.items) {
        const playlistItem: PlaylistItem = createPlaylistItemFromTrack(t, idx);
        playlistItem["liked"] = await isLikedSong(t);
        playlistItems.push(playlistItem);
        idx++;
      }
    }
  }

  return playlistItems;
}

export function createPlaylistItemFromTrack(track: Track, position: number = undefined) {
  if (position === undefined) {
    position = track.track_number;
  }
  const playlistItem: PlaylistItem = new PlaylistItem();
  playlistItem.type = "track";
  playlistItem.name = track.name;
  playlistItem.tooltip = getTrackTooltip(track);
  playlistItem.id = track.id;
  playlistItem.uri = track.uri;
  playlistItem.popularity = track.popularity;
  playlistItem.position = position;
  playlistItem.artist = getArtist(track);
  playlistItem.playerType = track.playerType;
  playlistItem.itemType = "track";
  playlistItem["albumId"] = track?.album?.id;
  playlistItem["albumName"] = getAlbumName(track);
  playlistItem["description"] = getArtistAlbumDescription(track);

  delete playlistItem.tracks;

  return playlistItem;
}

function getTrackTooltip(track: any) {
  let tooltip = track.name;
  const artistName = getArtist(track);

  if (artistName) {
    tooltip += ` - ${artistName}`;
  }
  if (track.popularity) {
    tooltip += ` (Popularity: ${track.popularity})`;
  }
  return tooltip;
}

function getArtistAlbumDescription(track: any) {
  let artistName = getArtist(track);
  let albumName = getAlbumName(track);

  // return artist - album (but abbreviate both if the len is too large)
  if (artistName && albumName && artistName.length + albumName.length > 100) {
    // start abbreviating
    if (artistName.length > 50) {
      artistName = artistName.substring(0, 50) + "...";
    }
    if (albumName.length > 50) {
      albumName = albumName.substring(0, 50) + "...";
    }
  }
  return albumName ? `${artistName} - ${albumName}` : artistName;
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

async function getTrackIdsForRecommendations(seedLimit: number = 5, seedTracks = [], offset = 0) {
  if (seedLimit === 0) {
    return [];
  }

  if (!spotifyLikedTracks) {
    await populateLikedSongs();
  }

  seedLimit = offset + seedLimit;

  // up until limit
  if (spotifyLikedTracks?.length) {
    if (offset > spotifyLikedTracks.length - 1) {
      offset = 0;
    }
    seedTracks.push(...spotifyLikedTracks.slice(offset, seedLimit));
  }

  const remainingLen = seedLimit - seedTracks.length;
  if (remainingLen < seedLimit) {
    // find a few more
    Object.keys(playlistTracks).every((playlist_id) => {
      if (playlist_id !== SPOTIFY_LIKED_SONGS_PLAYLIST_ID && playlistTracks[playlist_id] && playlistTracks[playlist_id].length >= remainingLen) {
        seedTracks.push(...playlistTracks[playlist_id].splice(0, remainingLen));
        return;
      }
    });
  }

  const trackIds = seedTracks.map((n) => n.id);
  return trackIds;
}

function getAlbumName(track) {
  let albumName = track["albumName"];
  if (!albumName && track["album"] && track["album"].name) {
    albumName = track["album"].name;
  }
  return albumName;
}

export function sortPlaylists(playlists, alphabetically = sortAlphabetically) {
  if (playlists && playlists.length > 0) {
    playlists.sort((a: PlaylistItem, b: PlaylistItem) => {
      if (alphabetically) {
        const nameA = a.name.toLowerCase(),
          nameB = b.name.toLowerCase();
        if (nameA < nameB)
          //sort string ascending
          return -1;
        if (nameA > nameB) return 1;
        return 0; // default return value (no sorting)
      } else {
        const indexA = a["index"],
          indexB = b["index"];
        if (indexA < indexB)
          // sort ascending
          return -1;
        if (indexA > indexB) return 1;
        return 0; // default return value (no sorting)
      }
    });
  }
}
