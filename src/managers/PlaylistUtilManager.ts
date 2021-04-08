import { MusicCommandManager } from '../music/MusicCommandManager';
import { populateSpotifyDevices } from './PlaylistDataManager';
import { getSpotifyIntegration, populateSpotifyUser, updateCodyConfig, updateSpotifyClientInfo } from './SpotifyManager';

export function requiresSpotifyAccess() {
  const spotifyIntegration = getSpotifyIntegration();
  // no spotify access token then return true, the user requires spotify access
  return !spotifyIntegration ? true : false;
}

export async function initializeSpotify(refreshUser = false) {
  // get the client id and secret
  await updateSpotifyClientInfo();

  // update cody music with all access info
  updateCodyConfig();

  // first get the spotify user
  await populateSpotifyUser(refreshUser);

  await populateSpotifyDevices(false);

  // initialize the status bar music controls
  MusicCommandManager.initialize();
}
