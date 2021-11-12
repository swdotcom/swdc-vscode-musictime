import { getIntegrations, logIt, syncSlackIntegrations, syncSpotifyIntegration } from "./FileManager";

const { WebClient } = require("@slack/web-api");

export async function updateSpotifyIntegration(user) {
  const existingSpotifyIntegrations = getIntegrations().filter((n) => isActiveIntegration("spotify", n));
  const existingSpotifyIntegration = getLatestSpotifyIntegration(existingSpotifyIntegrations);
  if (user?.integration_connections?.length) {
    const spotifyIntegrations = user.integration_connections.filter(
      (n) => isActiveIntegration("spotify", n)
    );
    if (spotifyIntegrations.length) {
      const spotifyIntegration = getLatestSpotifyIntegration(spotifyIntegrations);
      if (spotifyIntegration) {
        syncSpotifyIntegration(spotifyIntegration);
        if (!existingSpotifyIntegration || existingSpotifyIntegration.authId !== spotifyIntegration.authId) {
          return true;
        }
      }
    }
  }
  return false;
}

function getLatestSpotifyIntegration(spotifyIntegrations) {
  if (spotifyIntegrations?.length) {
    const sorted = spotifyIntegrations.sort((a, b) => {
      const aDate = new Date(a.updatedAt).getTime();
      const bDate = new Date(b.updatedAt).getTime();
      if (aDate > bDate) return 1;
      if (aDate < bDate) return -1;
      return 0;
    });
    return sorted[0];
  }
  return null;
}

export async function updateSlackIntegrations(user) {
  let foundNewIntegration: boolean = false;
  const slackIntegrations = [];
  if (user?.integration_connections?.length) {
    const currentIntegrations = getIntegrations();
    for (const integration of user.integration_connections) {
      const isSlackIntegration = isActiveIntegration("slack", integration);
      if (isSlackIntegration) {
        const currentIntegration = currentIntegrations?.find((n) => n.authId === integration.authId);
        if (!currentIntegration || !currentIntegration.team_domain) {
          // get the workspace domain using the authId
          const web = new WebClient(integration.access_token);
          const usersIdentify = await web.users.identity().catch((e) => {
            logIt("Error fetching slack team info: " + e.message);
            return null;
          });
          if (usersIdentify) {
            // usersIdentity returns
            // {team: {id, name, domain, image_102, image_132, ....}...}
            // set the domain
            integration["team_domain"] = usersIdentify.team?.domain;
            integration["team_name"] = usersIdentify.team?.name;
            integration["integration_id"] = usersIdentify.user?.id;
            // add it
            currentIntegrations.push(integration);

            foundNewIntegration = true;
            slackIntegrations.push(integration);
          }
        } else {
          // add the existing one back
          slackIntegrations.push(currentIntegration);
        }
      }
    }
  }
  syncSlackIntegrations(slackIntegrations);
  return foundNewIntegration;
}

export function clearSpotifyIntegrations() {
  syncSpotifyIntegration(null);
}

export function isActiveIntegration(type: string, integration: any) {
  if (integration && integration.status.toLowerCase() === "active" && integration.access_token) {
    if (integration.integration_type) {
      return !!(integration.integration_type.type.toLowerCase() === type.toLowerCase())
    }
    return !!(integration.name.toLowerCase() === type.toLowerCase())
  }
  return false;
}
