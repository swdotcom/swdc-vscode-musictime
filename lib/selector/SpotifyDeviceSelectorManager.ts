import { showQuickPick } from "../MenuManager";
import { PlayerDevice } from "cody-music";
import { MusicDataManager } from "../music/MusicDataManager";

export async function showDeviceSelectorMenu() {
    let devices: PlayerDevice[] =
        MusicDataManager.getInstance().currentDevices || [];

    let items: any[] = [];
    if (devices && devices.length) {
        devices.forEach((d: PlayerDevice) => {
            const detail = d.is_active
                ? `Active at ${d.volume_percent}% volume`
                : `Inactive at ${d.volume_percent}% volume`;
            items.push({
                label: d.name,
                command: "musictime.transferToDevice",
                args: d,
                type: d.type,
                detail
            });
        });
    }

    const webPlayer = devices.find((d: PlayerDevice) =>
        d.name.toLowerCase().includes("web player")
    );

    const desktop = devices
        .filter(
            (d: PlayerDevice) =>
                d.type.toLowerCase() === "computer" &&
                !d.name.toLowerCase().includes("web player")
        )
        .map((d: PlayerDevice) => d);

    // show the launch desktop option if it's not already in the list
    // or if it's an active device
    if (!desktop) {
        items.push({
            label: "Launch Spotify desktop",
            command: "musictime.launchSpotifyDesktop"
        });
    }
    if (!webPlayer) {
        items.push({
            label: "Launch Spotify web player",
            command: "musictime.launchSpotify"
        });
    }
    let menuOptions = {
        items,
        placeholder: "Launch a Spotify device"
    };

    const pick = await showQuickPick(menuOptions);
    if (pick && pick.label) {
        return pick.label;
    }
    return null;
}
