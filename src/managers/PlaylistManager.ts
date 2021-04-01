import { getPlaylists, PlayerName, PlaylistItem, Track } from 'cody-music';
import { getSpotifyIntegration } from './SpotifyManager';

let spotifyLikedSongs: Track[] = undefined;
let spotifyPlaylists: PlaylistItem[] = undefined;

export async function clearSpotifyLikedSongsCache() {
	spotifyLikedSongs = undefined;
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
