import { commands, Disposable, window, TreeView } from "vscode";
import {
    MusicControlManager,
    connectSpotify,
    disconnectSpotify,
    disconnectSlack,
    displayMusicTimeMetricsMarkdownDashboard
} from "./music/MusicControlManager";
import {
    launchWebUrl,
    codeTimeExtInstalled,
    launchMusicAnalytics,
    displayReadmeIfNotExists
} from "./Util";
import { KpmController } from "./KpmController";
import {
    MusicPlaylistProvider,
    connectPlaylistTreeView
} from "./music/MusicPlaylistProvider";
import {
    PlaylistItem,
    PlayerName,
    PlayerDevice,
    playSpotifyDevice
} from "cody-music";
import { SocialShareManager } from "./social/SocialShareManager";
import { connectSlack } from "./slack/SlackControlManager";
import { MusicManager } from "./music/MusicManager";
import {
    MusicRecommendationProvider,
    connectRecommendationPlaylistTreeView
} from "./music/MusicRecommendationProvider";
import {
    showGenreSelections,
    showCategorySelections
} from "./selector/RecTypeSelectorManager";
import { showSortPlaylistMenu } from "./selector/SortPlaylistSelectorManager";
import {
    populateSpotifyPlaylists,
    populateSpotifyDevices
} from "./DataController";
import { CacheManager } from "./cache/CacheManager";
import { showDeviceSelectorMenu } from "./selector/SpotifyDeviceSelectorManager";
import {
    updateRecommendations,
    refreshRecommendations
} from "./music/MusicRecommendationManager";

/**
 * add the commands to vscode....
 */
