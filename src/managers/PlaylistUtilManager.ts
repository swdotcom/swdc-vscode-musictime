import { getSpotifyIntegration } from './SpotifyManager';

export function requiresSpotifyAccess() {
  const spotifyIntegration = getSpotifyIntegration();
  // no spotify access token then return true, the user requires spotify access
  return !spotifyIntegration ? true : false;
}
