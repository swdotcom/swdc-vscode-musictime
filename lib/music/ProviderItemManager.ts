import {
    PlayerType,
    PlaylistItem,
    PlaylistTrackInfo,
    PlayerDevice,
    PlayerName
} from "cody-music";
import {
    SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
    PERSONAL_TOP_SONGS_PLID,
    GENERATE_CUSTOM_PLAYLIST_TITLE,
    REFRESH_CUSTOM_PLAYLIST_TITLE,
    GENERATE_CUSTOM_PLAYLIST_TOOLTIP,
    REFRESH_CUSTOM_PLAYLIST_TOOLTIP
} from "../Constants";
import {
    getActiveDevice,
    requiresSpotifyAccess,
    getMusicTimePlaylistByTypeId
} from "./MusicUtil";
import { MusicManager } from "./MusicManager";
import { MusicDataManager } from "./MusicDataManager";

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

    getNoMusicTimeConnectionButton() {
        return this.buildActionItem(
            "offline",
            "offline",
            null,
            PlayerType.NotAssigned,
            "Music Time Offline",
            "Unable to connect to Music Time"
        );
    }

    getSpotifyConnectedButton() {
        return this.buildActionItem(
            "spotifyconnected",
            "connected",
            null,
            PlayerType.WebSpotify,
            "Spotify Connected",
            "You've connected Spotify"
        );
    }

    getSpotifyPremiumAccountRequiredButton() {
        return this.buildActionItem(
            "spotifypremium",
            "action",
            "musictime.connectSpotify",
            PlayerType.NotAssigned,
            "Spotify Premium Required",
            "Connect to your premium Spotify account to use the play, pause, next, and previous controls"
        );
    }

    getSpotifyConnectPremiumButton() {
        return this.buildActionItem(
            "spotifypremium",
            "action",
            "musictime.connectSpotify",
            PlayerType.NotAssigned,
            "Connect Premium",
            "Connect to your premium Spotify account to use the play, pause, next, and previous controls"
        );
    }

    getItunesConnectedButton() {
        return this.buildActionItem(
            "itunesconnected",
            "connected",
            null,
            PlayerType.MacItunesDesktop,
            "iTunes Connected",
            "You've connected iTunes"
        );
    }

    getLoadingButton() {
        return this.buildActionItem(
            "loading",
            "action",
            null,
            PlayerType.NotAssigned,
            "Loading...",
            "please wait"
        );
    }

    getConnectToSpotifyButton() {
        return this.buildActionItem(
            "connectspotify",
            "spotify",
            "musictime.connectSpotify",
            PlayerType.WebSpotify,
            "Connect Spotify",
            "Connect Spotify to view your playlists"
        );
    }

    getRecommendationConnectToSpotifyButton() {
        // Connect Spotify to see recommendations
        return this.buildActionItem(
            "connectspotify",
            "spotify",
            "musictime.connectSpotify",
            PlayerType.WebSpotify,
            "Connect Spotify to see recommendations",
            "Connect Spotify to see your playlist and track recommendations"
        );
    }

    getSwitchToSpotifyButton() {
        return this.buildActionItem(
            "title",
            "spotify",
            "musictime.launchSpotify",
            PlayerType.WebSpotify,
            "Launch Spotify"
        );
    }

    getSwitchToItunesButton() {
        return this.buildActionItem(
            "title",
            "itunes",
            "musictime.launchItunes",
            PlayerType.MacItunesDesktop,
            "Launch iTunes"
        );
    }

    // readme button
    getReadmeButton() {
        return this.buildActionItem(
            "title",
            "action",
            "musictime.displayReadme",
            null,
            "Learn More",
            "View the Music Time Readme to learn more",
            "",
            null,
            "document.svg"
        );
    }

    getGenerateDashboardButton() {
        return this.buildActionItem(
            "title",
            "action",
            "musictime.displayDashboard",
            null,
            "Generate dashboard",
            "View your latest music metrics right here in your editor",
            "",
            null,
            "dashboard.svg"
        );
    }

    createSpotifyDevicesButton(title, tooltip, loggedIn) {
        const button = this.buildActionItem(
            "title",
            "spotify",
            null,
            PlayerType.WebSpotify,
            title,
            tooltip
        );
        button.tag = loggedIn ? "active" : "disabled";
        return button;
    }

    getLineBreakButton() {
        return this.buildActionItem(
            "title",
            "divider",
            null,
            PlayerType.NotAssigned,
            "",
            ""
        );
    }

    buildActionItem(
        id,
        type,
        command,
        playerType: PlayerType,
        name,
        tooltip = "",
        itemType: string = "",
        callback: any = null,
        icon: string = ""
    ) {
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

    getWebAnalyticsButton() {
        // See web analytics
        let listItem: PlaylistItem = new PlaylistItem();
        listItem.tracks = new PlaylistTrackInfo();
        listItem.type = "action";
        listItem.tag = "paw";
        listItem.id = "launchmusicanalytics";
        listItem.command = "musictime.launchAnalytics";
        listItem.playerType = PlayerType.WebSpotify;
        listItem.name = "See Web Analytics";
        listItem.tooltip = "See music analytics in the web app";
        return listItem;
    }

    getNoTracksFoundButton() {
        return this.buildActionItem(
            "title",
            "message",
            null,
            PlayerType.NotAssigned,
            "Your tracks will appear here"
        );
    }

    async getSwitchToThisDeviceButton(devices: PlayerDevice[]) {
        const activeDevice = getActiveDevice(devices);

        if (activeDevice && activeDevice.type.toLowerCase() !== "computer") {
            // return a button to switch to this computer if we have devices
            // and none of them are of type "Computer"
            const button = this.buildActionItem(
                "title",
                "action",
                "musictime.launchSpotify",
                PlayerType.MacSpotifyDesktop,
                "Switch To This Device"
            );
            return button;
        }
        return null;
    }

    // get the custom playlist button by checkinf if the custom playlist
    // exists or not. if it doesn't exist then it will show the create label,
    // otherwise, it will show the refresh label
    getCustomPlaylistButton() {
        // update the existing playlist that matches the personal playlist with a paw if found
        const customPlaylist = getMusicTimePlaylistByTypeId(
            PERSONAL_TOP_SONGS_PLID
        );

        const personalPlaylistLabel = !customPlaylist
            ? GENERATE_CUSTOM_PLAYLIST_TITLE
            : REFRESH_CUSTOM_PLAYLIST_TITLE;
        const personalPlaylistTooltip = !customPlaylist
            ? GENERATE_CUSTOM_PLAYLIST_TOOLTIP
            : REFRESH_CUSTOM_PLAYLIST_TOOLTIP;

        if (
            MusicDataManager.getInstance().currentPlayerName !==
                PlayerName.ItunesDesktop &&
            !requiresSpotifyAccess()
        ) {
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
}
