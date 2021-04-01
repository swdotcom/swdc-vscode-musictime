// Copyright (c) 2018 Software. All Rights Reserved.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { commands, ExtensionContext, window } from "vscode";
import { onboardPlugin } from "./OnboardManager";
import {
  getVersion,
  getPluginName,
} from "./Util";
import { createCommands } from "./command-helper";
import { MusicManager } from "./music/MusicManager";
import { TrackerManager } from "./managers/TrackerManager";
import { displayReadmeIfNotExists } from "./managers/FileManager";
import { migrateAccessInfo } from "./managers/SpotifyManager";
import { clearWebsocketConnectionRetryTimeout, initializeWebsockets } from './websockets';

let currentColorKind: number = undefined;

export function deactivate(ctx: ExtensionContext) {

  clearWebsocketConnectionRetryTimeout();

  // store the deactivate event
  TrackerManager.getInstance().trackEditorAction("editor", "deactivate");
}

export async function activate(ctx: ExtensionContext) {
  // has a session file, continue with initialization of the plugin
  onboardPlugin(ctx, intializePlugin);
}

export async function intializePlugin(ctx: ExtensionContext) {
  console.log(`Loaded ${getPluginName()} v${getVersion()}`);

  //
  // add the player commands before we show the playlist
  //
  ctx.subscriptions.push(createCommands(ctx));

  // migrate legacy spotify access token info to integration info
  await migrateAccessInfo();

  // show the readme if it doesn't exist
  displayReadmeIfNotExists();

  // This will initialize the user and spotify
  // this needs to happen first to enable spotify playlist and control logic
  await MusicManager.getInstance().initializeSpotify();

  // store the activate event
  TrackerManager.getInstance().init();

  try {
    initializeWebsockets();
  } catch (e) {
    console.error("Failed to initialize websockets", e);
  }
}

export function getCurrentColorKind() {
  if (!currentColorKind) {
    currentColorKind = window.activeColorTheme.kind;
  }
  return currentColorKind;
}

/**
 * Active color theme listener
 */
 function activateColorKindChangeListener() {
  currentColorKind = window.activeColorTheme.kind;

  window.onDidChangeActiveColorTheme((event) => {
    let kindChanged = false;
    if (event.kind !== currentColorKind) {
      kindChanged = true;
    }

    currentColorKind = event.kind;

    // let the sidebar know the new current color kind
    setTimeout(() => {
      commands.executeCommand("musictime.refreshMusicTimeView");
    }, 250);
  });
}
