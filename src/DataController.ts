
import { commands, Uri, ViewColumn } from 'vscode';
import { getItem, getLocalREADMEFile, setItem } from './managers/FileManager';

export function displayReadmeIfNotExists(override = false) {
    const vscode_musictime_initialized = getItem("displayedMtReadme");

    if (!vscode_musictime_initialized || override) {
      setTimeout(() => {
        commands.executeCommand("musictime.displaySidebar");
      }, 1000);

      const readmeUri = Uri.file(getLocalREADMEFile());

      commands.executeCommand("markdown.showPreview", readmeUri, ViewColumn.One);
      setItem("displayedMtReadme", true);
    }
  }
