import { window, commands } from "vscode";
import { searchTracks } from "cody-music";
import { MusicDataManager } from "../music/MusicDataManager";
import { requiresSpotifyAccess } from "../music/MusicUtil";

export async function showSearchInput() {
    if (requiresSpotifyAccess()) {
        window.showInformationMessage("Spotify connection required");
        return;
    }
    const keywords = await window.showInputBox({
        value: "",
        placeHolder: "Search",
        prompt: "Search for songs",
        validateInput: text => {
            return !text
                ? "Please enter one more more keywords to continue."
                : null;
        }
    });
    if (!keywords) {
        return;
    }
    // the default limit is 50, so just send in the keywords
    const result = await searchTracks(keywords);

    if (
        result &&
        result.tracks &&
        result.tracks.items &&
        result.tracks.items.length
    ) {
        const dataMgr: MusicDataManager = MusicDataManager.getInstance();
        // populate the recommendation section with these results

        // set the manager's recommendation tracks
        dataMgr.recommendationTracks = result.tracks.items;
        dataMgr.recommendationLabel = "Top Results";

        // refresh the rec tree
        commands.executeCommand("musictime.refreshRecommendationsTree");
    } else {
        window.showErrorMessage(`No songs found matching '${keywords}'`);
    }
}
