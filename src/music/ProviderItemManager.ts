import { PlayerType, PlaylistItem, PlaylistTrackInfo, PlayerDevice } from "cody-music";
import { SPOTIFY_LIKED_SONGS_PLAYLIST_NAME } from "../Constants";
import { isMac, getItem } from "../Util";
import { KpmItem } from "../model/models";
import { getCurrentDevices, getDeviceSet, requiresSpotifyReAuthentication } from "../managers/PlaylistDataManager";

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
    return item;
  }

  async getActiveSpotifyDevicesButton() {
    const { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice } = getDeviceSet();

    const devices: PlayerDevice[] = getCurrentDevices();

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
      "Switch Account",
      "Connect to your premium Spotify account to enable web playback controls",
      null,
      null
    );
  }

  getLoadingButton() {
    return this.buildActionItem("loading", "action", null, PlayerType.NotAssigned, "Loading...", "please wait", null, "action");
  }

  getConnectToSpotifyButton() {
    const requiresReAuth = requiresSpotifyReAuthentication();
    const action = requiresReAuth ? "Reconnect" : "Connect";
    return this.buildActionItem(
      "connecttospotify",
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
      "recommendconnecttospotify",
      "spotify",
      "musictime.connectSpotify",
      PlayerType.WebSpotify,
      `${action} Spotify to see recommendations`,
      "Connect Spotify to see your playlist and track recommendations"
    );
  }

  getSwitchToSpotifyButton() {
    return this.buildActionItem("switchtospotify", "spotify", "musictime.launchSpotifyDesktop", PlayerType.WebSpotify, "Launch Spotify");
  }

  getAuthTypeIconAndLabel() {
    const authType = getItem("authType");
    const name = getItem("name");
    let tooltip = name ? `Connected as ${name}` : "";
    if (authType === "google") {
      return {
        label: name,
        tooltip,
      };
    } else if (authType === "github") {
      return {
        label: name,
        tooltip,
      };
    }
    return {
      label: name,
      tooltip,
    };
  }

  getSignupButton() {
    return this.buildActionItem(
      "signupbutton",
      "action",
      "musictime.signUpAccount",
      null,
      "Sign up",
      "Sign up to see more data visualizations.",
      "",
      null
    );
  }

  getLoginButton() {
    return this.buildActionItem(
      "loginbutton",
      "action",
      "musictime.logInAccount",
      null,
      "Log in",
      "Log in to see more data visualizations.",
      "",
      null
    );
  }

  createSpotifyDevicesButton(title, tooltip, loggedIn, command = null) {
    const button = this.buildActionItem("devicesbutton", "spotify", command, PlayerType.WebSpotify, title, tooltip);
    button.tag = loggedIn ? "active" : "disabled";
    return button;
  }

  getLineBreakButton() {
    return this.buildActionItem("linebreak", "divider", null, PlayerType.NotAssigned, "", "");
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
    return this.buildKpmItem("More data at Software.com", "See music analytics in the web app", null, "musictime.launchAnalytics");
  }

  getNoTracksFoundButton() {
    return this.buildActionItem("notracksfoundbutton", "message", null, PlayerType.NotAssigned, "Your tracks will appear here");
  }

  async getSwitchToThisDeviceButton() {
    const { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice } = getDeviceSet();

    if (activeDevice && !webPlayer && !desktop) {
      // return a button to switch to this computer if we have devices
      // and none of them are of type "Computer"
      const button = this.buildActionItem(
        "switchtothisdevicebutton",
        "action",
        "musictime.switchToThisDevice",
        PlayerType.MacSpotifyDesktop,
        "Switch To This Device"
      );
      return button;
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
}
