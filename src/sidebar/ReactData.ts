import { getCurrentColorKind } from "../extension";
import { getItem } from "../managers/FileManager";
import {
  getCachedLikedSongsTracks,
  getCachedPlaylistTracks,
  getCachedRecommendedTracks,
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

  const [spotifyPlaylists] = await Promise.all([getSpotifyPlaylists()]);
  const reactData = {
    authType,
    registered: !!name,
    email: name,
    spotifyPlaylists,
    selectedTabView: getSelectedTabView(),
    likedSongsPlaylist: getSpotifyLikedTracksPlaylist(),
    likedSongsTracks: getCachedLikedSongsTracks(),
    recommendationTracks: getCachedRecommendedTracks(),
    selectedPlaylistId: getSelectedPlaylistId(),
    playlistTracks: getCachedPlaylistTracks(),
    spotifyUser: getConnectedSpotifyUser(),
    slackConnected: !!hasSlackWorkspaces(),
    slackWorkspaces: getSlackWorkspaces(),
    currentColorKind: getCurrentColorKind(),
    skipSlackConnect: getItem("vscode_CtskipSlackConnect"),
  };
  return reactData;
}
