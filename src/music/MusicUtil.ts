import { PlayerDevice } from "cody-music";
import { window } from "vscode";
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

export function getBestActiveDevice() {
    const { webPlayer, desktop, activeDevice } = getDeviceSet();

    const device = activeDevice
        ? activeDevice
        : desktop
            ? desktop
            : webPlayer
                ? webPlayer
                : null;
    return device;
}
