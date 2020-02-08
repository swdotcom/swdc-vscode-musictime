import { PlaylistItem, deletePlaylist, Track, PlayerDevice } from "cody-music";
import { NOT_NOW_LABEL, OK_LABEL } from "../Constants";
import { window, commands } from "vscode";
import { MusicManager } from "./MusicManager";
import { getItem } from "../Util";
import { populateSpotifyPlaylists } from "../DataController";
import { MusicDataManager } from "./MusicDataManager";

// duplicate music time playlists names:
// "My AI Top 40", "My Custom Top 40", "Custom Top 40", "AI-generated Custom Top 40", "Software Top 40"
const codyPlaylistNames = [
    "My AI Top 40",
    "Custom Top 40",
    "My Custom Top 40",
    "AI-generated Custom Top 40",
    "Software Top 40"
];

let completedDupCheck: boolean = false;

export async function checkForDups(playlists: PlaylistItem[]) {
    if (completedDupCheck) {
        return;
    }

    let hasDups: boolean = false;
    if (playlists && playlists.length > 0) {
        for (let i = 0; i < playlists.length; i++) {
            const playlist: PlaylistItem = playlists[i];
            if (
                codyPlaylistNames.includes(playlist.name) &&
                playlist.duplicateIds &&
                playlist.duplicateIds.length > 0
            ) {
                hasDups = true;
                break;
            }
        }
    }

    if (hasDups) {
        // prompt to ask if they would like to start deleting all of the dups
        const selectedLabel = await window.showInformationMessage(
            `We found duplicate 'Music Time' generated playlist names. Would you like to unfollow those?`,
            ...[NOT_NOW_LABEL, OK_LABEL]
        );
        if (selectedLabel && selectedLabel === OK_LABEL) {
            await deleteDuplicateSpotifyPlaylists(playlists);
        }
    }
}

export async function deleteDuplicateSpotifyPlaylists(
    playlists: PlaylistItem[]
) {
    if (playlists && playlists.length > 0) {
        for (let i = 0; i < playlists.length; i++) {
            const playlist: PlaylistItem = playlists[i];
            if (
                codyPlaylistNames.includes(playlist.name) &&
                playlist.duplicateIds &&
                playlist.duplicateIds.length > 0
            ) {
                for (let x = 0; x < playlist.duplicateIds.length; x++) {
                    const playlistListId = playlist.duplicateIds[x];
                    await deletePlaylist(playlistListId);
                    console.log(
                        `Deleted playlist '${playlist.name} with ID ${playlistListId}`
                    );
                }
            }
        }
    }

    // repopulate the playlists
    await populateSpotifyPlaylists();

    // refresh the playlist
    commands.executeCommand("musictime.refreshPlaylist");
}

export function sortPlaylists(playlists) {
    if (playlists && playlists.length > 0) {
        playlists.sort((a: PlaylistItem, b: PlaylistItem) => {
            const nameA = a.name.toLowerCase(),
                nameB = b.name.toLowerCase();
            if (nameA < nameB)
                //sort string ascending
                return -1;
            if (nameA > nameB) return 1;
            return 0; //default return value (no sorting)
        });
    }
}

export function sortTracks(tracks) {
    if (tracks && tracks.length > 0) {
        tracks.sort((a: Track, b: Track) => {
            const nameA = a.name.toLowerCase(),
                nameB = b.name.toLowerCase();
            if (nameA < nameB)
                //sort string ascending
                return -1;
            if (nameA > nameB) return 1;
            return 0; //default return value (no sorting)
        });
    }
}

export async function buildTracksForRecommendations(playlists) {
    const dataMgr: MusicDataManager = MusicDataManager.getInstance();

    // no need to refresh recommendations if we already have track IDs
    if (
        dataMgr.trackIdsForRecommendations &&
        dataMgr.trackIdsForRecommendations.length > 0
    ) {
        return;
    }

    const musicMgr: MusicManager = MusicManager.getInstance();
    let trackIds = [];
    let foundTracksForRec = false;

    // build tracks for recommendations
    if (dataMgr.spotifyLikedSongs && dataMgr.spotifyLikedSongs.length) {
        trackIds = dataMgr.spotifyLikedSongs.map((track: Track) => {
            return track.id;
        });
        foundTracksForRec = true;
    } else {
        // go through the found playlists and the first one that returns 3 or more wins
        if (playlists && playlists.length > 0) {
            for (let i = 0; i < playlists.length; i++) {
                const playlist = playlists[i];

                const playlistItems: PlaylistItem[] = await musicMgr.getPlaylistItemTracksForPlaylistId(
                    playlist.id
                );
                if (playlistItems && playlistItems.length >= 3) {
                    foundTracksForRec = true;
                    trackIds = playlistItems.map((item: PlaylistItem) => {
                        return item.id;
                    });
                    break;
                }
            }
        }
    }

    dataMgr.trackIdsForRecommendations = trackIds;

    if (foundTracksForRec) {
        // refresh the recommendations
        setTimeout(() => {
            commands.executeCommand("musictime.refreshRecommendations");
        }, 1000);
    }
}

export function getActiveDevice(devices: PlayerDevice[]): PlayerDevice {
    let computerDevice: PlayerDevice = null;
    let otherActiveDevice: PlayerDevice = null;
    if (devices && devices.length > 0) {
        for (let i = 0; i < devices.length; i++) {
            const device: PlayerDevice = devices[i];
            if (device.is_active) {
                if (device.type.toLowerCase() === "computer") {
                    computerDevice = device;
                } else {
                    otherActiveDevice = device;
                }
            }
        }
    }

    if (computerDevice) {
        return computerDevice;
    }
    return otherActiveDevice;
}

export function getComputerOrActiveDevice(
    devices: PlayerDevice[] = []
): PlayerDevice {
    if (!devices || devices.length === 0) {
        devices = MusicDataManager.getInstance().currentDevices;
    }
    let anyActiveDevice: PlayerDevice = null;
    if (devices && devices.length > 0) {
        for (let i = 0; i < devices.length; i++) {
            const device: PlayerDevice = devices[i];
            if (device.type.toLowerCase() === "computer") {
                return device;
            } else if (!anyActiveDevice && device.is_active) {
                anyActiveDevice = device;
            }
        }
    }
    return anyActiveDevice;
}

export function getComputerDevice(devices: PlayerDevice[] = []): PlayerDevice {
    if (devices && devices.length > 0) {
        for (let i = 0; i < devices.length; i++) {
            const device: PlayerDevice = devices[i];
            if (device.type.toLowerCase() === "computer") {
                return device;
            }
        }
    }
    return null;
}

export function requiresSpotifyAccess() {
    let spotifyAccessToken = getItem("spotify_access_token");
    return spotifyAccessToken ? false : true;
}
