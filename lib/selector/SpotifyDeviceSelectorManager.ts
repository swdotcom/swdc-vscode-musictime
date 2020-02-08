import { showQuickPick } from "../MenuManager";
import { getSpotifyDevices, PlayerDevice, PlayerName } from "cody-music";

export async function showDeviceSelectorMenu() {
    const devices: PlayerDevice[] = await getSpotifyDevices();
    let items: any[] = [];
    if (devices && devices.length) {
        items = devices.map((d: PlayerDevice) => {
            return {
                label: d.name,
                command: "musictime.transferToDevice",
                args: d
            };
        });
    } else {
        // add Spotify Web and Spotify Desktop
        items.push({
            label: "Spotify desktop",
            command: "musictime.launchSpotifyDesktop"
        });
        items.push({
            label: "Spotify web player",
            command: "musictime.launchSpotify"
        });
    }
    let menuOptions = {
        items,
        placeholder: "Select device to transfer to"
    };

    const pick = await showQuickPick(menuOptions);
    if (pick && pick.label) {
        return pick.label;
    }
    return null;
}
