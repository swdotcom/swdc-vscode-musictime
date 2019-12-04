import { MusicManager } from "./MusicManager";
import { PlaylistItem, deletePlaylist } from "cody-music";
import { bool } from "aws-sdk/clients/signer";
import { NOT_NOW_LABEL, OK_LABEL } from "../Constants";
import { window, commands } from "vscode";

// duplicate music time playlists names:
// "My AI Top 40", "My Custom Top 40", "Custom Top 40", "AI-generated Custom Top 40", "Software Top 40"
const codyPlaylistNames = [
    "My AI Top 40",
    "Custom Top 40",
    "My Custom Top 40",
    "AI-generated Custom Top 40"
];

const restrictedNames = ["Software Top 40"];

export class PlaylistManager {
    private static instance: PlaylistManager;

    private musicMgr: MusicManager;
    private completedDupCheck: boolean = false;

    private constructor() {
        this.musicMgr = MusicManager.getInstance();
    }
    static getInstance(): PlaylistManager {
        if (!PlaylistManager.instance) {
            PlaylistManager.instance = new PlaylistManager();
        }

        return PlaylistManager.instance;
    }

    async checkForDups() {
        if (this.completedDupCheck) {
            return;
        }

        let hasDups: boolean = false;
        const spotifyPlaylists = this.musicMgr.spotifyPlaylists;
        if (spotifyPlaylists && spotifyPlaylists.length > 0) {
            for (let i = 0; i < spotifyPlaylists.length; i++) {
                const playlist: PlaylistItem = spotifyPlaylists[i];
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
            if (selectedLabel === OK_LABEL) {
                await this.deleteDuplicateSpotifyPlaylists();
            }
        }
    }

    async deleteDuplicateSpotifyPlaylists() {
        const spotifyPlaylists = this.musicMgr.spotifyPlaylists;
        if (spotifyPlaylists && spotifyPlaylists.length > 0) {
            for (let i = 0; i < spotifyPlaylists.length; i++) {
                const playlist: PlaylistItem = spotifyPlaylists[i];
                if (
                    codyPlaylistNames.includes(playlist.name) &&
                    !restrictedNames.includes(playlist.name) &&
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
}
