import { window } from "vscode";
import { searchTracks } from "cody-music";
import { populateRecommendationTracks, requiresSpotifyAccess } from "../managers/PlaylistDataManager";

export async function showSearchInput() {
  if (requiresSpotifyAccess()) {
    window.showInformationMessage("Spotify connection required");
    return;
  }
  let keywords = await window.showInputBox({
    value: "",
    placeHolder: "Search",
    prompt: "Search for songs",
    validateInput: (text) => {
      return !text ? "Please enter one more more keywords to continue." : null;
    },
  });
  if (!keywords) {
    return;
  }

  keywords = keywords.trim();
  // the default limit is 50, so just send in the keywords
  const result = await searchTracks(keywords, 50 /*limit*/);

  if (result && result.tracks && result.tracks.items && result.tracks.items.length) {
    populateRecommendationTracks(keywords, result.tracks.items);
  } else {
    window.showErrorMessage(`No songs found matching '${keywords}'`);
  }
}
