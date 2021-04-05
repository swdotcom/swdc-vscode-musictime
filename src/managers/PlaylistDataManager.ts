import {
  CodyResponse,
  CodyResponseType,
  getPlaylists,
  getPlaylistTracks,
  getRecommendationsForTracks,
  getSpotifyLikedSongs,
  PaginationItem,
  PlayerName,
  PlayerType,
  PlaylistItem,
  PlaylistTrackInfo,
  Track,
} from "cody-music";
import { commands } from "vscode";
import { SPOTIFY_LIKED_SONGS_PLAYLIST_ID, SPOTIFY_LIKED_SONGS_PLAYLIST_NAME } from "../Constants";
import { isResponseOk, softwareGet } from '../HttpClient';
import MusicMetrics from '../model/MusicMetrics';
import { getItem } from './FileManager';
import { requiresSpotifyAccess } from "./PlaylistUtilManager";

let spotifyLikedTracks: Track[] = undefined;
let spotifyPlaylists: PlaylistItem[] = undefined;
let recommendedTracks: Track[] = undefined;
let playlistTracks: any = {};
let userMusicMetrics: MusicMetrics[] = undefined;
let globalMusicMetrics: MusicMetrics[] = undefined;
let selectedPlaylistId = undefined;
let selectedPlaylistItem: PlaylistItem = undefined;
let selectedPlayerName = PlayerName.SpotifyWeb;
// playlists, recommendations, metrics
let selectedTabView = "playlists";
let currentRecMeta: any = {};

export async function clearSpotifyLikedTracksCache() {
  spotifyLikedTracks = undefined;
}

export async function clearSpotifyPlaylistsCache() {
  spotifyPlaylists = undefined;
}

// UPDATES

export function updateSpotifyPlaylists(playlists) {
  spotifyPlaylists = playlists;
}

export function updateSpotifyLikedTracks(songs) {
  spotifyLikedTracks = songs;
}

export function updateSpotifyPlaylistTracks(id, songs) {
  playlistTracks[id] = songs;
}

export function updateSelectedPlaylistItem(item) {
  selectedPlaylistItem = item;
}

export function updateSelectedPlayer(player: PlayerName) {
  selectedPlayerName = player;
}

export function updateSelectedTabView(tabView: string) {
  selectedTabView = tabView;
}

// GETTERS

export function getCachedPlaylistTracks() {
  return playlistTracks;
}

export function getCachedLikedSongsTracks() {
  return spotifyLikedTracks;
}

export function getCachedRecommendedTracks() {
  return recommendedTracks ? recommendedTracks.splice(0, 11) : undefined;
}

export function getCachedUserMusicMetrics() {
  return userMusicMetrics;
}

export function getSelectedPlaylistId() {
  return selectedPlaylistId;
}

export function getSelectedPlayerName() {
  return selectedPlayerName;
}

export function getSelectedPlaylistItem() {
  return selectedPlaylistItem;
}

export function getSelectedTabView() {
  return selectedTabView;
}

// PLAYLISTS
// all playlists except for liked songs
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

// liked songs playlist
export function getSpotifyLikedTracksPlaylist() {
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

// liked songs
export async function fetchTracksForLikedSongs() {
  selectedPlaylistId = SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
  if (!spotifyLikedTracks) {
    await populateLikedSongs();
  }

  // refresh the webview
  commands.executeCommand("musictime.refreshMusicTimeView");
}

// songs for a specified non-liked songs playlist
export async function fetchTracksForPlaylist(playlist_id) {
  selectedPlaylistId = playlist_id;
  if (!playlistTracks[playlist_id]) {
    const results: CodyResponse = await getPlaylistTracks(PlayerName.SpotifyWeb, playlist_id);
    let tracks: PlaylistItem[] = getPlaylistItemTracksFromCodyResponse(results);
    // add the playlist id to the tracks
    if (tracks?.length) {
      tracks = tracks.map((t) => {
        const albumName = getAlbumName(t);
        return { ...t, playlist_id, albumName };
      });
    }
    playlistTracks[playlist_id] = tracks;
  }
  // refresh the webview
  commands.executeCommand("musictime.refreshMusicTimeView");
}

export async function getUserMusicMetrics() {
  const resp = await softwareGet("/music/metrics", getItem("jwt"));
  if (isResponseOk(resp) && resp.data) {
    userMusicMetrics = resp.data.user_music_metrics;
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
	return getRecommendations("Instrumental", 5, [], { min_instrumentalness: 0.6, target_instrumentalness: 1 })
}

export function getQuietMusicRecs() {
	return getRecommendations("Quiet music", 5, [], { max_loudness: -10, target_loudness: -50 });
}

export function getTrackRecs(playlistItem: PlaylistItem) {
	return getRecommendations(playlistItem.name, 4, [], {}, 0, [playlistItem]);
}

export async function getRecommendations(
  label: string,
  seedLimit: number = 5,
  seed_genres: string[] = [],
  features: any = {},
  offset: number = 0,
	seedTracks = []
) {

	seedLimit = Math.max(seedLimit, 5);

  currentRecMeta = {
    label,
    seedLimit,
    seed_genres,
    features,
    offset,
  };

  recommendedTracks = await getTrackIdsForRecommendations(seedLimit, seedTracks).then(async (trackIds) => {
    let tracks = await getRecommendationsForTracks(trackIds, 100, "" /*market*/, 20, 100, seed_genres, [] /*artists*/, features);
    if (tracks?.length) {
      tracks = tracks.map((t) => {
        const albumName = getAlbumName(t);
        return { ...t, albumName };
      });
    }
    return tracks;
  });

  // refresh the webview
  commands.executeCommand("musictime.refreshMusicTimeView");
}

// PRIVATE FUNCTIONS

async function populateLikedSongs() {
  spotifyLikedTracks = (await getSpotifyLikedSongs()) || [];
  // add the playlist id to the tracks
  if (spotifyLikedTracks?.length) {
    spotifyLikedTracks = spotifyLikedTracks.map((t) => {
      const albumName = getAlbumName(t);
      return { ...t, playlist_id: SPOTIFY_LIKED_SONGS_PLAYLIST_ID, albumName };
    });
  }
}

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

async function getTrackIdsForRecommendations(seedLimit: number = 5, seedTracks = []) {
  if (!spotifyLikedTracks) {
    await populateLikedSongs();
  }

  // up until limit
  seedTracks.push(...spotifyLikedTracks.slice(0, seedLimit));

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

  let trackIds = seedTracks.map((n) => n.id);
  return trackIds;
}

function getAlbumName(track) {
  let albumName = track["albumName"];
  if (!albumName && track["album"] && track["album"].name) {
    albumName = track["album"].name;
  }
  return albumName;
}
