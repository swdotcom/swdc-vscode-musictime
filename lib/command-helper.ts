import { commands, Disposable, workspace, window, TreeView } from "vscode";
import {
    MusicControlManager,
    connectSpotify,
    disconnectSpotify,
    disconnectSlack
} from "./music/MusicControlManager";
import { updatePreferences } from "./DataController";
import {
    launchWebUrl,
    codeTimeExtInstalled,
    launchMusicAnalytics
} from "./Util";
import { KpmController } from "./KpmController";
import {
    MusicPlaylistProvider,
    connectPlaylistTreeView
} from "./music/MusicPlaylistProvider";
import { PlaylistItem, PlayerName, TrackStatus } from "cody-music";
import { MusicCommandManager } from "./music/MusicCommandManager";
import { SocialShareManager } from "./social/SocialShareManager";
import { connectSlack } from "./slack/SlackControlManager";
import { MusicManager } from "./music/MusicManager";
import { MusicStateManager } from "./music/MusicStateManager";

export function createCommands(): {
    dispose: () => void;
} {
    let cmds = [];

    //
    // Add the keystroke controller to the ext ctx, which
    // will then listen for text document changes.
    //
    const kpmController = new KpmController();

    const controller = new MusicControlManager();
    const musicMgr: MusicManager = MusicManager.getInstance();

    MusicStateManager.getInstance().setKpmController(kpmController);

    // playlist tree view
    const treePlaylistProvider = new MusicPlaylistProvider();
    const playlistTreeView: TreeView<PlaylistItem> = window.createTreeView(
        "my-playlists",
        {
            treeDataProvider: treePlaylistProvider,
            showCollapseAll: false
        }
    );
    MusicCommandManager.setTreeProvider(treePlaylistProvider);
    treePlaylistProvider.bindView(playlistTreeView);
    cmds.push(connectPlaylistTreeView(playlistTreeView));

    const nextCmd = commands.registerCommand("musictime.next", () => {
        controller.nextSong();
    });
    cmds.push(nextCmd);

    const previousCmd = commands.registerCommand("musictime.previous", () => {
        controller.previousSong();
    });
    cmds.push(previousCmd);

    const playCmd = commands.registerCommand(
        "musictime.play",
        async (p: PlaylistItem) => {
            const notAssigned =
                p && (!p.state || p.state === TrackStatus.NotAssigned)
                    ? true
                    : false;
            const isPlaylist = p && p["itemType"] === "playlist" ? true : false;
            const hasTracks =
                p && p.tracks && p.tracks["total"] && p.tracks["total"] > 0
                    ? true
                    : false;

            // if it's a playlist without any tracks break out
            if (isPlaylist && !hasTracks) {
                return;
            }
            if (notAssigned) {
                // track status is not yet assigned, play it
                if (p.type === "track") {
                    await treePlaylistProvider.selectTrack(p, true);
                } else {
                    await treePlaylistProvider.selectPlaylist(p);
                }
            } else {
                controller.playSong();
            }
        }
    );
    cmds.push(playCmd);

    const sharePlaylistLinkCmd = commands.registerCommand(
        "musictime.sharePlaylist",
        (node: PlaylistItem) => {
            SocialShareManager.getInstance().showMenu(node.id, node.name, true);
        }
    );
    cmds.push(sharePlaylistLinkCmd);

    const shareTrackLinkCmd = commands.registerCommand(
        "musictime.shareTrack",
        (node: PlaylistItem) => {
            SocialShareManager.getInstance().showMenu(
                node.id,
                node.name,
                false
            );
        }
    );
    cmds.push(shareTrackLinkCmd);

    const pauseCmd = commands.registerCommand("musictime.pause", () => {
        controller.pauseSong();
    });
    cmds.push(pauseCmd);

    const likeCmd = commands.registerCommand("musictime.like", () => {
        controller.setLiked(true);
    });
    cmds.push(likeCmd);

    const unlikeCmd = commands.registerCommand("musictime.unlike", () => {
        controller.setLiked(false);
    });
    cmds.push(unlikeCmd);

    const menuCmd = commands.registerCommand("musictime.menu", () => {
        controller.showMenu();
    });
    cmds.push(menuCmd);

    const launchTrackPlayerCmd = commands.registerCommand(
        "musictime.currentSong",
        () => {
            musicMgr.launchTrackPlayer();
        }
    );
    cmds.push(launchTrackPlayerCmd);

    const spotifyConnectCommand = commands.registerCommand(
        "musictime.connectSpotify",
        () => {
            connectSpotify();
        }
    );
    cmds.push(spotifyConnectCommand);

    const slackConnectCommand = commands.registerCommand(
        "musictime.connectSlack",
        () => {
            connectSlack();
        }
    );
    cmds.push(slackConnectCommand);

    const disconnectSpotifyCommand = commands.registerCommand(
        "musictime.disconnectSpotify",
        () => {
            disconnectSpotify();
        }
    );
    cmds.push(disconnectSpotifyCommand);

    const disconnectSlackCommand = commands.registerCommand(
        "musictime.disconnectSlack",
        () => {
            disconnectSlack();
        }
    );
    cmds.push(disconnectSlackCommand);

    const reconcilePlaylistCommand = commands.registerCommand(
        "musictime.reconcilePlaylist",
        async () => {
            commands.executeCommand("musictime.refreshPlaylist");
        }
    );
    cmds.push(reconcilePlaylistCommand);

    const sortPlaylistAlphabeticallyCommand = commands.registerCommand(
        "musictime.sortAlphabetically",
        async () => {
            musicMgr.sortAlphabetically = true;
            commands.executeCommand("musictime.refreshPlaylist");
        }
    );
    cmds.push(sortPlaylistAlphabeticallyCommand);

    const sortPlaylistToOriginalCommand = commands.registerCommand(
        "musictime.sortToOriginal",
        async () => {
            musicMgr.sortAlphabetically = false;
            commands.executeCommand("musictime.refreshPlaylist");
        }
    );
    cmds.push(sortPlaylistToOriginalCommand);

    const refreshPlaylistCommand = commands.registerCommand(
        "musictime.refreshPlaylist",
        async () => {
            await musicMgr.clearPlaylists();
            await musicMgr.refreshPlaylists();
            setTimeout(() => {
                treePlaylistProvider.refresh();
            }, 1000);
        }
    );
    cmds.push(refreshPlaylistCommand);

    const launchSpotifyCommand = commands.registerCommand(
        "musictime.launchSpotify",
        () => musicMgr.launchTrackPlayer(PlayerName.SpotifyWeb)
    );
    cmds.push(launchSpotifyCommand);

    const spotifyPremiumRequiredCommand = commands.registerCommand(
        "musictime.spotifyPremiumRequired",
        () => musicMgr.launchTrackPlayer(PlayerName.SpotifyWeb)
    );
    cmds.push(spotifyPremiumRequiredCommand);

    const launchSpotifyPlaylistCommand = commands.registerCommand(
        "musictime.spotifyPlaylist",
        () => musicMgr.launchTrackPlayer(PlayerName.SpotifyWeb)
    );
    cmds.push(launchSpotifyPlaylistCommand);

    const launchItunesCommand = commands.registerCommand(
        "musictime.launchItunes",
        () => musicMgr.launchTrackPlayer(PlayerName.ItunesDesktop)
    );
    cmds.push(launchItunesCommand);

    const launchItunesPlaylistCommand = commands.registerCommand(
        "musictime.itunesPlaylist",
        () => musicMgr.launchTrackPlayer(PlayerName.ItunesDesktop)
    );
    cmds.push(launchItunesPlaylistCommand);

    const generateWeeklyPlaylistCommand = commands.registerCommand(
        "musictime.generateWeeklyPlaylist",
        () => musicMgr.generateUsersWeeklyTopSongs()
    );
    cmds.push(generateWeeklyPlaylistCommand);

    const launchMusicAnalyticsCommand = commands.registerCommand(
        "musictime.launchAnalytics",
        () => launchMusicAnalytics()
    );
    cmds.push(launchMusicAnalyticsCommand);

    if (!codeTimeExtInstalled()) {
        // code time is not installed, load the kpm controller for music time
        cmds.push(kpmController);

        const top40Cmd = commands.registerCommand(
            "extension.viewSoftwareTop40",
            () => {
                launchWebUrl("https://api.software.com/music/top40");
            }
        );
        cmds.push(top40Cmd);

        const configChangesHandler = workspace.onDidChangeConfiguration(e =>
            updatePreferences()
        );
        cmds.push(configChangesHandler);
    }

    return Disposable.from(...cmds);
}
