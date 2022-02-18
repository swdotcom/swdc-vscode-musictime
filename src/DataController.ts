
import { commands, Uri, ViewColumn } from 'vscode';
import { softwareGet, isResponseOk, softwarePost } from "./HttpClient";
import { getItem, getLocalREADMEFile, setItem } from './managers/FileManager';

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

export function displayReadmeIfNotExists(override = false) {
    const vscode_musictime_initialized = getItem("displayedMtReadme");
    if (!vscode_musictime_initialized) {
      // activate the plugin
      softwarePost("/plugins/activate", {});
    }

    if (!vscode_musictime_initialized || override) {
      setTimeout(() => {
        commands.executeCommand("musictime.displaySidebar");
      }, 1000);

      const readmeUri = Uri.file(getLocalREADMEFile());

      commands.executeCommand("markdown.showPreview", readmeUri, ViewColumn.One);
      setItem("displayedMtReadme", true);
    }
  }
