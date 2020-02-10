import { showQuickPick } from "../MenuManager";
import { PlayerDevice } from "cody-music";
import { MusicDataManager } from "../music/MusicDataManager";

export async function showDeviceSelectorMenu() {
    const devices: PlayerDevice[] = await MusicDataManager.getInstance()
        .currentDevices;
    let items: any[] = [];
    if (devices && devices.length) {
        devices.forEach((d: PlayerDevice) => {
            if (!d.is_active) {
                items.push({
                    label: d.name,
                    command: "musictime.transferToDevice",
                    args: d,
                    type: d.type
                });
            }
        });
    }

    const foundNonActiveWebDevice = items.find((d: any) =>
        d.label.toLowerCase().includes("web")
    );
    const foundNonActiveComputerDevice = items.find(
        (d: any) => d.type.toLowerCase() === "computer"
    );

    // add Spotify Web and Spotify Desktop
    if (!foundNonActiveWebDevice && !foundNonActiveComputerDevice) {
        items.push({
            label: "Launch Spotify desktop",
            command: "musictime.launchSpotifyDesktop"
        });
    }
    if (!foundNonActiveWebDevice) {
        items.push({
            label: "Launch Spotify web player",
            command: "musictime.launchSpotify"
        });
    }
    let menuOptions = {
        items,
        placeholder: "Connect a Spotify device"
    };

    const pick = await showQuickPick(menuOptions);
    if (pick && pick.label) {
        return pick.label;
    }
    return null;
}
