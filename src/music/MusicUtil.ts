import { PlaylistItem, deletePlaylist, Track, PlayerDevice } from "cody-music";
import { NOT_NOW_LABEL, OK_LABEL } from "../Constants";
import { window, commands } from "vscode";
import { MusicManager } from "./MusicManager";
import { populateSpotifyPlaylists } from "../DataController";
import { MusicDataManager } from "./MusicDataManager";
import { connectSpotify, getSpotifyIntegration } from "../managers/SpotifyManager";
import { getItem } from "../managers/FileManager";

// duplicate music time playlists names:
// "My AI Top 40", "My Custom Top 40", "Custom Top 40", "AI-generated Custom Top 40", "Software Top 40"
const codyPlaylistNames = [
    "My AI Top 40",
    "Custom Top 40",
    "My Custom Top 40",
    "AI-generated Custom Top 40",
    "Software Top 40",
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
    }
    let hasEnoughTrackIds = trackIds && trackIds.length > 1 ? true : false;
    if (!hasEnoughTrackIds) {
        // go through the found playlists and the first one that has enough wins
        if (playlists && playlists.length > 0) {
            for (let i = 0; i < playlists.length; i++) {
                const playlist = playlists[i];

                const playlistItems: PlaylistItem[] = await musicMgr.getPlaylistItemTracksForPlaylistId(
                    playlist.id
                );
                if (playlistItems && playlistItems.length > 1) {
                    foundTracksForRec = true;
                    trackIds = playlistItems.map((item: PlaylistItem) => {
                        return item.id;
                    });
                    break;
                }
            }
        }
    }

    // set the tracks for the recommendations
    dataMgr.trackIdsForRecommendations = trackIds;
}

export function requiresSpotifyAccess() {
    const spotifyIntegration = getSpotifyIntegration();
    // no spotify access token then return true, the user requires spotify access
    return !spotifyIntegration ? true : false;
}

export function requiresSpotifyReAuthentication() {
    const requiresSpotifyReAuth = getItem("requiresSpotifyReAuth");
    return requiresSpotifyReAuth ? true : false;
}

export async function showReconnectPrompt(email) {
    const reconnectButtonLabel = "Reconnect";
    const msg = `To continue using Music Time, please reconnect your Spotify account (${email}).`;
    const selection = await window.showInformationMessage(
        msg,
        ...[reconnectButtonLabel]
    );

    if (selection === reconnectButtonLabel) {
        // now launch re-auth
        await connectSpotify();
    }
}

/**
 * returns { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice }
 * Either of these values can be null
 */
export function getDeviceSet() {
    const devices: PlayerDevice[] =
        MusicDataManager.getInstance().currentDevices || [];

    const webPlayer = devices.find((d: PlayerDevice) =>
        d.name.toLowerCase().includes("web player")
    );

    const desktop = devices.find(
        (d: PlayerDevice) =>
            d.type.toLowerCase() === "computer" &&
            !d.name.toLowerCase().includes("web player")
    );

    const activeDevice = devices.find((d: PlayerDevice) => d.is_active);

    const activeComputerDevice = devices.find(
        (d: PlayerDevice) => d.is_active && d.type.toLowerCase() === "computer"
    );

    const activeWebPlayerDevice = devices.find(
        (d: PlayerDevice) =>
            d.is_active &&
            d.type.toLowerCase() === "computer" &&
            d.name.toLowerCase().includes("web player")
    );

    const activeDesktopPlayerDevice = devices.find(
        (d: PlayerDevice) =>
            d.is_active &&
            d.type.toLowerCase() === "computer" &&
            !d.name.toLowerCase().includes("web player")
    );

    const deviceData = {
        webPlayer,
        desktop,
        activeDevice,
        activeComputerDevice,
        activeWebPlayerDevice,
        activeDesktopPlayerDevice,
    };
    return deviceData;
}

export function getDeviceId() {
    const { webPlayer, desktop, activeDevice } = getDeviceSet();

    const deviceId = activeDevice
        ? activeDevice.id
        : desktop
            ? desktop.id
            : webPlayer
                ? webPlayer.id
                : "";
    return deviceId;
}
