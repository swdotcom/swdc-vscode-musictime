import { commands, window } from "vscode";
import { setAuthCallbackState } from "../Util";
import { getUser, processNewSpotifyIntegration } from "../managers/UserStatusManager";

export async function handleIntegrationConnectionSocketEvent(body: any) {
  // integration_type_id = 14 (slack), 12 (spotify)
  // action = add, update, remove
  const { integration_type_id, integration_type, action } = body;

  await getUser();

  if (integration_type_id === 14) {

    if (action === "add") {
      // clear the auth callback state
      setAuthCallbackState(null);
      window.showInformationMessage("Successfully connected to Slack");

      // refresh the tree view
      setTimeout(() => {
        // refresh the playlist to show the device button update
        commands.executeCommand("musictime.reloadMusicTimeView");
      }, 1000);
    }

  } else if (integration_type_id === 12) {
    // clear the auth callback state
    setAuthCallbackState(null);

    processNewSpotifyIntegration();
  }
}
