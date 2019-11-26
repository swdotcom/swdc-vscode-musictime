import { api_endpoint } from "../Constants";
import { getItem, launchWebUrl } from "../Util";
import { refetchSlackConnectStatusLazily } from "../DataController";
const { WebClient } = require("@slack/web-api");
import { showQuickPick } from "../MenuManager";

/**
 * This won't be available until they've connected to spotify
 */
export async function connectSlack() {
    const jwt = getItem("jwt");
    // authorize the user for slack
    const endpoint = `${api_endpoint}/auth/slack?integrate=slack&plugin=musictime&token=${jwt}`;
    launchWebUrl(endpoint);
    refetchSlackConnectStatusLazily();
}

export async function showSlackChannelMenu() {
    let menuOptions = {
        items: [],
        placeholder: "Select a channel"
    };

    // get the available channels
    const channelNames = await getChannelNames();
    channelNames.sort();

    channelNames.forEach(channelName => {
        menuOptions.items.push({
            label: channelName
        });
    });

    const pick = await showQuickPick(menuOptions);
    if (pick && pick.label) {
        return pick.label;
    }
    return null;
}

async function getChannels() {
    const slackAccessToken = getItem("slack_access_token");
    const web = new WebClient(slackAccessToken);
    const result = await web.channels
        .list({ exclude_archived: true, exclude_members: true })
        .catch(err => {
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
        return channels.map(channel => {
            return channel.name;
        });
    }
    return [];
}
