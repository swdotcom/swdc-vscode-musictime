import { commands } from "vscode";
import { softwareGet, isResponseOk } from "./HttpClient";
import {
    PlayerName,
    getPlaylists,
    getSpotifyDevices,
    PlayerDevice
} from "cody-music";
import { MusicDataManager } from "./music/MusicDataManager";
import { MusicCommandUtil } from "./music/MusicCommandUtil";
import { MusicStateManager } from "./music/MusicStateManager";

const moment = require("moment-timezone");

let loggedInCacheState = null;

let currentDayHour = null;

export function isNewHour() {
    const dayHr = moment().format("YYYY-MM-DD-HH");

    if (!currentDayHour || dayHr !== currentDayHour) {
        currentDayHour = dayHr;
        return true;
    }

    return false;
}

export function getLoggedInCacheState() {
    return loggedInCacheState;
}

export async function serverIsAvailable() {
    let serverAvailable = await softwareGet("/ping", null)
        .then((result) => {
            return isResponseOk(result);
        })
        .catch((e) => {
            return false;
        });
    return serverAvailable;
}

export async function populateSpotifyPlaylists() {
    const dataMgr: MusicDataManager = MusicDataManager.getInstance();

    // clear out the raw and orig playlists
    dataMgr.origRawPlaylistOrder = [];
    dataMgr.rawPlaylists = [];

    // fetch music time app saved playlists
    await dataMgr.fetchSavedPlaylists();

    // fetch the playlists from spotify
    const rawPlaylists = await MusicCommandUtil.getInstance().runSpotifyCommand(
        getPlaylists,
        [
            PlayerName.SpotifyWeb,
            {
                all: true,
            },
        ]
    );

    // set the list of playlistIds based on this current order
    if (rawPlaylists && rawPlaylists.status && rawPlaylists.status >= 400) {
        // try again in a few seconds
        setTimeout(() => {
            populateSpotifyPlaylists();
        }, 3000);
    } else {
        dataMgr.origRawPlaylistOrder = [...rawPlaylists];
        dataMgr.rawPlaylists = rawPlaylists;
    }

    // populate generated playlists
    await dataMgr.populateGeneratedPlaylists();

    // populate player context
    await dataMgr.populatePlayerContext();
}

export async function populateSpotifyDevices(isDeviceLaunch = false) {
    const devices = await MusicCommandUtil.getInstance().runSpotifyCommand(
        getSpotifyDevices
    );

    if (devices.status && devices.status === 429 && !isDeviceLaunch) {
        // try one more time in lazily since its not a device launch request.
        // the device launch requests retries a few times every couple seconds.
        setTimeout(() => {
            // use true to specify its a device launch so this doens't try continuously
            populateSpotifyDevices(true);
        }, 8000);
        return;
    }

    const currDevices = MusicDataManager.getInstance().currentDevices;

    const fetchedDeviceIds = [];
    if (devices.length) {
        devices.forEach((el: PlayerDevice) => {
            fetchedDeviceIds.push(el.id);
        });
    }

    let diffDevices = [];
    if (currDevices.length) {
        // get any differences from the fetched devices if any
        diffDevices = currDevices.filter((n: PlayerDevice) => !fetchedDeviceIds.includes(n.id));
    } else if (fetchedDeviceIds.length) {
        // no current devices, set diff to whatever we fetched
        diffDevices = [
            ...devices
        ]
    }

    if (diffDevices.length || currDevices.length !== diffDevices.length) {
        // new devices available or setting to empty
        MusicDataManager.getInstance().currentDevices = devices;

        setTimeout(() => {
            // refresh the playlist to show the device button update
            commands.executeCommand("musictime.refreshPlaylist");
        }, 1000);

        setTimeout(() => {
            MusicStateManager.getInstance().fetchTrack();
        }, 3000);
    }
}
