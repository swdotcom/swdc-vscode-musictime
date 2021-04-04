import { CodyResponse, CodyResponseType, getPlaylists, getPlaylistTracks, getSpotifyLikedSongs, PaginationItem, PlayerName, PlayerType, PlaylistItem, PlaylistTrackInfo, Track, TrackStatus } from 'cody-music';
import { commands } from 'vscode';
import { SPOTIFY_LIKED_SONGS_PLAYLIST_ID, SPOTIFY_LIKED_SONGS_PLAYLIST_NAME } from '../Constants';
import { getSpotifyIntegration } from './SpotifyManager';

let spotifyLikedSongs: Track[] = undefined;
let spotifyPlaylists: PlaylistItem[] = undefined;
let playlistTracks: any = {};
let selectedPlaylistId = undefined;

export async function clearSpotifyLikedSongsCache() {
	spotifyLikedSongs = undefined;
}

export function getCachedPlaylistTracks() {
	return playlistTracks;
}

export function getCachedLikedSongsTracks() {
	return spotifyLikedSongs;
}

export function getSelectedPlaylistId() {
	return selectedPlaylistId;
}

export async function clearSpotifyPlaylistsCache() {
	spotifyPlaylists = undefined;
}

// PLAYLIST TYPES

export async function getSpotifyPlaylists(): Promise<PlaylistItem[]> {
	if (requiresSpotifyAccess()) {
		return [];
	}

	if (spotifyPlaylists) {
		return spotifyPlaylists;
	}
	spotifyPlaylists = await getPlaylists(PlayerName.SpotifyWeb, {all: true});
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

export async function fetchTracksForLikedSongs(): Promise<Track[]> {
	if (requiresSpotifyAccess()) {
		return [];
	}

	spotifyLikedSongs = await getSpotifyLikedSongs();
	return spotifyLikedSongs;
}

export async function fetchTracksForPlaylist(playlist_id) {
	selectedPlaylistId = playlist_id;
	if (!playlistTracks[playlist_id]) {
		const results: CodyResponse = await getPlaylistTracks(PlayerName.SpotifyWeb, playlist_id);
		const tracks: PlaylistItem[] = getPlaylistItemTracksFromCodyResponse(results);
		playlistTracks[playlist_id] = tracks;
	}
	// refresh the webview
	commands.executeCommand("musictime.refreshMusicTimeView");
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
