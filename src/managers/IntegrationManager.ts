import { getIntegrations, syncSlackIntegrations, syncSpotifyIntegration } from "./FileManager";

const { WebClient } = require("@slack/web-api");

export async function updateSpotifyIntegration(user) {
  const existingSpotifyIntegrations = getIntegrations().filter((n) => n.name.toLowerCase() === "spotify");
  const existingSpotifyIntegration = getLatestSpotifyIntegration(existingSpotifyIntegrations);
  if (user?.integrations?.length) {
    const spotifyIntegrations = user.integrations.filter(
      (n) => n.name.toLowerCase() === "spotify" && n.status.toLowerCase() === "active" && n.access_token
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
  if (user && user.integrations) {
    const currentIntegrations = getIntegrations();
    for (const integration of user.integrations) {
      const isSlackIntegration = !!(
        integration.name.toLowerCase() === "slack" &&
        integration.status.toLowerCase() === "active" &&
        integration.access_token
      );
      if (isSlackIntegration) {
        const currentIntegration = currentIntegrations?.find((n) => n.authId === integration.authId);
        if (!currentIntegration || !currentIntegration.team_domain) {
          // get the workspace domain using the authId
          const web = new WebClient(integration.access_token);
          const usersIdentify = await web.users.identity().catch((e) => {
            console.log("Error fetching slack team info: ", e.message);
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
