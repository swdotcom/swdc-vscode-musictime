import SoftwareIntegration from "../model/SoftwareIntegration";
import { getIntegrations, syncIntegrations } from "./FileManager";

const { WebClient } = require("@slack/web-api");

export async function updateSlackIntegrations(user) {
  if (user && user.integrations) {
    return await updateIntegrations(user, "slack");
  }
  return false;
}

export async function updateSpotifyIntegrations(user) {
  if (user && user.integrations) {
    return await updateIntegrations(user, "spotify");
  }
  return false;
}

async function updateIntegrations(user, name) {
  let foundNewIntegration: boolean = false;
  let currentIntegrations = getIntegrations();
  for (const integration of user.integrations) {
    const isActive = !!(integration.name.toLowerCase() === name && integration.status.toLowerCase() === "active" && integration.access_token);
    const isFound = currentIntegrations?.length ? currentIntegrations.find((n) => n.authId === integration.authId) : null;
    // {access_token, name, plugin_uuid, scopes, pluginId, authId, refresh_token, scopes}
    if (isActive && !isFound) {
      // get the team domain and name if this is a slack integration
      if (integration.name.toLowerCase() === "slack") {
        // get the workspace domain using the authId
        const web = new WebClient(integration.access_token);
        const usersIdentify = await web.users.identity((e) => {
          console.log("error fetching slack team info: ", e.message);
          return null;
        });
        // usersIdentity returns
        // {team: {id, name, domain, image_102, image_132, ....}...}
        // set the domain
        integration["team_domain"] = usersIdentify?.team?.domain;
        integration["team_name"] = usersIdentify?.team?.name;
      }
      // add it
      currentIntegrations.push(integration);

      foundNewIntegration = true;
    }
  }
  if (foundNewIntegration) {
    syncIntegrations(currentIntegrations);
  }

  return foundNewIntegration;
}

export function clearSpotifyIntegrations() {
  const newIntegrations: SoftwareIntegration[] = getIntegrations().filter((n) => n.name.toLowerCase() !== "spotify");
  syncIntegrations(newIntegrations);
}
