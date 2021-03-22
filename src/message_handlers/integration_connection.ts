

import { commands, window } from "vscode";
import { getItem, setAuthCallbackState, setItem } from '../managers/FileManager';
import { clearSpotifyIntegrations, updateSlackIntegrations, updateSpotifyIntegrations } from '../managers/IntegrationManager';
import { getSlackAuth } from "../managers/SlackManager";
import { getUser } from '../managers/UserStatusManager';
import { MusicManager } from '../music/MusicManager';

export async function handleIntegrationConnectionSocketEvent(body: any) {
  // integration_type_id = 14 (slack), 12 (spotify)
  // action = add, update, remove
  const { integration_type_id, integration_type, action } = body;

  const user = await getUser(getItem("jwt"));

  if (integration_type_id === 14) {
    await getSlackAuth();

    if (action === "add") {
	  // clear the auth callback state
	  setAuthCallbackState(null);
	  window.showInformationMessage("Successfully connected to Slack");

	  // refresh the tree view
	  setTimeout(() => {
		// refresh the playlist to show the device button update
		commands.executeCommand("musictime.refreshPlaylist");
	  }, 1000);
	}
  } else if (integration_type_id === 12) {
	  // clear the auth callback state
	  setAuthCallbackState(null);

	  setItem("requiresSpotifyReAuth", false);

	  // update the login status
	  window.showInformationMessage(`Successfully connected to Spotify. Loading playlists...`);

	  // clear existing spotify integrations
	  clearSpotifyIntegrations();

	  // update the spotify integrations before populating the spotify user
	  await updateSpotifyIntegrations(user);
	  await updateSlackIntegrations(user);

	  // initialize spotify and playlists
	  await MusicManager.getInstance().initializeSpotify(true /*hardRefresh*/);

	  // initiate the playlist build
	  setTimeout(() => {
		commands.executeCommand("musictime.hardRefreshPlaylist");
	  }, 2000);
  }
}
