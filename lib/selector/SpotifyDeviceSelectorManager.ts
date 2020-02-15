import { showQuickPick } from "../MenuManager";
import { PlayerDevice } from "cody-music";
import { MusicDataManager } from "../music/MusicDataManager";

export async function showDeviceSelectorMenu() {
    let devices: PlayerDevice[] =
        MusicDataManager.getInstance().currentDevices || [];

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

    const foundWebComputerDevice = devices.find((d: PlayerDevice) =>
        d.name.toLowerCase().includes("web player")
    );

    const computerDevicesFound = devices
        .filter((d: PlayerDevice) => d.type.toLowerCase() === "computer")
        .map((d: PlayerDevice) => d);

    // show the launch desktop option if it's not already in the list
    // or if it's an active device
    if (
        computerDevicesFound.length === 0 ||
        (computerDevicesFound.length < 2 && foundWebComputerDevice)
    ) {
        items.push({
            label: "Launch Spotify desktop",
            command: "musictime.launchSpotifyDesktop"
        });
    }
    if (!foundWebComputerDevice) {
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
