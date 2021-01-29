import {
    PlayerType,
    PlaylistItem,
    PlaylistTrackInfo,
    PlayerDevice,
    PlayerName,
    Track,
} from "cody-music";
import {
    SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
    PERSONAL_TOP_SONGS_PLID,
    GENERATE_CUSTOM_PLAYLIST_TITLE,
    REFRESH_CUSTOM_PLAYLIST_TITLE,
    GENERATE_CUSTOM_PLAYLIST_TOOLTIP,
    REFRESH_CUSTOM_PLAYLIST_TOOLTIP,
} from "../Constants";
import {
    requiresSpotifyAccess,
    getDeviceSet,
    requiresSpotifyReAuthentication,
} from "./MusicUtil";
import { MusicDataManager } from "./MusicDataManager";
import { MusicManager } from "./MusicManager";
import { isMac } from "../Util";
import { KpmItem } from "../model/models";
import { getSlackWorkspaces } from "../managers/SlackManager";
import { getItem } from "../managers/FileManager";

export class ProviderItemManager {
  private static instance: ProviderItemManager;

  private constructor() {
    //
  }
  static getInstance(): ProviderItemManager {
    if (!ProviderItemManager.instance) {
      ProviderItemManager.instance = new ProviderItemManager();
    }

    return ProviderItemManager.instance;
  }

  getSpotifyLikedPlaylistFolder() {
    const item: PlaylistItem = new PlaylistItem();
    item.type = "playlist";
    item.id = SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
    item.tracks = new PlaylistTrackInfo();
    // set set a number so it shows up
    item.tracks.total = 1;
    item.playerType = PlayerType.WebSpotify;
    item.tag = "spotify-liked-songs";
    item.itemType = "playlist";
    item.name = SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
    item["icon"] = "heart-filled.svg";
    return item;
  }

  async getActiveSpotifyDevicesButton() {
    const dataMgr: MusicDataManager = MusicDataManager.getInstance();

    const { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice } = getDeviceSet();

    const devices: PlayerDevice[] = dataMgr.currentDevices;

    let msg = "";
    let tooltip = "Listening on a Spotify device";
    if (activeDevice) {
      // found an active device
      msg = `Listening on ${activeDevice.name}`;
    } else if (isMac() && desktop) {
      // show that the desktop player is an active device
      msg = `Listening on ${desktop.name}`;
    } else if (webPlayer) {
      // show that the web player is an active device
      msg = `Listening on ${webPlayer.name}`;
    } else if (desktop) {
      // show that the desktop player is an active device
      msg = `Listening on ${desktop.name}`;
    } else if (devices.length) {
      // no active device but found devices
      const names = devices.map((d: PlayerDevice) => d.name);
      msg = `Spotify devices available`;
      tooltip = `Multiple devices available: ${names.join(", ")}`;
    } else if (devices.length === 0) {
      // no active device and no devices
      msg = "Connect to a Spotify device";
      tooltip = "Click to launch the web or desktop player";
    }

    return this.createSpotifyDevicesButton(msg, tooltip, true, "musictime.deviceSelector");
  }

  getSpotifyPremiumAccountRequiredButton() {
    return this.buildActionItem(
      "spotifypremium",
      "action",
      "musictime.switchSpotifyAccount",
      PlayerType.NotAssigned,
      "Spotify Free",
      "Connect to your premium Spotify account to enable web playback controls",
      null,
      null,
      "generate.svg"
    );
  }

  getItunesConnectedButton() {
    return this.buildActionItem("itunesconnected", "connected", null, PlayerType.MacItunesDesktop, "iTunes Connected", "You've connected iTunes");
  }

  getLoadingButton() {
    return this.buildActionItem("loading", "action", null, PlayerType.NotAssigned, "Loading...", "please wait", null, "action", "audio.svg");
  }

  getConnectToSpotifyButton() {
    const requiresReAuth = requiresSpotifyReAuthentication();
    const action = requiresReAuth ? "Reconnect" : "Connect";
    return this.buildActionItem(
      "connectspotify",
      "spotify",
      "musictime.connectSpotify",
      PlayerType.WebSpotify,
      `${action} Spotify`,
      "Connect Spotify to view your playlists"
    );
  }

