import { getIntegrations, syncSlackIntegrations, syncSpotifyIntegration } from "./FileManager";
import { getSlackWorkspaces } from './SlackManager';

const { WebClient } = require("@slack/web-api");

export async function updateSpotifyIntegration(user) {
  const existingSpotifyIntegrations = getIntegrations().filter(n => n.name.toLowerCase() === "spotify");
  const existingSpotifyIntegration = existingSpotifyIntegrations.length ? existingSpotifyIntegrations[existingSpotifyIntegrations.length - 1] : null;
  if (user?.integrations?.length) {
    const spotifyIntegrations = user.integrations.filter(n => n.name.toLowerCase() === "spotify" && n.status.toLowerCase() === "active" && n.access_token);
    if (spotifyIntegrations.length) {
      const spotifyIntegration = spotifyIntegrations[spotifyIntegrations.length - 1];
      syncSpotifyIntegration(spotifyIntegration);
      return !!(!existingSpotifyIntegration || existingSpotifyIntegration.authId !== spotifyIntegration.authId);
    }
  }
  return false;
}

export async function updateSlackIntegrations(user) {
  let foundNewIntegration: boolean = false;
  const slackIntegrations = [];
  const currentSlackIntegrations = getSlackWorkspaces();
  for (const integration of user.integrations) {
    const isActive = !!(integration.name.toLowerCase() === "slack" && integration.status.toLowerCase() === "active" && integration.access_token);
    const isFound = currentSlackIntegrations?.length ? currentSlackIntegrations.find((n) => n.authId === integration.authId) : null;
    // {access_token, name, plugin_uuid, scopes, pluginId, authId, refresh_token, scopes}
    if (isActive) {
      // get the team domain and name if this is a slack integration
      if (!isFound) {
        // get the workspace domain using the authId
        const web = new WebClient(integration.access_token);
        try {
          const usersIdentify = await web.users.identity().catch((e) => {
            console.log("error fetching slack team info: ", e.message);
            return null;
          });
          if (usersIdentify) {
            // usersIdentity returns
            // {team: {id, name, domain, image_102, image_132, ....}...}
            // set the domain
            integration["team_domain"] = usersIdentify?.team?.domain;
            integration["team_name"] = usersIdentify?.team?.name;
            // its a new integration
            foundNewIntegration = true;
          }
        } catch (e) {
          console.log("error fetching slack team info: ", e.message);
        }
      }
      slackIntegrations.push(integration);
    }
  }
  syncSlackIntegrations(slackIntegrations);

  return foundNewIntegration;
}

export function clearSpotifyIntegrations() {
  syncSpotifyIntegration(null);
}
