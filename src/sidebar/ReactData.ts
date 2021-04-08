import { getCurrentColorKind } from "../extension";
import { getItem } from "../managers/FileManager";
import {
  getCachedAverageMusicMetrics,
  getCachedLikedSongsTracks,
  getCachedPlaylistTracks,
  getCachedRecommendationInfo,
  getCachedSoftwareTop40Playlist,
  getCachedSpotifyPlaylists,
  getCachedUserMusicMetrics,
  getSelectedPlaylistId,
  getSelectedTabView,
  getSoftwareTop40Playlist,
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

  let spotifyPlaylists = [];
  let likedSongsTracks = [];
  let playlistTracks = [];
  let softwareTop40Playlist = {};
  if (selectedTabView === "playlists") {
    likedSongsTracks = getCachedLikedSongsTracks();
    playlistTracks = getCachedPlaylistTracks();

    softwareTop40Playlist = getCachedSoftwareTop40Playlist();
    if (!softwareTop40Playlist) {
      softwareTop40Playlist = await getSoftwareTop40Playlist();
    }

    spotifyPlaylists = getCachedSpotifyPlaylists();
    if (!spotifyPlaylists) {
      spotifyPlaylists = await getSpotifyPlaylists();
    }
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
    softwareTop40Playlist,
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
