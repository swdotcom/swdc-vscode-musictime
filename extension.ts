// Copyright (c) 2018 Software. All Rights Reserved.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext } from "vscode";
import { onboardPlugin } from "./lib/OnboardManager";
import {
    nowInSecs,
    getOffsetSecends,
    getVersion,
    logIt,
    getPluginName,
    codeTimeExtInstalled,
    displayReadmeIfNotExists
} from "./lib/Util";
import { manageLiveshareSession } from "./lib/LiveshareManager";
import * as vsls from "vsls/vscode";
import { MusicStateManager } from "./lib/music/MusicStateManager";
import { createCommands } from "./lib/command-helper";
import { setSessionSummaryLiveshareMinutes } from "./lib/OfflineManager";
import { MusicManager } from "./lib/music/MusicManager";
import { KpmController } from "./lib/KpmController";

let TELEMETRY_ON = true;
let _ls = null;

let token_check_interval = null;
let liveshare_update_interval = null;
let historical_commits_interval = null;
let gather_music_interval = null;
let offline_data_interval = null;
let session_check_interval = null;

export function isTelemetryOn() {
    return TELEMETRY_ON;
}

export function deactivate(ctx: ExtensionContext) {
    if (_ls && _ls.id) {
        // the IDE is closing, send this off
        let nowSec = nowInSecs();
        let offsetSec = getOffsetSecends();
        let localNow = nowSec - offsetSec;
        // close the session on our end
        _ls["end"] = nowSec;
        _ls["local_end"] = localNow;
        manageLiveshareSession(_ls);
        _ls = null;
    }

    clearInterval(token_check_interval);
    clearInterval(liveshare_update_interval);
    clearInterval(historical_commits_interval);
    clearInterval(offline_data_interval);
    clearInterval(gather_music_interval);
    clearInterval(session_check_interval);

    // softwareDelete(`/integrations/${PLUGIN_ID}`, getItem("jwt")).then(resp => {
    //     if (isResponseOk(resp)) {
    //         if (resp.data) {
    //             console.log(`Uninstalled plugin`);
    //         } else {
    //             console.log(
    //                 "Failed to update Code Time about the uninstall event"
    //             );
    //         }
    //     }
    // });
}

export async function activate(ctx: ExtensionContext) {
    // has a session file, continue with initialization of the plugin
    onboardPlugin(ctx, intializePlugin);
}

export async function intializePlugin(ctx: ExtensionContext) {
    logIt(`Loaded ${getPluginName()} v${getVersion()}`);

    //
    // add the player commands before we show the playlist
    //
    ctx.subscriptions.push(createCommands());

    // init the music manager and cody config
    const musicMgr: MusicManager = MusicManager.getInstance();

    // This will initialize the user and spotify
    // this needs to happen first to enable spotify playlist and control logic
    await musicMgr.initializeSpotify();

    // check if the user has a slack integration already connected
    await musicMgr.initializeSlack();

    // every half hour, send offline data
    const hourly_interval_ms = 1000 * 60 * 60;
    const half_hour_ms = hourly_interval_ms / 2;
    offline_data_interval = setInterval(() => {
        if (!codeTimeExtInstalled()) {
            // send the offline code time data
            KpmController.getInstance().processOfflineKeystrokes();
        }

        // send the offline song sessions
        setTimeout(() => {
            MusicStateManager.getInstance().processOfflineSongSessions();
        }, 1000 * 60);
    }, half_hour_ms);

    // send any offline data in a few seconds, then fire off the
    // track listening timer
    setTimeout(async () => {
        // see if there are offline song sessions to send
        await MusicStateManager.getInstance().processOfflineSongSessions();
    }, 1000 * 3);

    // 5 second interval to check music info
    gather_music_interval = setInterval(() => {
        MusicStateManager.getInstance().gatherMusicInfo();
    }, 1000 * 5);

    // show the readme if it doesn't exist
    displayReadmeIfNotExists();

    initializeLiveshare();
}

function updateLiveshareTime() {
    if (_ls) {
        let nowSec = nowInSecs();
        let diffSeconds = nowSec - parseInt(_ls["start"], 10);
        setSessionSummaryLiveshareMinutes(diffSeconds * 60);
    }
}

async function initializeLiveshare() {
    const liveshare = await vsls.getApi();
    if (liveshare) {
        // {access: number, id: string, peerNumber: number, role: number, user: json}
        logIt(`liveshare version - ${liveshare["apiVersion"]}`);
        liveshare.onDidChangeSession(async event => {
            let nowSec = nowInSecs();
            let offsetSec = getOffsetSecends();
            let localNow = nowSec - offsetSec;
            if (!_ls) {
                _ls = {
                    ...event.session
                };
                _ls["apiVesion"] = liveshare["apiVersion"];
                _ls["start"] = nowSec;
                _ls["local_start"] = localNow;
                _ls["end"] = 0;

                await manageLiveshareSession(_ls);
            } else if (_ls && (!event || !event["id"])) {
                updateLiveshareTime();
                // close the session on our end
                _ls["end"] = nowSec;
                _ls["local_end"] = localNow;
                await manageLiveshareSession(_ls);
                _ls = null;
            }
        });
    }
}
