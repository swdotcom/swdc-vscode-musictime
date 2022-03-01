import { app_endpoint } from "../Constants";
import { launchWebUrl } from "../Util";
import { showQuickPick } from "../MenuManager";
import { commands, window } from "vscode";
import { getItem, logIt } from "./FileManager";
import { getCachedSlackIntegrations } from './UserStatusManager';

const { WebClient } = require("@slack/web-api");

export async function connectSlackWorkspace() {
  const registered = await checkRegistration();
  if (!registered) {
    return;
  }

  const url = `${app_endpoint}/data_sources/integration_types/slack`;

  // authorize the user for slack
  launchWebUrl(url);
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
export async function getSlackWorkspaces() {
  return await getCachedSlackIntegrations();
}

export async function hasSlackWorkspaces() {
  return !!(await getSlackWorkspaces()).length;
}

// get the access token of a selected slack workspace
export async function getSlackAccessToken() {
  const selectedTeamDomain = await showSlackWorkspaceSelection();

  if (selectedTeamDomain) {
    return await getWorkspaceAccessToken(selectedTeamDomain);
  }
  return null;
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

  const integrations = await getSlackWorkspaces();
  integrations.forEach((integration) => {
    if (integration.team_domain) {
      menuOptions.items.push({
        label: integration.team_domain,
        value: integration.team_domain,
      });
    } else if (integration.meta) {
      menuOptions.items.push({
        label: JSON.parse(integration.meta).team.name,
        value: JSON.parse(integration.meta).team.name,
      });
    }
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

async function getWorkspaceAccessToken(team_domain) {
  const integration = (await getSlackWorkspaces()).find((n) => {
    if (n.team_domain && n.team_domain === team_domain) {
      return n;
    } else if (n.meta && JSON.parse(n.meta).team.name === team_domain) {
      return n;
    }
  });
  if (integration) {
    return integration.access_token;
  }
  return null;
}

async function showSlackWorkspacesToDisconnect() {
  const workspaces = await getSlackWorkspaces();
  const items = workspaces.map((n) => {
    if (n.meta) {
      return { label: JSON.parse(n.meta).team.name, value: n.auth_id };
    } else {
      return { label: n.team_domain, value: n.authId };
    }
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
