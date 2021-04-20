import { getCurrentColorKind } from "../extension";
import { getItem } from "../managers/FileManager";
import {
  getCachedLikedSongsTracks,
  getCachedPlaylistTracks,
  getCachedRecommendationInfo,
  getCachedRunningTrack,
  getCachedSoftwareTop40Playlist,
  getCachedSpotifyPlayerContext,
  getCachedSpotifyPlaylists,
  getCachedUserMetricsData,
  getDeviceMenuInfo,
  getSelectedPlaylistId,
  getSelectedTabView,
  getSpotifyLikedPlaylist,
  isLikedSong,
} from "../managers/PlaylistDataManager";
import { getSlackWorkspaces, hasSlackWorkspaces } from "../managers/SlackManager";
import { getConnectedSpotifyUser } from "../managers/SpotifyManager";
import { isCodeTimeTimeInstalled } from "../Util";

export async function getReactData(tab_view = undefined, playlist_id = undefined) {
  const name = getItem("name");
  const authType = getItem("authType");
  const spotifyUser = getConnectedSpotifyUser();

  const selectedTabView = tab_view ? tab_view : getSelectedTabView();

  let spotifyPlaylists = [];
  let likedSongsTracks = [];
  let playlistTracks = [];
  let softwareTop40Playlist = undefined;
  let selectedPlaylistId = undefined;
  let recommendationInfo = [];
  let userMusicMetrics = [];
  let averageMusicMetrics = undefined;
  let spotifyPlayerContext = undefined;
  let currentlyRunningTrack = undefined;
  let deviceMenuInfo = getDeviceMenuInfo();
  if (spotifyUser) {
    spotifyPlayerContext = await getCachedSpotifyPlayerContext();
    currentlyRunningTrack = getCachedRunningTrack();

    if (currentlyRunningTrack) {
      currentlyRunningTrack["liked"] = await isLikedSong(currentlyRunningTrack);
    }

    if (selectedTabView === "playlists") {
      likedSongsTracks = getCachedLikedSongsTracks();
      playlistTracks = getCachedPlaylistTracks();
      softwareTop40Playlist = await getCachedSoftwareTop40Playlist();
      spotifyPlaylists = await getCachedSpotifyPlaylists();

      selectedPlaylistId = playlist_id ? playlist_id : getSelectedPlaylistId();
    } else if (selectedTabView === "metrics") {
      const metricsData = await getCachedUserMetricsData();
      userMusicMetrics = metricsData.userMusicMetrics ?? [];
      averageMusicMetrics = metricsData.averageMusicMetrics ?? [];
    } else if (selectedTabView === "recommendations") {
      recommendationInfo = getCachedRecommendationInfo();
    }
  }

  const reactData = {
    authType,
    registered: !!name,
    email: name,
    spotifyPlaylists,
    selectedTabView,
    recommendationInfo,
    userMusicMetrics,
    averageMusicMetrics,
    likedSongsTracks,
    playlistTracks,
    softwareTop40Playlist,
    selectedPlaylistId,
    spotifyPlayerContext,
    currentlyRunningTrack,
    deviceMenuInfo,
    likedSongsPlaylist: getSpotifyLikedPlaylist(),
    spotifyUser: getConnectedSpotifyUser(),
    slackConnected: !!hasSlackWorkspaces(),
    slackWorkspaces: getSlackWorkspaces(),
    currentColorKind: getCurrentColorKind(),
    codeTimeInstalled: isCodeTimeTimeInstalled(),
    skipSlackConnect: getItem("vscode_CtskipSlackConnect"),
  };
  return reactData;
}
