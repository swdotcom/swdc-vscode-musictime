import { getCurrentColorKind } from "../extension";
import { getItem } from "../managers/FileManager";
import {
  getCachedLikedSongsTracks,
  getCachedPlaylistTracks,
  getCachedRecommendationInfo,
  getCachedUserMusicMetrics,
  getSelectedPlaylistId,
  getSelectedTabView,
  getSpotifyLikedTracksPlaylist,
  getSpotifyPlaylists,
} from "../managers/PlaylistDataManager";
import { getSlackWorkspaces, hasSlackWorkspaces } from "../managers/SlackManager";
import { getConnectedSpotifyUser } from "../managers/SpotifyManager";

export async function getReactData() {
  const name = getItem("name");
  const authType = getItem("authType");

  const selectedTabView = getSelectedTabView();

  const [spotifyPlaylists] = await Promise.all([getSpotifyPlaylists()]);
  let likedSongsTracks = [];
  let playlistTracks = [];
  if (selectedTabView === "playlists") {
    likedSongsTracks = getCachedLikedSongsTracks();
    playlistTracks = getCachedPlaylistTracks();
  }
  const recommendationInfo = selectedTabView === "recommendations" ? getCachedRecommendationInfo() : [];
  const userMusicMetrics = selectedTabView === "metrics" ? getCachedUserMusicMetrics() : {};

  const reactData = {
    authType,
    registered: !!name,
    email: name,
    spotifyPlaylists,
    selectedTabView,
    recommendationInfo,
    userMusicMetrics,
    likedSongsTracks,
    playlistTracks,
    likedSongsPlaylist: getSpotifyLikedTracksPlaylist(),
    selectedPlaylistId: getSelectedPlaylistId(),
    spotifyUser: getConnectedSpotifyUser(),
    slackConnected: !!hasSlackWorkspaces(),
    slackWorkspaces: getSlackWorkspaces(),
    currentColorKind: getCurrentColorKind(),
    skipSlackConnect: getItem("vscode_CtskipSlackConnect"),
  };
  return reactData;
}
