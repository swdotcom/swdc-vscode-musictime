import { commands, Disposable, window, ExtensionContext } from "vscode";
import { MusicControlManager, displayMusicTimeMetricsMarkdownDashboard } from "./music/MusicControlManager";
import { launchMusicAnalytics, launchWebUrl } from "./Util";
import { PlaylistItem, PlayerName, PlayerDevice, playSpotifyDevice } from "cody-music";
import { SocialShareManager } from "./social/SocialShareManager";
import { connectSlackWorkspace, disconnectSlack, disconnectSlackAuth } from "./managers/SlackManager";
import { showGenreSelections, showMoodSelections } from "./selector/RecTypeSelectorManager";
import { showSortPlaylistMenu } from "./selector/SortPlaylistSelectorManager";
import { showDeviceSelectorMenu } from "./selector/SpotifyDeviceSelectorManager";
import { MusicCommandUtil } from "./music/MusicCommandUtil";
import { showSearchInput } from "./selector/SearchSelectorManager";
import { MusicStateManager } from "./music/MusicStateManager";
import { connectSpotify, disconnectSpotify, switchSpotifyAccount } from "./managers/SpotifyManager";
import { displayReadmeIfNotExists } from "./managers/FileManager";
import { launchLogin, showLogInMenuOptions, showSignUpMenuOptions } from "./managers/UserStatusManager";
import { MusicTimeWebviewSidebar } from "./sidebar/MusicTimeWebviewSidebar";
import { SPOTIFY_LIKED_SONGS_PLAYLIST_ID } from "./app/utils/view_constants";
import {
  fetchTracksForLikedSongs,
  fetchTracksForPlaylist,
  followSpotifyPlaylist,
  getAlbumForTrack,
  getBestActiveDevice,
  getCurrentRecommendations,
  getMixedAudioFeatureRecs,
  getRecommendations,
  getTrackRecommendations,
  populateSpotifyDevices,
  refreshRecommendations,
  removeTrackFromPlaylist,
  requiresSpotifyAccess,
  updateSelectedPlaylistId,
  updateSelectedTabView,
  updateSort,
} from "./managers/PlaylistDataManager";
import { launchTrackPlayer, playSelectedItem } from "./managers/PlaylistControlManager";
import { vscode_mt_issues_url } from "./Constants";

/**
 * add the commands to vscode....
 */
export function createCommands(
  ctx: ExtensionContext
): {
  dispose: () => void;
} {
  let cmds = [];

  const controller: MusicControlManager = MusicControlManager.getInstance();

  // DISPLAY README CMD
  cmds.push(
    commands.registerCommand("musictime.launchReadme", () => {
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
      removeTrackFromPlaylist(p);
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
    commands.registerCommand("musictime.like", (track: any) => {
      controller.setLiked(track, true);
    })
  );

  // UNLIKE CMD
  cmds.push(
    commands.registerCommand("musictime.unlike", (track: any) => {
      controller.setLiked(track, false);
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
      followSpotifyPlaylist(p);
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
    commands.registerCommand("musictime.disconnectSlack", (item: any) => {
      if (!item) {
        disconnectSlack();
      } else {
        disconnectSlackAuth(item.value);
      }
    })
  );

  // this should only be attached to the refresh button
  cmds.push(
    commands.registerCommand("musictime.refreshDeviceInfo", async () => {
      if (!requiresSpotifyAccess()) {
        await populateSpotifyDevices(false);
      }
    })
  );

  cmds.push(
    commands.registerCommand("musictime.launchSpotify", () => {
      launchTrackPlayer(PlayerName.SpotifyWeb);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.launchAnalytics", () => {
      launchMusicAnalytics();
    })
  );

  const deviceSelectTransferCmd = commands.registerCommand("musictime.transferToDevice", async (d: PlayerDevice) => {
    // transfer to this device
    window.showInformationMessage(`Connected to ${d.name}`);
    await MusicCommandUtil.getInstance().runSpotifyCommand(playSpotifyDevice, [d.id]);
    setTimeout(() => {
      // refresh the tree, no need to refresh playlists
      commands.executeCommand("musictime.refreshDeviceInfo");
    }, 3000);
  });
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

  cmds.push(
    commands.registerCommand("musictime.refreshRecommendations", (args) => {
      refreshRecommendations();
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
  );

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
    commands.registerCommand("musictime.refreshMusicTimeView", (tab_view: undefined, playlist_id: undefined, loading = false) => {
      mtWebviewSidebar.refresh(tab_view, playlist_id, loading);
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
    commands.registerCommand("musictime.showAlbum", async (item: PlaylistItem) => {
      getAlbumForTrack(item);
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
    commands.registerCommand("musictime.updateSelectedPlaylist", async (playlist_id) => {
      updateSelectedPlaylistId(playlist_id);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.playTrack", async (item: PlaylistItem) => {
      updateSelectedPlaylistId(item["playlist_id"]);
      playSelectedItem(item);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.updateSelectedTabView", async (tabView: string) => {
      updateSelectedTabView(tabView);
      if (tabView === "recommendations") {
        // populate familiar recs, but don't refreshMusicTimeView
        // as the final logic will make that call
        await getCurrentRecommendations();
      } else {
        // refresh the music time view
        commands.executeCommand("musictime.refreshMusicTimeView");
      }
    })
  );

  cmds.push(
    commands.registerCommand("musictime.installCodeTime", async (item: PlaylistItem) => {
      launchWebUrl("vscode:extension/softwaredotcom.swdc-vscode");
    })
  );

  cmds.push(
    commands.registerCommand("musictime.displaySidebar", () => {
      // logic to open the sidebar (need to figure out how to reveal the sidebar webview)
      commands.executeCommand("workbench.view.extension.music-time-sidebar");
    })
  );

  cmds.push(
    commands.registerCommand("musictime.addToPlaylist", async (p: PlaylistItem) => {
      controller.addToPlaylistMenu(p);
    })
  );

  return Disposable.from(...cmds);
}
