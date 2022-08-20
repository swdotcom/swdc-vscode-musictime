import { commands, Disposable, window, ExtensionContext } from "vscode";
import { MusicControlManager } from "./music/MusicControlManager";
import { getMusicTimePluginId, launchMusicAnalytics, launchWebUrl, getPluginUuid } from "./Util";
import { PlaylistItem, PlayerName, PlayerDevice, playSpotifyDevice, TrackStatus } from "cody-music";
import { SocialShareManager } from "./social/SocialShareManager";
import { showGenreSelections, showMoodSelections } from "./selector/RecTypeSelectorManager";
import { showSortPlaylistMenu } from "./selector/SortPlaylistSelectorManager";
import { showDeviceSelectorMenu } from "./selector/SpotifyDeviceSelectorManager";
import { MusicCommandUtil } from "./music/MusicCommandUtil";
import { showSearchInput } from "./selector/SearchSelectorManager";
import { switchSpotifyAccount } from "./managers/SpotifyManager";
import { launchLogin, showLogInMenuOptions, showSignUpMenuOptions } from "./managers/UserStatusManager";
import { MusicTimeWebviewSidebar } from "./sidebar/MusicTimeWebviewSidebar";
import { SPOTIFY_LIKED_SONGS_PLAYLIST_ID } from "./Constants";
import {
  fetchTracksForLikedSongs,
  fetchTracksForPlaylist,
  followSpotifyPlaylist,
  getAlbumForTrack,
  getBestActiveDevice,
  getCachedFeaturesForRecomendations,
  getCachedRecommendationInfo,
  getCurrentRecommendations,
  getMixedAudioFeatureRecs,
  getRecommendations,
  getSelectedPlaylistId,
  getSelectedTabView,
  getSelectedTrackItem,
  getTrackByPlaylistIdAndTrackId,
  getTrackRecommendations,
  initializeSpotify,
  populateSpotifyDevices,
  refreshRecommendations,
  removeTrackFromPlaylist,
  requiresSpotifyAccess,
  updateSelectedMetricSelection,
  updateSelectedPlaylistId,
  updateSelectedTabView,
  updateSelectedTrackItem,
  updateSelectedTrackStatus,
  updateSort,
} from "./managers/PlaylistDataManager";
import { launchTrackPlayer, playSelectedItem, playSelectedItems } from "./managers/PlaylistControlManager";
import { app_endpoint, vscode_mt_issues_url } from "./Constants";
import { displayReadmeIfNotExists } from './DataController';
import { MusicCommandManager } from './music/MusicCommandManager';