  getRecommendationConnectToSpotifyButton() {
    // Connect Spotify to see recommendations
    const requiresReAuth = requiresSpotifyReAuthentication();
    const action = requiresReAuth ? "Reconnect" : "Connect";
    return this.buildActionItem(
      "connectspotify",
      "spotify",
      "musictime.connectSpotify",
      PlayerType.WebSpotify,
      `${action} Spotify to see recommendations`,
      "Connect Spotify to see your playlist and track recommendations"
    );
  }

  getSwitchToSpotifyButton() {
    return this.buildActionItem("title", "spotify", "musictime.launchSpotifyDesktop", PlayerType.WebSpotify, "Launch Spotify");
  }

  getSwitchToItunesButton() {
    return this.buildActionItem("title", "itunes", "musictime.launchItunes", PlayerType.MacItunesDesktop, "Launch iTunes");
  }

  // readme button
  getReadmeButton() {
    return this.buildActionItem(
      "title",
      "action",
      "musictime.displayReadme",
      null,
      "Documentation",
      "View the Music Time Readme to learn more",
      "",
      null,
      "readme.svg"
    );
  }

  getLoggedInButton() {
    const connectedToInfo = this.getAuthTypeIconAndLabel();
    return this.buildActionItem("title", "action", null, null, connectedToInfo.label, connectedToInfo.tooltip, "", null, connectedToInfo.icon);
  }

  getAuthTypeIconAndLabel() {
    const authType = getItem("authType");
    const name = getItem("name");
    let tooltip = name ? `Connected as ${name}` : "";
    if (authType === "google") {
      return {
        icon: "google.svg",
        label: name,
        tooltip,
      };
    } else if (authType === "github") {
      return {
        icon: "github.svg",
        label: name,
        tooltip,
      };
    }
    return {
      icon: "email.svg",
      label: name,
      tooltip,
    };
  }

  getSignupButton() {
    return this.buildActionItem("title", "action", "musictime.signUpAccount", null, "Sign up", "Sign up to see more data visualizations.", "", null, "paw.svg");
  }

  getLoginButton() {
    return this.buildActionItem("title", "action", "musictime.logInAccount", null, "Log in", "Log in to see more data visualizations.", "", null, "paw.svg");
  }

  getGenerateDashboardButton() {
    return this.buildActionItem(
      "title",
      "action",
      "musictime.displayDashboard",
      null,
      "Dashboard",
      "View your latest music metrics right here in your editor",
      "",
      null,
      "dashboard.svg"
    );
  }

  getSlackIntegrationsTree(): KpmItem {
    const parentItem = this.buildKpmItem("Slack workspaces", "", "slack.svg");
    parentItem.contextValue = "musictime_slack_folder_parent";
    parentItem.children = [];
    const workspaces = getSlackWorkspaces();
    for (const integration of workspaces) {
      const workspaceItem = this.buildKpmItem(integration.team_domain, "", "slack.svg");
      workspaceItem.contextValue = "musictime_slack_workspace_node";
      workspaceItem.description = `(${integration.team_name})`;
      workspaceItem.value = integration.authId;
      parentItem.children.push(workspaceItem);
    }
    return parentItem;
  }

  createSpotifyDevicesButton(title, tooltip, loggedIn, command = null) {
    const button = this.buildActionItem("title", "spotify", command, PlayerType.WebSpotify, title, tooltip);
    button.tag = loggedIn ? "active" : "disabled";
    return button;
  }

  getLineBreakButton() {
    return this.buildActionItem("title", "divider", null, PlayerType.NotAssigned, "", "");
  }

  buildActionItem(id, type, command, playerType: PlayerType, name, tooltip = "", itemType: string = "", callback: any = null, icon: string = "") {
    let item: PlaylistItem = new PlaylistItem();
    item.tracks = new PlaylistTrackInfo();
    item.type = type;
    item.id = id;
    item.command = command;
    item["cb"] = callback;
    item.playerType = playerType;
    item.name = name;
    item.tooltip = tooltip;
    item.itemType = itemType;
    item["icon"] = icon;
    return item;
  }

