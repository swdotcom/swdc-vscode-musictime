import { PlaylistItem, deletePlaylist, Track } from "cody-music";
import { NOT_NOW_LABEL, OK_LABEL } from "../Constants";
import { window, commands } from "vscode";

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
