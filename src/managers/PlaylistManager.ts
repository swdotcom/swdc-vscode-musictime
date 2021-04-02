import { CodyResponse, CodyResponseType, getPlaylists, getPlaylistTracks, PaginationItem, PlayerName, PlaylistItem, Track, TrackStatus } from 'cody-music';
import { commands } from 'vscode';
import { getSpotifyIntegration } from './SpotifyManager';

let spotifyLikedSongs: Track[] = undefined;
let spotifyPlaylists: PlaylistItem[] = undefined;
let playlistTracks: any = {};

export async function clearSpotifyLikedSongsCache() {
	spotifyLikedSongs = undefined;
}

export function getCachedPlaylistTracks() {
	return playlistTracks;
}

export async function getSpotifyLikedSongs(): Promise<Track[]> {
	if (requiresSpotifyAccess()) {
		return [];
	}

	if (spotifyLikedSongs) {
		return spotifyLikedSongs;
	}
	spotifyLikedSongs = await getSpotifyLikedSongs();
	return spotifyLikedSongs;
}

export async function clearSpotifyPlaylistsCache() {
	spotifyPlaylists = undefined;
}

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

function requiresSpotifyAccess() {
	const spotifyIntegration = getSpotifyIntegration();
	// no spotify access token then return true, the user requires spotify access
	return !spotifyIntegration ? true : false;
}

export async function fetchTracksForPlaylist(playlist_id) {
	if (!playlistTracks[playlist_id]) {
		const results: CodyResponse = await getPlaylistTracks(PlayerName.SpotifyWeb, playlist_id);
		const tracks: PlaylistItem[] = getPlaylistItemTracksFromCodyResponse(results);
		playlistTracks[playlist_id] = tracks;
	}
	// refresh the webview
	commands.executeCommand("musictime.refreshMusicTimeView");
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