  buildKpmItem(label, tooltip = "", icon = null, command = null): KpmItem {
    const item: KpmItem = new KpmItem();
    item.name = label;
    item.tooltip = tooltip;
    item.icon = icon;
    item.command = command;
    item.id = `${label}_kpm_item`;
    item.eventDescription = null;
    item.type = "kpm_type";
    return item;
  }

  getWebAnalyticsButton() {
    // See web analytics
    let listItem: PlaylistItem = new PlaylistItem();
    listItem.tracks = new PlaylistTrackInfo();
    listItem.type = "action";
    listItem.tag = "paw";
    listItem.id = "launchmusicanalytics";
    listItem.command = "musictime.launchAnalytics";
    listItem.playerType = PlayerType.WebSpotify;
    listItem.name = "More data at Software.com";
    listItem.tooltip = "See music analytics in the web app";
    return listItem;
  }

  getNoTracksFoundButton() {
    return this.buildActionItem("title", "message", null, PlayerType.NotAssigned, "Your tracks will appear here");
  }

  async getSwitchToThisDeviceButton() {
    const { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice } = getDeviceSet();

    if (activeDevice && !webPlayer && !desktop) {
      // return a button to switch to this computer if we have devices
      // and none of them are of type "Computer"
      const button = this.buildActionItem("title", "action", "musictime.switchToThisDevice", PlayerType.MacSpotifyDesktop, "Switch To This Device");
      return button;
    }
    return null;
  }

  // get the custom playlist button by checkinf if the custom playlist
  // exists or not. if it doesn't exist then it will show the create label,
  // otherwise, it will show the refresh label
  getCustomPlaylistButton() {
    // update the existing playlist that matches the personal playlist with a paw if found
    const customPlaylist = MusicDataManager.getInstance().getMusicTimePlaylistByTypeId(PERSONAL_TOP_SONGS_PLID);

    const personalPlaylistLabel = !customPlaylist ? GENERATE_CUSTOM_PLAYLIST_TITLE : REFRESH_CUSTOM_PLAYLIST_TITLE;
    const personalPlaylistTooltip = !customPlaylist ? GENERATE_CUSTOM_PLAYLIST_TOOLTIP : REFRESH_CUSTOM_PLAYLIST_TOOLTIP;

    if (MusicDataManager.getInstance().currentPlayerName !== PlayerName.ItunesDesktop && !requiresSpotifyAccess()) {
      // add the connect spotify link
      let listItem: PlaylistItem = new PlaylistItem();
      listItem.tracks = new PlaylistTrackInfo();
      listItem.type = "action";
      listItem.tag = "action";
      listItem.id = "codingfavorites";
      listItem.command = "musictime.generateWeeklyPlaylist";
      listItem.playerType = PlayerType.WebSpotify;
      listItem.name = personalPlaylistLabel;
      listItem.tooltip = personalPlaylistTooltip;
      listItem["icon"] = "generate.svg";
      return listItem;
    }
    return null;
  }

  async getInactiveDevices(devices: PlayerDevice[]): Promise<PlayerDevice[]> {
    let inactive_devices: PlayerDevice[] = [];
    if (devices && devices.length > 0) {
      for (let i = 0; i < devices.length; i++) {
        const device: PlayerDevice = devices[i];
        if (!device.is_active) {
          inactive_devices.push(device);
        }
      }
    }

    return inactive_devices;
  }

  convertTracksToPlaylistItems(tracks: Track[]) {
    let items: PlaylistItem[] = [];

    if (!requiresSpotifyAccess()) {
      const labelButton = this.buildActionItem(
        "label",
        "label",
        null,
        PlayerType.NotAssigned,
        MusicDataManager.getInstance().recommendationLabel,
        ""
      );
      labelButton.tag = "paw";

      if (tracks && tracks.length > 0) {
        // since we have recommendations, show the label button
        items.push(labelButton);
        for (let i = 0; i < tracks.length; i++) {
          const track: Track = tracks[i];
          const item: PlaylistItem = MusicManager.getInstance().createPlaylistItemFromTrack(track, 0);
          item.tag = "spotify";
          item.type = "recommendation";
          item["icon"] = "track.svg";
          items.push(item);
        }
      }
    } else {
      // create the connect button
      items.push(this.getRecommendationConnectToSpotifyButton());
    }
    return items;
  }
}
