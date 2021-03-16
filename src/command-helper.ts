import { commands, Disposable, window, TreeView } from "vscode";
import {
  MusicControlManager,
  displayMusicTimeMetricsMarkdownDashboard,
} from "./music/MusicControlManager";
import { launchMusicAnalytics } from "./Util";
import { MusicPlaylistProvider, connectPlaylistTreeView } from "./music/MusicPlaylistProvider";
import { PlaylistItem, PlayerName, PlayerDevice, playSpotifyDevice } from "cody-music";
import { SocialShareManager } from "./social/SocialShareManager";
import { connectSlackWorkspace, disconnectSlack, disconnectSlackAuth } from "./managers/SlackManager";
import { MusicManager } from "./music/MusicManager";
import {
  MusicRecommendationProvider,
  connectRecommendationPlaylistTreeView,
} from "./music/MusicRecommendationProvider";
import { showGenreSelections, showCategorySelections } from "./selector/RecTypeSelectorManager";
import {
  showSortPlaylistMenu,
  showPlaylistOptionsMenu,
} from "./selector/SortPlaylistSelectorManager";
import { populateSpotifyPlaylists, populateSpotifyDevices } from "./DataController";
import { showDeviceSelectorMenu } from "./selector/SpotifyDeviceSelectorManager";
import { updateRecommendations, refreshRecommendations, getRecommendationsForSelectedTrack, showAlbum } from "./music/MusicRecommendationManager";
import { MusicCommandUtil } from "./music/MusicCommandUtil";
import { showSearchInput } from "./selector/SearchSelectorManager";
import { getDeviceId, requiresSpotifyAccess } from "./music/MusicUtil";
import { MusicStateManager } from "./music/MusicStateManager";
import { connectSpotify, disconnectSpotify, switchSpotifyAccount } from "./managers/SpotifyManager";
import { displayReadmeIfNotExists } from "./managers/FileManager";
import { launchLogin, showLogInMenuOptions, showSignUpMenuOptions } from "./managers/UserStatusManager";

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
  const playlistTreeView: TreeView<PlaylistItem> = window.createTreeView("my-playlists", {
    treeDataProvider: treePlaylistProvider,
    showCollapseAll: false,
  });
  treePlaylistProvider.bindView(playlistTreeView);
  cmds.push(connectPlaylistTreeView(playlistTreeView));

  // recommended tracks tree view
  const recTreePlaylistProvider = new MusicRecommendationProvider();
  const recPlaylistTreeView: TreeView<PlaylistItem> = window.createTreeView(
    "track-recommendations",
    {
      treeDataProvider: recTreePlaylistProvider,
      showCollapseAll: false,
    }
  );
  recTreePlaylistProvider.bindView(recPlaylistTreeView);
  cmds.push(connectRecommendationPlaylistTreeView(recPlaylistTreeView));

  // REVEAL TREE CMD
  cmds.push(
    commands.registerCommand("musictime.revealTree", () => {
      treePlaylistProvider.revealTree();
    })
  );

  // DISPLAY README CMD
  cmds.push(
    commands.registerCommand("musictime.displayReadme", () => {
      displayReadmeIfNotExists(true /*override*/);
    })
  );

  // DISPLAY REPORT DASHBOARD CMD
  cmds.push(
    commands.registerCommand("musictime.displayDashboard", () => {
      displayMusicTimeMetricsMarkdownDashboard();
    })
  );

  // PLAY NEXT CMD
  cmds.push(
    commands.registerCommand("musictime.next", () => {
      controller.nextSong();
    })
  );

  // PLAY PREV CMD
  cmds.push(
    commands.registerCommand("musictime.previous", () => {
      controller.previousSong();
    })
  );

  const progressCmd = commands.registerCommand("musictime.progress", () => {
    // do nothing for now
  });
  cmds.push(progressCmd);

  // PLAY CMD
  cmds.push(
    commands.registerCommand("musictime.play", async () => {
      controller.playSong(1);
    })
  );

  // MUTE CMD
  cmds.push(
    commands.registerCommand("musictime.mute", async () => {
      controller.setMuteOn();
    })
  );

  // UNMUTE CMD
  cmds.push(
    commands.registerCommand("musictime.unMute", async () => {
      controller.setMuteOff();
    })
  );

  // REMOVE TRACK CMD
  cmds.push(
    commands.registerCommand("musictime.removeTrack", async (p: PlaylistItem) => {
      musicMgr.removeTrackFromPlaylist(p);
    })
  );

  // SHARE CMD
  cmds.push(
    commands.registerCommand("musictime.shareTrack", (node: PlaylistItem) => {
      SocialShareManager.getInstance().showMenu(node.id, node.name, false);
    })
  );

  // SEARCH CMD
  cmds.push(
    commands.registerCommand("musictime.searchTracks", () => {
      // show the search input popup
      showSearchInput();
    })
  );

  // PAUSE CMD
  cmds.push(
    commands.registerCommand("musictime.pause", () => {
      controller.pauseSong();
    })
  );

  // LIKE CMD
  cmds.push(
    commands.registerCommand("musictime.like", () => {
      controller.setLiked(true);
    })
  );

  // UNLIKE CMD
  cmds.push(
    commands.registerCommand("musictime.unlike", () => {
      controller.setLiked(false);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.shuffleOff", () => {
      controller.setShuffleOff();
    })
  );

  cmds.push(
    commands.registerCommand("musictime.shuffleOn", () => {
      controller.setShuffleOn();
    })
  );

  cmds.push(
    commands.registerCommand("musictime.muteOn", () => {
      controller.setMuteOn();
    })
  );

  cmds.push(
    commands.registerCommand("musictime.muteOff", () => {
      controller.setMuteOff();
    })
  );

  // REPEAT OFF CMD
  cmds.push(
    commands.registerCommand("musictime.repeatOn", () => {
      controller.setRepeatOnOff(true);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.repeatTrack", () => {
      controller.setRepeatTrackOn();
    })
  );

  cmds.push(
    commands.registerCommand("musictime.repeatPlaylist", () => {
      controller.setRepeatPlaylistOn();
    })
  );

  // REPEAT ON OFF CMD
  cmds.push(
    commands.registerCommand("musictime.repeatOff", () => {
      controller.setRepeatOnOff(false);
    })
  );

  // SHOW MENU CMD
  cmds.push(
    commands.registerCommand("musictime.menu", () => {
      controller.showMenu();
    })
  );

  // FOLLOW PLAYLIST CMD
  cmds.push(
    commands.registerCommand("musictime.follow", (p: PlaylistItem) => {
      musicMgr.followSpotifyPlaylist(p);
    })
  );

  // DISPLAY CURRENT SONG CMD
  cmds.push(
    commands.registerCommand("musictime.currentSong", () => {
      musicMgr.launchTrackPlayer();
    })
  );

  cmds.push(
    commands.registerCommand("musictime.songTitleRefresh", async () => {
      const deviceId = getDeviceId();
      if (!deviceId) {
        await populateSpotifyDevices(false);
      }
      MusicStateManager.getInstance().fetchTrack();
    })
  );

  // SWITCH SPOTIFY
  cmds.push(
    commands.registerCommand("musictime.switchSpotifyAccount", async () => {
      switchSpotifyAccount();
    })
  );

  // CONNECT SPOTIFY CMD
  cmds.push(
    commands.registerCommand("musictime.connectSpotify", async () => {
      connectSpotify();
    })
  );

  // CONNECT SLACK
  cmds.push(
    commands.registerCommand("musictime.connectSlack", () => {
      connectSlackWorkspace();
    })
  );

  // DISCONNECT SPOTIFY
  cmds.push(
    commands.registerCommand("musictime.disconnectSpotify", () => {
      disconnectSpotify();
    })
  );

  // DISCONNECT SLACK
  cmds.push(
    commands.registerCommand("musictime.disconnectSlack", (item:any) => {
      if (!item) {
        disconnectSlack();
      } else {
        disconnectSlackAuth(item.value);
      }
    })
  );

  // RECONCILE PLAYLIST
  // this should only be attached to the refresh button
  cmds.push(
    commands.registerCommand("musictime.refreshButton", async () => {
      // no devices found at all OR no active devices and a computer device is not found in the list
      const selectedButton = await window.showInformationMessage(
        `Reload your playlists?`,
        ...["Yes"]
      );
      if (selectedButton && selectedButton === "Yes") {
        commands.executeCommand("musictime.hardRefreshPlaylist");
      }
    })
  );

  // HARD REFRESH PLAYLIST
  // this should only be attached to the refresh button
  cmds.push(
    commands.registerCommand("musictime.hardRefreshPlaylist", async () => {
      await populateSpotifyPlaylists();
      commands.executeCommand("musictime.refreshPlaylist");
      setTimeout(() => {
        refreshRecommendations();
      }, 3000);
    })
  );

  // this should only be attached to the refresh button
  const refreshDeviceInfoCommand = commands.registerCommand(
    "musictime.refreshDeviceInfo",
    async () => {
      if (!requiresSpotifyAccess()) {
        await populateSpotifyDevices(false);
      }
    }
  );
  cmds.push(refreshDeviceInfoCommand);

  const refreshPlaylistCommand = commands.registerCommand("musictime.refreshPlaylist", async () => {
    await musicMgr.clearPlaylists();
    await musicMgr.refreshPlaylists();
    treePlaylistProvider.refresh();
  });
  cmds.push(refreshPlaylistCommand);

  // SORT TITLE COMMAND
  cmds.push(
    commands.registerCommand("musictime.sortIcon", () => {
      showSortPlaylistMenu();
    })
  );

  // OPTIONS TITLE COMMAND
  cmds.push(
    commands.registerCommand("musictime.optionsIcon", () => {
      showPlaylistOptionsMenu();
    })
  );

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

  const launchSpotifyCommand = commands.registerCommand("musictime.launchSpotify", async () => {
    musicMgr.launchTrackPlayer(PlayerName.SpotifyWeb);
  });
  cmds.push(launchSpotifyCommand);

  const launchSpotifyDesktopCommand = commands.registerCommand(
    "musictime.launchSpotifyDesktop",
    async () => {
      await musicMgr.launchTrackPlayer(PlayerName.SpotifyDesktop);
    }
  );
  cmds.push(launchSpotifyDesktopCommand);

  const launchSpotifyPlaylistCommand = commands.registerCommand("musictime.spotifyPlaylist", () =>
    musicMgr.launchTrackPlayer(PlayerName.SpotifyWeb)
  );
  cmds.push(launchSpotifyPlaylistCommand);

  const launchItunesCommand = commands.registerCommand("musictime.launchItunes", () =>
    musicMgr.launchTrackPlayer(PlayerName.ItunesDesktop)
  );
  cmds.push(launchItunesCommand);

  const launchItunesPlaylistCommand = commands.registerCommand("musictime.itunesPlaylist", () =>
    musicMgr.launchTrackPlayer(PlayerName.ItunesDesktop)
  );
  cmds.push(launchItunesPlaylistCommand);

  const launchMusicAnalyticsCommand = commands.registerCommand("musictime.launchAnalytics", () =>
    launchMusicAnalytics()
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
      await MusicCommandUtil.getInstance().runSpotifyCommand(playSpotifyDevice, [d.id]);
      setTimeout(() => {
        // refresh the tree, no need to refresh playlists
        commands.executeCommand("musictime.refreshDeviceInfo");
      }, 3000);
    }
  );
  cmds.push(deviceSelectTransferCmd);

  const genreRecListCmd = commands.registerCommand("musictime.songGenreSelector", () => {
    showGenreSelections();
  });
  cmds.push(genreRecListCmd);

  const categoryRecListCmd = commands.registerCommand("musictime.songCategorySelector", () => {
    showCategorySelections();
  });
  cmds.push(categoryRecListCmd);

  const deviceSelectorCmd = commands.registerCommand("musictime.deviceSelector", () => {
    showDeviceSelectorMenu();
  });
  cmds.push(deviceSelectorCmd);

  cmds.push(
    commands.registerCommand("musictime.refreshRecommendations", async () => {
      refreshRecommendations();
    })
  );

  const refreshRecPlaylistCommand = commands.registerCommand(
    "musictime.refreshRecommendationsTree",
    async () => {
      recTreePlaylistProvider.refresh();
    }
  );
  cmds.push(refreshRecPlaylistCommand);

  // UPDATE RECOMMENDATIONS CMD
  cmds.push(
    commands.registerCommand("musictime.updateRecommendations", (args) => {
      // there's always at least 3 args
      const label = args[0];
      const likedSongSeedLimit = args[1];
      const seed_genres = args[2];
      const features = args.length > 3 ? args[3] : {};
      updateRecommendations(label, likedSongSeedLimit, seed_genres, features);
    })
  );

  // signup button click
  cmds.push(
    commands.registerCommand("musictime.signUpAccount", async () => {
      showSignUpMenuOptions();
    })
  );

  cmds.push(
    commands.registerCommand("musictime.logInAccount", async () => {
      showLogInMenuOptions();
    })
  )

  // login button click
  cmds.push(
    commands.registerCommand("musictime.googleLogin", async () => {
      launchLogin("google", true);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.githubLogin", async () => {
      launchLogin("github", true);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.emailSignup", async () => {
      launchLogin("software", false);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.emailLogin", async () => {
      launchLogin("software", true);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.getTrackRecommendations", async (node: PlaylistItem) => {
      getRecommendationsForSelectedTrack(node);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.showAlbum", async (node: PlaylistItem) => {
      showAlbum(node);
    })
  );

  return Disposable.from(...cmds);
}
