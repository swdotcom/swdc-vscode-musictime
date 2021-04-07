import { getCurrentColorKind } from "../extension";
import { getItem } from "../managers/FileManager";
import {
  getCachedAverageMusicMetrics,
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
import { isCodeTimeTimeInstalled } from '../Util';

export async function getReactData(tabView = undefined) {
  const name = getItem("name");
  const authType = getItem("authType");

  const selectedTabView = tabView ? tabView : getSelectedTabView();

  const [spotifyPlaylists] = await Promise.all([getSpotifyPlaylists()]);
  let likedSongsTracks = [];
  let playlistTracks = [];
  if (selectedTabView === "playlists") {
    likedSongsTracks = getCachedLikedSongsTracks();
    playlistTracks = getCachedPlaylistTracks();
  }
  const recommendationInfo = selectedTabView === "recommendations" ? getCachedRecommendationInfo() : [];
  const userMusicMetrics = selectedTabView === "metrics" ? getCachedUserMusicMetrics() : [];
  const averageMusicMetrics = selectedTabView === "metrics" ? getCachedAverageMusicMetrics() : {};

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
    likedSongsPlaylist: getSpotifyLikedTracksPlaylist(),
    selectedPlaylistId: getSelectedPlaylistId(),
    spotifyUser: getConnectedSpotifyUser(),
    slackConnected: !!hasSlackWorkspaces(),
    slackWorkspaces: getSlackWorkspaces(),
    currentColorKind: getCurrentColorKind(),
    codeTimeInstalled: isCodeTimeTimeInstalled(),
    skipSlackConnect: getItem("vscode_CtskipSlackConnect"),
  };
  return reactData;
}