export function createCommands(): {
    dispose: () => void;
} {
    let cmds = [];

    const controller: MusicControlManager = MusicControlManager.getInstance();
    const musicMgr: MusicManager = MusicManager.getInstance();

    // playlist tree view
    const treePlaylistProvider = new MusicPlaylistProvider();
    const playlistTreeView: TreeView<PlaylistItem> = window.createTreeView(
        "my-playlists",
        {
            treeDataProvider: treePlaylistProvider,
            showCollapseAll: false
        }
    );
    treePlaylistProvider.bindView(playlistTreeView);
    cmds.push(connectPlaylistTreeView(playlistTreeView));

    // recommended tracks tree view
    const recTreePlaylistProvider = new MusicRecommendationProvider();
    const recPlaylistTreeView: TreeView<PlaylistItem> = window.createTreeView(
        "track-recommendations",
        {
            treeDataProvider: recTreePlaylistProvider,
            showCollapseAll: false
        }
    );
    recTreePlaylistProvider.bindView(recPlaylistTreeView);
    cmds.push(connectRecommendationPlaylistTreeView(recPlaylistTreeView));

    const revealTreeCmd = commands.registerCommand(
        "musictime.revealTree",
        () => {
            treePlaylistProvider.revealTree();
        }
    );
    cmds.push(revealTreeCmd);

    const launchReadmeCmd = commands.registerCommand(
        "musictime.displayReadme",
        () => {
            displayReadmeIfNotExists(true /*override*/);
        }
    );
    cmds.push(launchReadmeCmd);

    const launchDashboardCmd = commands.registerCommand(
        "musictime.displayDashboard",
        () => {
            displayMusicTimeMetricsMarkdownDashboard();
        }
    );
    cmds.push(launchDashboardCmd);

    const nextCmd = commands.registerCommand("musictime.next", () => {
        controller.nextSong();
    });
    cmds.push(nextCmd);

    const previousCmd = commands.registerCommand("musictime.previous", () => {
        controller.previousSong();
    });
    cmds.push(previousCmd);

    const progressCmd = commands.registerCommand("musictime.progress", () => {
        // do nothing for now
    });
    cmds.push(progressCmd);

    const playCmd = commands.registerCommand("musictime.play", async () => {
        controller.playSong();
    });
    cmds.push(playCmd);

    const removeTrackCmd = commands.registerCommand(
        "musictime.removeTrack",
        async (p: PlaylistItem) => {
            musicMgr.removeTrackFromPlaylist(p);
        }
    );
    cmds.push(removeTrackCmd);

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

    const repeatOnCmd = commands.registerCommand("musictime.repeatOn", () => {
        controller.setRepeatOnOff(true);
    });
    cmds.push(repeatOnCmd);

    const repeatOffCmd = commands.registerCommand("musictime.repeatOff", () => {
        controller.setRepeatOnOff(false);
    });
    cmds.push(repeatOffCmd);

    const menuCmd = commands.registerCommand("musictime.menu", () => {
        controller.showMenu();
    });
    cmds.push(menuCmd);

    const followCmd = commands.registerCommand(
        "musictime.follow",
        (p: PlaylistItem) => {
            musicMgr.followSpotifyPlaylist(p);
        }
    );
    cmds.push(followCmd);

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

    // this should only be attached to the refresh button
    const reconcilePlaylistCommand = commands.registerCommand(
        "musictime.refreshButton",
        async () => {
            const lastRefresh = CacheManager.getInstance().get("lastRefresh");
            if (!lastRefresh) {
                commands.executeCommand("musictime.hardRefreshPlaylist");
                // 60 seconds ttl
                CacheManager.getInstance().set("lastRefresh", true, 10);
            } else {
                // refresh the device info and playlist
                await populateSpotifyDevices();
                commands.executeCommand("musictime.refreshPlaylist");
            }
        }
    );
    cmds.push(reconcilePlaylistCommand);

    // this should only be attached to the refresh button
    const hardRefreshPlaylistCommand = commands.registerCommand(
        "musictime.hardRefreshPlaylist",
        async () => {
            await populateSpotifyPlaylists();
            commands.executeCommand("musictime.refreshPlaylist");
        }
    );
    cmds.push(hardRefreshPlaylistCommand);

    // this should only be attached to the refresh button
    const refreshDeviceInfoCommand = commands.registerCommand(
        "musictime.refreshDeviceInfo",
        async () => {
            await populateSpotifyDevices();
            commands.executeCommand("musictime.refreshPlaylist");
        }
    );
    cmds.push(refreshDeviceInfoCommand);

    const refreshPlaylistCommand = commands.registerCommand(
        "musictime.refreshPlaylist",
        async () => {
            await musicMgr.clearPlaylists();
            await musicMgr.refreshPlaylists();
            treePlaylistProvider.refresh();
        }
    );
    cmds.push(refreshPlaylistCommand);

    const sortPlaylistCommand = commands.registerCommand(
        "musictime.sortIcon",
        async () => {
            showSortPlaylistMenu();
        }
    );
    cmds.push(sortPlaylistCommand);

    const sortPlaylistAlphabeticallyCommand = commands.registerCommand(
        "musictime.sortAlphabetically",
        async () => {
            musicMgr.updateSort(true);
        }
    );
    cmds.push(sortPlaylistAlphabeticallyCommand);

    const sortPlaylistToOriginalCommand = commands.registerCommand(
        "musictime.sortToOriginal",
        async () => {
            musicMgr.updateSort(false);
        }
    );
    cmds.push(sortPlaylistToOriginalCommand);

    const switchToThisDeviceCommand = commands.registerCommand(
        "musictime.switchToThisDevice",
        async () => {
            musicMgr.launchTrackPlayer(PlayerName.SpotifyDesktop);
        }
    );

    const launchSpotifyCommand = commands.registerCommand(
        "musictime.launchSpotify",
        async () => {
            musicMgr.launchTrackPlayer(PlayerName.SpotifyWeb);
        }
    );
    cmds.push(launchSpotifyCommand);

    const launchSpotifyDesktopCommand = commands.registerCommand(
        "musictime.launchSpotifyDesktop",
        async () => {
            await musicMgr.launchTrackPlayer(PlayerName.SpotifyDesktop);
        }
    );
    cmds.push(launchSpotifyDesktopCommand);

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

    const addToPlaylistCommand = commands.registerCommand(
        "musictime.addToPlaylist",
        (item: PlaylistItem) => controller.addToPlaylistMenu(item)
    );
    cmds.push(addToPlaylistCommand);

    const deviceSelectTransferCmd = commands.registerCommand(
        "musictime.transferToDevice",
        async (d: PlayerDevice) => {
            // transfer to this device
            window.showInformationMessage(`Connected to ${d.name}`);
            await playSpotifyDevice(d.id);
            setTimeout(() => {
                // refresh the tree, no need to refresh playlists
                commands.executeCommand("musictime.refreshDeviceInfo");
            }, 3000);
        }
    );
    cmds.push(deviceSelectTransferCmd);

    const genreRecListCmd = commands.registerCommand(
        "musictime.songGenreSelector",
        () => {
            showGenreSelections();
        }
    );
    cmds.push(genreRecListCmd);

    const categoryRecListCmd = commands.registerCommand(
        "musictime.songCategorySelector",
        () => {
            showCategorySelections();
        }
    );
    cmds.push(categoryRecListCmd);

    const deviceSelectorCmd = commands.registerCommand(
        "musictime.deviceSelector",
        () => {
            showDeviceSelectorMenu();
        }
    );
    cmds.push(deviceSelectorCmd);

    const refreshRecommendationsCommand = commands.registerCommand(
        "musictime.refreshRecommendations",
        async () => {
            setTimeout(() => {
                refreshRecommendations();
            }, 100);
        }
    );
    cmds.push(refreshRecommendationsCommand);

    const refreshRecPlaylistCommand = commands.registerCommand(
        "musictime.refreshRecommendationsTree",
        async () => {
            recTreePlaylistProvider.refresh();
        }
    );
    cmds.push(refreshRecPlaylistCommand);

    const updateRecsCommand = commands.registerCommand(
        "musictime.updateRecommendations",
        args => {
            // there's always at least 3 args
            const label = args[0];
            const likedSongSeedLimit = args[1];
            const seed_genres = args[2];
            const features = args.length > 3 ? args[3] : {};
            updateRecommendations(
                label,
                likedSongSeedLimit,
                seed_genres,
                features
            );
        }
    );
    cmds.push(updateRecsCommand);

    if (!codeTimeExtInstalled()) {
        // initialize the kpm controller to start the listener
        KpmController.getInstance();
        const top40Cmd = commands.registerCommand(
            "musictime.viewSoftwareTop40",
            () => {
                launchWebUrl("https://api.software.com/music/top40");
            }
        );
        cmds.push(top40Cmd);
    }

    return Disposable.from(...cmds);
}
