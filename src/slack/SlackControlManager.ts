import { api_endpoint, DISCONNECT_LABEL } from "../Constants";
import {
  getAuthCallbackState,
  getIntegrations,
  getItem,
  getPluginId,
  getPluginType,
  getPluginUuid,
  getVersion,
  launchWebUrl,
  syncIntegrations,
} from "../Util";
import { refetchSlackConnectStatusLazily } from "../DataController";
import { showQuickPick } from "../MenuManager";
import { window } from "vscode";
import { softwarePut } from "../HttpClient";

const queryString = require("query-string");
const { WebClient } = require("@slack/web-api");

export async function connectSlackWorkspace() {
  const qryStr = queryString.stringify({
    plugin: getPluginType(),
    plugin_uuid: getPluginUuid(),
    pluginVersion: getVersion(),
    plugin_id: getPluginId(),
    auth_callback_state: getAuthCallbackState(),
    integrate: "slack",
  });

  const url = `${api_endpoint}/auth/slack?${qryStr}`;

  // authorize the user for slack
  launchWebUrl(url);
  // lazily check if the user has completed the slack authentication
  setTimeout(() => {
    refetchSlackConnectStatusLazily(40);
  }, 10000);
}

export async function disconnectSlack() {
  const workspaces = getSlackWorkspaces();
  if (workspaces.length === 0) {
    window.showErrorMessage("Unable to find Slack integration to disconnect");
    return;
  }

  // show a selection of which one or all workspaces to disconnect
  const selectedItem = await showSlackWorkspacesToDisconnect();
  if (selectedItem) {
    const authId = selectedItem.value;
    const domain = selectedItem.label;
    let msg = "";
    if (authId === "all") {
      msg = "Are you sure you would like to disconnect all Slack workspaces?";
    } else {
      msg = `Are you sure you would like to disconnect the '${domain}' Slack workspace?`;
    }

    // ask before disconnecting
    const selection = await window.showInformationMessage(msg, ...[DISCONNECT_LABEL]);

    if (selection === DISCONNECT_LABEL) {
      if (authId === "all") {
        for await (const workspace of workspaces) {
            await softwarePut(`/auth/slack/disconnect`, { authId: workspace.authId }, getItem("jwt"));
            removeSlackIntegration(workspace.authId);
        }
        window.showInformationMessage("Disconnected selected Slack integrations");
      } else {
        await softwarePut(`/auth/slack/disconnect`, { authId }, getItem("jwt"));
        removeSlackIntegration(authId);
        window.showInformationMessage("Disconnected selected Slack integration");
      }
    }
  }
}

export async function showSlackChannelMenu() {
  let menuOptions = {
    items: [],
    placeholder: "Select a channel",
  };

  // get the available channels
  const channelNames = await getChannelNames();
  channelNames.sort();

  channelNames.forEach((channelName) => {
    menuOptions.items.push({
      label: channelName,
    });
  });

  const pick = await showQuickPick(menuOptions);
  if (pick && pick.label) {
    return pick.label;
  }
  return null;
}

// get saved slack integrations
export function getSlackWorkspaces() {
  return getIntegrations().filter((n) => n.name.toLowerCase() === "slack");
}

export function hasSlackWorkspaces() {
  return !!getSlackWorkspaces().length;
}

// get the access token of a selected slack workspace
export async function getSlackAccessToken() {
  const selectedTeamDomain = await showSlackWorkspaceSelection();

  if (selectedTeamDomain) {
    return getWorkspaceAccessToken(selectedTeamDomain);
  }
  return null;
}

/**
 * Remove an integration from the local copy
 * @param authId
 */
export function removeSlackIntegration(authId) {
  const currentIntegrations = getIntegrations();

  const newIntegrations = currentIntegrations.filter((n) => n.authId !== authId);
  syncIntegrations(newIntegrations);
}

//////////////////////////
// PRIVATE FUNCTIONS
//////////////////////////

async function getChannels() {
  const access_token = await getSlackAccessToken();
  if (!access_token) {
    return;
  }
  const web = new WebClient(access_token);
  const result = await web.conversations.list({ exclude_archived: true }).catch((err) => {
    console.log("Unable to retrieve slack channels: ", err.message);
    return [];
  });
  if (result && result.ok) {
    return result.channels;
  }
  return [];
}

async function getChannelNames() {
  const channels = await getChannels();
  if (channels && channels.length > 0) {
    return channels.map((channel) => {
      return channel.name;
    });
  }
  return [];
}

async function showSlackWorkspaceSelection() {
  let menuOptions = {
    items: [],
    placeholder: `Select a Slack workspace`,
  };

  const integrations = getSlackWorkspaces();
  integrations.forEach((integration) => {
    menuOptions.items.push({
      label: integration.team_domain,
    });
  });

  menuOptions.items.push({
    label: "Connect a Slack workspace",
  });

  const pick = await showQuickPick(menuOptions);
  if (pick && pick.label) {
    return pick.label;
  }
  return null;
}

function getWorkspaceAccessToken(team_domain) {
  const integration = getSlackWorkspaces().find((n) => n.team_domain === team_domain);
  if (integration) {
    return integration.access_token;
  }
  return null;
}

async function showSlackWorkspacesToDisconnect() {
  const workspaces = getSlackWorkspaces();
  const items = workspaces.map((n) => {
    return { label: n.team_domain, value: n.authId };
  });
  items.push({ label: "all", value: "all" });
  let menuOptions = {
    items,
    placeholder: "Select a workspace to disconnect",
  };

  const pick = await showQuickPick(menuOptions);
  if (pick && pick.label) {
    return pick.value;
  }
  return null;
}