const queryString = require("query-string");

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

  // PLAY NEXT CMD
  cmds.push(
    commands.registerCommand("musictime.next", async() => {
      await controller.nextSong();
      setTimeout(() => {
        commands.executeCommand("musictime.refreshMusicTimeView");
      }, 500);
    })
  );

  // PLAY PREV CMD
  cmds.push(
    commands.registerCommand("musictime.previous", async() => {
      await controller.previousSong();
      setTimeout(() => {
        commands.executeCommand("musictime.refreshMusicTimeView");
      }, 500);
    })
  );

  // PLAY CMD
  cmds.push(
    commands.registerCommand("musictime.play", async () => {
      updateSelectedTrackStatus(TrackStatus.Playing);
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
    commands.registerCommand("musictime.shareTrack", async(payload) => {
      const trackItem: PlaylistItem = await getTrackByPayload(payload);
      SocialShareManager.getInstance().showMenu(trackItem.id, trackItem.name, false);
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
    commands.registerCommand("musictime.pause", async () => {
      updateSelectedTrackStatus(TrackStatus.Paused);
      await controller.pauseSong();
      setTimeout(() => {
        commands.executeCommand("musictime.refreshMusicTimeView");
      }, 500);
    })
  );

  // LIKE CMD
  cmds.push(
    commands.registerCommand("musictime.like", async (payload) => {
      const trackItem: PlaylistItem = await getTrackByPayload(payload);
      await controller.setLiked(trackItem, true);
      setTimeout(() => {
        commands.executeCommand("musictime.refreshMusicTimeView");
      }, 500);
    })
  );

  // UNLIKE CMD
  cmds.push(
    commands.registerCommand("musictime.unlike", async (payload) => {
      const trackItem: PlaylistItem = await getTrackByPayload(payload);
      await controller.setLiked(trackItem, false);
      setTimeout(() => {
        commands.executeCommand("musictime.refreshMusicTimeView");
      }, 500);
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
    commands.registerCommand("musictime.repeatOn", async() => {
      const trackItem: PlaylistItem = getSelectedTrackItem();
      if (trackItem) {
        trackItem['repeat'] = true
        updateSelectedTrackItem(trackItem, TrackStatus.Playing);
      }
      await controller.setRepeatOnOff(true);
      setTimeout(() => {
        commands.executeCommand("musictime.refreshMusicTimeView");
      }, 500);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.repeatTrack", async () => {
      const trackItem: PlaylistItem = getSelectedTrackItem();
      if (trackItem) {
        trackItem['repeat'] = true
        updateSelectedTrackItem(trackItem, TrackStatus.Playing);
        playSelectedItem(trackItem);
      } else {
        await controller.setRepeatOnOff(true);
        setTimeout(() => {
          commands.executeCommand("musictime.refreshMusicTimeView");
        }, 500);
      }
    })
  );

  cmds.push(
    commands.registerCommand("musictime.repeatPlaylist", () => {
      controller.setRepeatPlaylistOn();
      setTimeout(() => {
        commands.executeCommand("musictime.refreshMusicTimeView");
      }, 500);
    })
  );

  // REPEAT ON OFF CMD
  cmds.push(
    commands.registerCommand("musictime.repeatOff", async () => {
      const trackItem: PlaylistItem = getSelectedTrackItem();
      if (trackItem) {
        trackItem['repeat'] = false
        updateSelectedTrackItem(trackItem, TrackStatus.Playing);
      }
      await controller.setRepeatOnOff(false);
      setTimeout(() => {
        commands.executeCommand("musictime.refreshMusicTimeView");
      }, 500);
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
    commands.registerCommand("musictime.songTitleRefresh", async() => {
      if (!getBestActiveDevice()) {
        await populateSpotifyDevices(false);
      }
      commands.executeCommand("workbench.view.extension.music-time-sidebar");
      setTimeout(async() => {
        commands.executeCommand("musictime.refreshMusicTimeView");
        MusicCommandManager.syncControls();
      }, 500);
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
      const qryStr = queryString.stringify({
        plugin_uuid: getPluginUuid(),
        plugin_id: getMusicTimePluginId()
      });

      const url = `${app_endpoint}/data_sources/integration_types/spotify}?${qryStr}`;
      launchWebUrl(url);
    })
  );

  // CONNECT SLACK
  cmds.push(
    commands.registerCommand("musictime.connectSlack", () => {
      launchWebUrl(`${app_endpoint}/data_sources/integration_types/slack`);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.connectSlackWorkspace", () => {
      launchWebUrl(`${app_endpoint}/data_sources/integration_types/slack`);
    })
  );

  // DISCONNECT SPOTIFY
  cmds.push(
    commands.registerCommand("musictime.disconnectSpotify", () => {
      launchWebUrl(`${app_endpoint}/data_sources/integration_types/spotify`);
    })
  );

  // DISCONNECT SLACK
  cmds.push(
    commands.registerCommand("musictime.disconnectSlack", (item: any) => {
      launchWebUrl(`${app_endpoint}/data_sources/integration_types/slack`);
    })
  );

  // this should only be attached to the refresh button
  cmds.push(
    commands.registerCommand("musictime.refreshDeviceInfo", async () => {
      if (!await requiresSpotifyAccess()) {
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
    commands.registerCommand("musictime.launchSpotifyDesktop", () => {
      launchTrackPlayer(PlayerName.SpotifyDesktop);
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
    commands.registerCommand("musictime.reInitializeSpotify", async() => {
      initializeSpotify();
    })
  )

  cmds.push(
    commands.registerCommand("musictime.refreshMusicTimeView", async (
      payload: any = {refreshOpenFolder: true, playlistId: getSelectedPlaylistId(), tabView: getSelectedTabView()}
    ) => {
      let reload: boolean = false;
      if (payload.playlistId) {
        if (getSelectedPlaylistId() !== payload.playlistId) {
          await fetchTracksForPlaylist(payload.playlistId)
        }
      }
      if (payload.tabView) {
        if (getSelectedTabView() !== payload.tabView) {
          reload = true;
        }
        updateSelectedTabView(payload.tabView);
      }
      const refreshOpenFolder: boolean = !!payload.refreshOpenFolder;
      mtWebviewSidebar.refresh(reload, refreshOpenFolder);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.reloadMusicTimeView", () => {
      mtWebviewSidebar.refresh(true);
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
    commands.registerCommand("musictime.getTrackRecommendations", async (payload) => {
      const trackItem: PlaylistItem = await getTrackByPayload(payload);
      getTrackRecommendations(trackItem);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.getAudioFeatureRecommendations", async () => {
      const features = await getCachedFeaturesForRecomendations();
      getMixedAudioFeatureRecs(features);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.showAlbum", async (payload) => {
      const trackItem: PlaylistItem = await getTrackByPayload(payload);
      getAlbumForTrack(trackItem);
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
    commands.registerCommand("musictime.playTrack", async (payload) => {
      const trackItem: PlaylistItem = await getTrackByPayload(payload);
      if (trackItem) {
        updateSelectedPlaylistId(trackItem["playlist_id"]);
        updateSelectedTrackStatus(TrackStatus.Playing);
        playSelectedItem(trackItem);
        commands.executeCommand(
          "musictime.refreshMusicTimeView",
          { tabView: 'playlists', playlistId: trackItem["playlist_id"],  refreshOpenFolder: true }
        );
      } else {
        commands.executeCommand("musictime.play");
      }
    })
  );

  cmds.push(
    commands.registerCommand("musictime.playPlaylist", async (items: PlaylistItem[]) => {
      updateSelectedPlaylistId(null);
      playSelectedItems(items);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.playRecommendations", async (payload: any) => {
      const recs: any = getCachedRecommendationInfo();
      // find the track index
      const offset: number = recs.tracks.findIndex(n => {
        return n.id === payload.trackId;
      });
      const slicedTracks: PlaylistItem[] = [
        ...recs.tracks.slice(offset),
        ...recs.tracks.slice(0, offset)
      ]
      await playSelectedItems(slicedTracks.slice(0, 100))
      setTimeout(async() => {
        commands.executeCommand("musictime.refreshMusicTimeView");
      }, 500);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.updateMetricSelection", async (userMetricsSelection) => {
      updateSelectedMetricSelection(userMetricsSelection);
    })
  );

  cmds.push(
    commands.registerCommand("musictime.tabSelection", async (options) => {
      const selectedTabView = options?.tab_view || 'playlists';
      if (selectedTabView === "recommendations") {
        // populate familiar recs, but don't refreshMusicTimeView
        // as the final logic will make that call
        await getCurrentRecommendations();
      } else {
        // refresh the music time view
        commands.executeCommand("musictime.refreshMusicTimeView", { tabView: selectedTabView });
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
    commands.registerCommand("musictime.addToPlaylist", async (payload) => {
      const trackItem: PlaylistItem = await getTrackByPayload(payload);
      controller.addToPlaylistMenu(trackItem);
    })
  );

  return Disposable.from(...cmds);
}

async function getTrackByPayload(payload: any = {}) {
  const playlistId = !payload?.playlistId ? getSelectedPlaylistId() : payload.playlistId;
  const trackId = !payload?.trackId ? getSelectedTrackItem()?.id : payload.trackId;
  return await getTrackByPlaylistIdAndTrackId(playlistId, trackId);
}
