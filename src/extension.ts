// Copyright (c) 2018 Software. All Rights Reserved.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { commands, ExtensionContext } from "vscode";
import { onboardPlugin } from "./OnboardManager";
import {
  nowInSecs,
  getOffsetSeconds,
  getVersion,
  logIt,
  getPluginName,
  codeTimeExtInstalled,
  displayReadmeIfNotExists,
} from "./Util";
import { manageLiveshareSession } from "./LiveshareManager";
import * as vsls from "vsls/vscode";
import { MusicStateManager } from "./music/MusicStateManager";
import { createCommands } from "./command-helper";
import { setSessionSummaryLiveshareMinutes } from "./OfflineManager";
import { MusicManager } from "./music/MusicManager";
import { DEFAULT_CURRENTLY_PLAYING_TRACK_CHECK_SECONDS } from "./Constants";
import { sendOfflineData } from "./managers/FileManager";
import { TrackerManager } from "./managers/TrackerManager";

let _ls = null;

let liveshare_update_interval = null;
let gather_music_interval = null;
let check_track_end_interval = null;
let offline_data_interval = null;

const tracker: TrackerManager = TrackerManager.getInstance();

export function deactivate(ctx: ExtensionContext) {
  // Process this window's keystroke data since the window has become unfocused/deactivated
  commands.executeCommand("musictime.processKeystrokeData");

  // store the deactivate event
  tracker.trackEditorAction("editor", "deactivate");

  if (_ls && _ls.id) {
    // the IDE is closing, send this off
    let nowSec = nowInSecs();
    let offsetSec = getOffsetSeconds();
    let localNow = nowSec - offsetSec;
    // close the session on our end
    _ls["end"] = nowSec;
    _ls["local_end"] = localNow;
    manageLiveshareSession(_ls);
    _ls = null;
  }

  clearInterval(liveshare_update_interval);
  clearInterval(offline_data_interval);
  clearInterval(gather_music_interval);
  clearInterval(check_track_end_interval);

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

  // every 10 minutes send offline data
  offline_data_interval = setInterval(() => {
    if (!codeTimeExtInstalled()) {
      // send the offline code time data
      sendOfflineData();
    }
  }, 1000 * 60 * 10);

  const musicStateMgr: MusicStateManager = MusicStateManager.getInstance();

  // interval to check music info
  gather_music_interval = setInterval(() => {
    musicStateMgr.gatherMusicInfo();
  }, 1000 * DEFAULT_CURRENTLY_PLAYING_TRACK_CHECK_SECONDS);

  check_track_end_interval = setInterval(() => {
    musicStateMgr.trackEndCheck();
  }, 5000);

  // show the readme if it doesn't exist
  displayReadmeIfNotExists();

  initializeLiveshare();

  // store the activate event
  tracker.init();
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
    liveshare.onDidChangeSession(async (event) => {
      let nowSec = nowInSecs();
      let offsetSec = getOffsetSeconds();
      let localNow = nowSec - offsetSec;
      if (!_ls) {
        _ls = {
          ...event.session,
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
