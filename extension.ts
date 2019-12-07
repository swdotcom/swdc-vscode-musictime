// Copyright (c) 2018 Software. All Rights Reserved.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext, window } from "vscode";
import {
    getUserStatus,
    sendHeartbeat,
    serverIsAvailable,
    isLoggedOn
} from "./lib/DataController";
import {
    nowInSecs,
    getOffsetSecends,
    getVersion,
    logIt,
    getPluginName
} from "./lib/Util";
import { manageLiveshareSession } from "./lib/LiveshareManager";
import * as vsls from "vsls/vscode";
import { MusicStateManager } from "./lib/music/MusicStateManager";
import { MusicCommandManager } from "./lib/music/MusicCommandManager";
import { createCommands } from "./lib/command-helper";
import { setSessionSummaryLiveshareMinutes } from "./lib/OfflineManager";
import { MusicManager } from "./lib/music/MusicManager";

let TELEMETRY_ON = true;
let statusBarItem = null;
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

export function getStatusBarItem() {
    return statusBarItem;
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
    intializePlugin(ctx);
}

export async function intializePlugin(ctx: ExtensionContext) {
    logIt(`Loaded ${getPluginName()} v${getVersion()}`);

    let serverIsOnline = await serverIsAvailable();

    //
    // add the player commands before we show the playlist
    //
    ctx.subscriptions.push(createCommands());

    // check if we're already logged on
    await isLoggedOn(serverIsOnline);

    // initialize the music player
    setTimeout(() => {
        MusicCommandManager.initialize();
    }, 1000);

    let musicMgr: MusicManager = null;

    // init the music manager and cody config
    musicMgr = MusicManager.getInstance();
    musicMgr.updateCodyConfig();
    // this needs to happen first to enable spotify playlist and control logic
    await musicMgr.initializeSpotify();
    // check if the user has a slack integration already connected
    await musicMgr.initializeSlack();

    // 5 second interval to check music info
    gather_music_interval = setInterval(() => {
        MusicStateManager.getInstance().gatherMusicInfo();
    }, 1000 * 5);

    initializeLiveshare();
    initializeUserInfo(serverIsOnline);
}

async function initializeUserInfo(serverIsOnline: boolean) {
    // {loggedIn: true|false}
    await getUserStatus(serverIsOnline);

    // send a heartbeat
    sendHeartbeat("INITIALIZED", serverIsOnline);
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
