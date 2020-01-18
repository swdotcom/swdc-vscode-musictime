import { commands, Disposable, window, TreeView } from "vscode";
import {
    MusicControlManager,
    connectSpotify,
    disconnectSpotify,
    disconnectSlack
} from "./music/MusicControlManager";
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
import { PlaylistItem, PlayerName } from "cody-music";
import { MusicCommandManager } from "./music/MusicCommandManager";
import { SocialShareManager } from "./social/SocialShareManager";
import { connectSlack } from "./slack/SlackControlManager";
import { MusicManager } from "./music/MusicManager";
import {
    MusicRecommendationProvider,
    connectRecommendationPlaylistTreeView
} from "./music/MusicRecommendationProvider";

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
    MusicCommandManager.setTreeProvider(treePlaylistProvider);
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

    const refreshPlaylistStateCmd = commands.registerCommand(
        "musictime.refreshPlaylistState",
        async () => {
            await musicMgr.refreshPlaylistState();
            treePlaylistProvider.refresh();
        }
    );
    cmds.push(refreshPlaylistStateCmd);

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

    const likedSongRecsCommand = commands.registerCommand(
        "musictime.likedSongRecs",
        () => musicMgr.updateRecommendations("Similar to Liked Songs", 5)
    );
    cmds.push(likedSongRecsCommand);

    const soundtrackSongRecsCommand = commands.registerCommand(
        "musictime.soundtrackSongRecs",
        () => musicMgr.updateRecommendations("Soundtracks", 0, ["soundtracks"])
    );
    cmds.push(soundtrackSongRecsCommand);

    const classicalSongRecsCommand = commands.registerCommand(
        "musictime.classicalSongRecs",
        () => musicMgr.updateRecommendations("Classical", 0, ["classical"])
    );
    cmds.push(classicalSongRecsCommand);

    const pianoSongRecsCommand = commands.registerCommand(
        "musictime.pianoSongRecs",
        () => musicMgr.updateRecommendations("Piano", 0, ["piano"])
    );
    cmds.push(pianoSongRecsCommand);

    const highEnergySongRecsCommand = commands.registerCommand(
        "musictime.highEnergySongRecs",
        () =>
            musicMgr.updateRecommendations("High Energy", 5, [], {
                min_energy: 0.6,
                target_energy: 1
            })
    );
    cmds.push(highEnergySongRecsCommand);

    const lowEnergySongRecsCommand = commands.registerCommand(
        "musictime.lowEnergySongRecs",
        () =>
            musicMgr.updateRecommendations("Low Energy", 5, [], {
                max_energy: 0.4,
                target_energy: 0
            })
    );
    cmds.push(lowEnergySongRecsCommand);

    const highValenceSongRecsCommand = commands.registerCommand(
        "musictime.highValenceSongRecs",
        () =>
            musicMgr.updateRecommendations("High Valence", 5, [], {
                min_valence: 0.6,
                target_valence: 1
            })
    );
    cmds.push(highValenceSongRecsCommand);

    const lowValenceSongRecsCommand = commands.registerCommand(
        "musictime.lowValenceSongRecs",
        () =>
            musicMgr.updateRecommendations("Low Valence", 5, [], {
                max_valence: 0.4,
                target_valence: 0
            })
    );
    cmds.push(lowValenceSongRecsCommand);

    const highTempoSongRecsCommand = commands.registerCommand(
        "musictime.highTempoSongRecs",
        () =>
            musicMgr.updateRecommendations("High Tempo", 5, [], {
                min_tempo: 145,
                target_tempo: 220
            })
    );
    cmds.push(highTempoSongRecsCommand);

    const lowTempoSongRecsCommand = commands.registerCommand(
        "musictime.lowTempoSongRecs",
        () =>
            musicMgr.updateRecommendations("Low Tempo", 5, [], {
                max_tempo: 95,
                target_tempo: 0
            })
    );
    cmds.push(lowTempoSongRecsCommand);

    const refreshRecommendationsCommand = commands.registerCommand(
        "musictime.refreshRecommendations",
        async () => {
            musicMgr.refreshRecommendations();
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
