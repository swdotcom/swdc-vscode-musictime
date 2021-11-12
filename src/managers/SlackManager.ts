import { api_endpoint, DISCONNECT_LABEL } from "../Constants";
import { getPluginId, getPluginType, getVersion, launchWebUrl } from "../Util";
import { showQuickPick } from "../MenuManager";
import { commands, window } from "vscode";
import { softwareDelete } from "../HttpClient";
import { getAuthCallbackState, getIntegrations, getItem, getPluginUuid, logIt, syncSlackIntegrations } from "./FileManager";
import { isActiveIntegration } from './IntegrationManager';

const queryString = require("query-string");
const { WebClient } = require("@slack/web-api");

export async function connectSlackWorkspace() {
  const registered = await checkRegistration();
  if (!registered) {
    return;
  }

  // make sure the user is logged in before connecting slack
  const qryStr = queryString.stringify({
    plugin: getPluginType(),
    plugin_uuid: getPluginUuid(),
    pluginVersion: getVersion(),
    plugin_id: getPluginId(),
    auth_callback_state: getAuthCallbackState(),
    integrate: "slack",
    plugin_token: getItem("jwt"),
  });

  const url = `${api_endpoint}/auth/slack?${qryStr}`;

  // authorize the user for slack
  launchWebUrl(url);
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
    let msg = "";
    if (selectedItem === "all") {
      msg = "Are you sure you would like to disconnect all Slack workspaces?";
    } else {
      msg = `Are you sure you would like to disconnect this Slack workspace?`;
    }

    // ask before disconnecting
    const selection = await window.showInformationMessage(msg, ...[DISCONNECT_LABEL]);

    if (selection === DISCONNECT_LABEL) {
      if (selectedItem === "all") {
        for await (const workspace of workspaces) {
          await softwareDelete(`/integrations/${workspace.id}`);
          removeSlackIntegration(workspace.authId);
        }
        window.showInformationMessage("Disconnected selected Slack integrations");
      } else {
        await softwareDelete(`/integrations/${selectedItem}`);
        removeSlackIntegration(selectedItem);
        window.showInformationMessage("Disconnected selected Slack integration");
      }

      // refresh the tree view
      setTimeout(() => {
        // refresh the playlist to show the device button update
        commands.executeCommand("musictime.refreshMusicTimeView");
      }, 1000);
    }
  }
}

// disconnect slack flow
export async function disconnectSlackAuth(authId) {
  // get the domain
  const integration = getSlackWorkspaces().find((n) => n.authId === authId);
  if (!integration) {
    window.showErrorMessage("Unable to find selected integration to disconnect");
    return;
  }
  // ask before disconnecting
  const selection = await window.showInformationMessage(
    `Are you sure you would like to disconnect the '${integration.team_domain}' Slack workspace?`,
    ...[DISCONNECT_LABEL]
  );

  if (selection === DISCONNECT_LABEL) {
    await softwareDelete(`/integrations/${integration.id}`);
    // disconnected, remove it from the integrations
    removeSlackIntegration(authId);

    commands.executeCommand("musictime.refreshMusicTimeView");
  }
}

export async function showSlackChannelMenu() {
  let menuOptions = {
    items: [],
    placeholder: "Select a channel",
  };

  // get the available channels
  let { channels, access_token } = await getChannels();
  channels.sort(compareLabels);

  // make sure the object array has labels
  channels = channels.map((n) => {
    return { ...n, label: n.name };
  });

  menuOptions.items = channels;

  const pick = await showQuickPick(menuOptions);
  if (pick && pick.label) {
    return { selectedChannel: pick.id, access_token };
  }
  return { selectedChannel: null, access_token };
}

// get saved slack integrations
export function getSlackWorkspaces() {
  return getIntegrations().filter((n) => isActiveIntegration("slack", n));
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
  syncSlackIntegrations(newIntegrations);
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
  const result = await web.conversations.list({ exclude_archived: true, limit: 1000 }).catch((err) => {
    logIt("Unable to retrieve slack channels: " + err.message);
    return [];
  });
  if (result && result.ok) {
    /**
    created:1493157509
    creator:'U54G1N6LC'
    id:'C53QCUUKS'
    is_archived:false
    is_channel:true
    is_ext_shared:false
    is_general:true
    is_group:false
    is_im:false
    is_member:true
    is_mpim:false
    is_org_shared:false
    is_pending_ext_shared:false
    is_private:false
    is_shared:false
    name:'company-announcements'
    name_normalized:'company-announcements'
    num_members:20
    */
    return { channels: result.channels, access_token };
  }
  return { channels: [], access_token: null };
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
      value: integration.team_domain,
    });
  });

  menuOptions.items.push({
    label: "Connect a Slack workspace",
    command: "musictime.connectSlack",
  });

  const pick = await showQuickPick(menuOptions);
  if (pick) {
    if (pick.value) {
      return pick.value;
    } else if (pick.command) {
      commands.executeCommand(pick.command);
      return null;
    }
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

async function checkRegistration(showSignup = true) {
  if (!getItem("name")) {
    if (showSignup) {
      window
        .showInformationMessage(
          "Connecting Slack requires a registered account. Sign up or register for a web.com account at Software.com.",
          {
            modal: true,
          },
          "Sign up"
        )
        .then(async (selection) => {
          if (selection === "Sign up") {
            commands.executeCommand("musictime.signUpAccount");
          }
        });
    }
    return false;
  }
  return true;
}

function compareLabels(a, b) {
  if (a.name > b.name) return 1;
  if (b.name > a.name) return -1;

  return 0;
}
