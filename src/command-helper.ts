import { commands, Disposable, window, ExtensionContext } from "vscode";
import {
  MusicControlManager,
  displayMusicTimeMetricsMarkdownDashboard,
} from "./music/MusicControlManager";
import { launchMusicAnalytics, launchWebUrl } from "./Util";
import { PlaylistItem, PlayerName, PlayerDevice, playSpotifyDevice } from "cody-music";
import { SocialShareManager } from "./social/SocialShareManager";
import { connectSlackWorkspace, disconnectSlack, disconnectSlackAuth } from "./managers/SlackManager";
import { MusicManager } from "./music/MusicManager";
import { showGenreSelections, showMoodSelections } from "./selector/RecTypeSelectorManager";
import {
  showSortPlaylistMenu,
  showPlaylistOptionsMenu,
} from "./selector/SortPlaylistSelectorManager";
import { showDeviceSelectorMenu } from "./selector/SpotifyDeviceSelectorManager";
import { MusicCommandUtil } from "./music/MusicCommandUtil";
import { showSearchInput } from "./selector/SearchSelectorManager";
import { getBestActiveDevice, requiresSpotifyAccess } from "./music/MusicUtil";
import { MusicStateManager } from "./music/MusicStateManager";
import { connectSpotify, disconnectSpotify, switchSpotifyAccount } from "./managers/SpotifyManager";
import { displayReadmeIfNotExists } from "./managers/FileManager";
import { launchLogin, showLogInMenuOptions, showSignUpMenuOptions } from "./managers/UserStatusManager";
import { MusicTimeWebviewSidebar } from './sidebar/MusicTimeWebviewSidebar';
import { SPOTIFY_LIKED_SONGS_PLAYLIST_ID, vscode_mt_issues_url } from './Constants';
import { fetchTracksForLikedSongs, fetchTracksForPlaylist, getAlbumForTrack, getCachedRecommendationInfo, getCachedUserMusicMetrics, getFamiliarRecs, getMixedAudioFeatureRecs, getRecommendations, getTrackRecommendations, getUserMusicMetrics, populateSpotifyDevices, updateSelectedTabView, updateSort } from './managers/PlaylistDataManager';
import { launchTrackPlayer, playSelectedItem } from './managers/PlaylistControlManager';

/**
 * add the commands to vscode....
 */
export function createCommands(ctx: ExtensionContext): {
  dispose: () => void;
} {
  let cmds = [];

  const controller: MusicControlManager = MusicControlManager.getInstance();
  const musicMgr: MusicManager = MusicManager.getInstance();


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
      launchTrackPlayer();
    })
  );

  cmds.push(
    commands.registerCommand("musictime.songTitleRefresh", async () => {
      const device = getBestActiveDevice();
      if (!device) {
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

  // OPTIONS TITLE COMMAND
  cmds.push(
    commands.registerCommand("musictime.optionsIcon", () => {
      showPlaylistOptionsMenu();
    })
  );


  cmds.push(
    commands.registerCommand("musictime.launchSpotify", () => {
      launchTrackPlayer(PlayerName.SpotifyWeb);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.spotifyPlaylist", () => {
      launchTrackPlayer(PlayerName.SpotifyWeb);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.laulaunchSpotifyDesktopnchSpotify", () => {
      launchTrackPlayer(PlayerName.SpotifyDesktop);
    })
  );

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

  const categoryRecListCmd = commands.registerCommand("musictime.songMoodSelector", () => {
    showMoodSelections();
  });
  cmds.push(categoryRecListCmd);

  const deviceSelectorCmd = commands.registerCommand("musictime.deviceSelector", () => {
    showDeviceSelectorMenu();
  });
  cmds.push(deviceSelectorCmd);

  // UPDATE RECOMMENDATIONS CMD
  cmds.push(
    commands.registerCommand("musictime.updateRecommendations", (args) => {
      // there's always at least 3 args
      const label = args[0];
      const likedSongSeedLimit = args[1];
      const seed_genres = args[2];
      const features = args.length > 3 ? args[3] : {};

      getRecommendations(label, likedSongSeedLimit, seed_genres, features);
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

  // WEB VIEW PROVIDER
  const mtWebviewSidebar: MusicTimeWebviewSidebar = new MusicTimeWebviewSidebar(ctx.extensionUri);
  cmds.push(
    window.registerWebviewViewProvider("musictime.webView", mtWebviewSidebar, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );

  cmds.push(
    commands.registerCommand("musictime.refreshMusicTimeView", (tabView: undefined) => {
      mtWebviewSidebar.refresh(tabView);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.submitAnIssue", () => {
      launchWebUrl(vscode_mt_issues_url);
    })
  );

  // SORT TITLE COMMAND
  cmds.push(
    commands.registerCommand("musictime.sortIcon", () => {
      showSortPlaylistMenu();
    })
  );

  cmds.push(
    commands.registerCommand("musictime.sortAlphabetically", async () => {
      updateSort(true);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.sortToOriginal", async () => {
      updateSort(false);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.getTrackRecommendations", async (node: PlaylistItem) => {
      getTrackRecommendations(node);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.getAudioFeatureRecommendations", async (features: any) => {
      getMixedAudioFeatureRecs(features);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.showAlbum", async (node: PlaylistItem) => {
      getAlbumForTrack(node);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.fetchPlaylistTracks", async (playlist_id) => {
      if (playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
        fetchTracksForLikedSongs();
      } else {
        fetchTracksForPlaylist(playlist_id);
      }
    })
  );

  cmds.push(
    commands.registerCommand("musictime.playTrack", async (item:PlaylistItem) => {
      playSelectedItem(item);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.updateSelectedTabView", async (tabView: string) => {
      if (tabView === "recommendations" && !getCachedRecommendationInfo()) {
        // populate familiar recs
        await getFamiliarRecs();
      } else if (tabView === "metrics" && !getCachedUserMusicMetrics()) {
        // populate the user music metrics
        await getUserMusicMetrics();
      }
      updateSelectedTabView(tabView);
      commands.executeCommand("musictime.refreshMusicTimeView");
    })
  );

  cmds.push(
    commands.registerCommand("musictime.installCodeTime", async (item:PlaylistItem) => {
      launchWebUrl("vscode:extension/softwaredotcom.swdc-vscode");
    })
  );

  cmds.push(
    commands.registerCommand("musictime.displaySidebar", () => {
      // logic to open the sidebar (need to figure out how to reveal the sidebar webview)
      commands.executeCommand("workbench.view.extension.music-time-sidebar");
    })
  );

  return Disposable.from(...cmds);
}
