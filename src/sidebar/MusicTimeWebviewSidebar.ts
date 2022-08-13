import {
  CancellationToken,
  commands,
  Disposable,
  Event,
  EventEmitter,
  Uri,
  ViewColumn,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from "vscode";
import { getItem } from "../Util";
import {getConnectionErrorHtml} from '../local/404';
import { MusicCommandManager } from "../music/MusicCommandManager";
import { appGet, isResponseOk } from '../HttpClient';
import { getConnectedSpotifyUser } from '../managers/SpotifyManager';
import { getSelectedTabView, getSelectedPlaylistId, getCachedSpotifyPlaylists, getCachedSoftwareTop40Playlist, getCachedPlaylistTracks, getUserMusicMetrics, getCachedRecommendationInfo, getSpotifyLikedPlaylist, getCachedLikedSongsTracks, getExpandedPlaylistId, updateExpandedPlaylistId, sortingAlphabetically, getSelectedTrackItem } from '../managers/PlaylistDataManager';
import { SPOTIFY_LIKED_SONGS_PLAYLIST_ID } from '../Constants';
import { PlaylistItem, TrackStatus } from 'cody-music';

export class MusicTimeWebviewSidebar implements Disposable, WebviewViewProvider {
  private _webview: WebviewView | undefined;
  private _disposable: Disposable | undefined;
  private _origHtml: string = '';

  constructor(private readonly _extensionUri: Uri) {
    //
  }

  public async refresh(reloadData: boolean, refreshOpenFolder: boolean = false) {
    if (!this._webview) {
      // its not available to refresh yet
      return;
    }
    if (!this._origHtml || reloadData) {
      this._webview.webview.html = await this.getHtml();
    } else {
      this._webview.webview.html = await this.buildPlaylistItems(this._origHtml, refreshOpenFolder);
    }
  }

  private _onDidClose = new EventEmitter<void>();
  get onDidClose(): Event<void> {
    return this._onDidClose.event;
  }

  // this is called when a view first becomes visible. This may happen when the view is first loaded
  // or when the user hides and then shows a view again
  public async resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext<unknown>, token: CancellationToken) {
    if (!this._webview) {
      this._webview = webviewView;
    }

    this._webview.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [this._extensionUri],
    };

    this._disposable = Disposable.from(this._webview.onDidDispose(this.onWebviewDisposed, this));

    this._webview.webview.onDidReceiveMessage(async (message) => {
      if (message?.action) {
        const cmd = message.action.includes('musictime.') ? message.action : `musictime.${message.action}`;
        switch (message.command) {
          case 'command_execute':
            if (message.payload && Object.keys(message.payload).length) {
              commands.executeCommand(cmd, message.payload);
            } else {
              commands.executeCommand(cmd);
            }
            break;
        }
      }
    });

    this.loadWebview();
  }

  private async loadWebview(tries = 10) {
    const musicInitialized = MusicCommandManager.isInitialized();
    // make sure the jwt is available. The session info may have
    // been removed while this view was open.
    if ((getItem("jwt") && musicInitialized) || tries <= 0) {
      this._webview.webview.html = await this.getHtml();
    } else {
      tries--;
      setTimeout(() => {
        this.loadWebview(tries);
      }, 2000);
    }
  }

  dispose() {
    this._disposable && this._disposable.dispose();
  }

  private onWebviewDisposed() {
    this._onDidClose.fire();
  }

  get viewColumn(): ViewColumn | undefined {
    // this._view._panel.viewColumn;
    return undefined;
  }

  get visible() {
    return this._webview ? this._webview.visible : false;
  }

  private async getHtml(): Promise<string> {
    const params = {
      nav_view: getSelectedTabView()
    };
    const resp = await appGet('/plugin/sidebar', params);
    if (isResponseOk(resp)) {
      this._origHtml = resp.data;
      return await this.buildPlaylistItems(this._origHtml);
    }

    return await getConnectionErrorHtml();
  }

  private async buildPlaylistItems(html: string, refreshOpenFolder: boolean = false) {
    const spotifyUser = await getConnectedSpotifyUser();
    const selectedTabView = getSelectedTabView();
    const playlistId = getSelectedPlaylistId();
    const data: any = await this.getViewData(selectedTabView, playlistId, spotifyUser);

    let tracks = [];
    if (playlistId) {
      if (playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
        tracks = data.likedTracks;
      } else {
        tracks = data.playlistTracks[playlistId];
      }
    }

    let sidebarContent = '';
    if (selectedTabView === 'playlists' && data?.spotifyPlaylists?.length) {
      const likedFolder = this.buildPlaylistItem(data.likedPlaylistItem, playlistId, tracks, refreshOpenFolder);
      const playlistFolders = data.spotifyPlaylists.map(
        (item: any) => this.buildPlaylistItem(item, playlistId, tracks, refreshOpenFolder)
      ).join('\n')
      sidebarContent = this.buildPlaylistSidebar(likedFolder, playlistFolders);
    } else if (selectedTabView === 'recommendations') {
      const tracksHtml: string = this.buildRecommendationTracks(data.recommendationInfo);
      sidebarContent = this.buildRecommendationSidebar(data.recommendationInfo.label, tracksHtml);
    }

    html = html.replace('__playlist_items_placeholder__', sidebarContent);
    return html;
  }

  private buildPlaylistSidebar(likedFolder, playlistFolders) {
    return `<div class="divide-y dark:divide-gray-100 dark:divide-opacity-25">
      <div class="flex flex-col w-full pb-2">
        <div class="flex justify-between items-center space-x-2 mt-2">
          <div class="text-xs font-semibold">Playlists</div>
          <div class="flex items-center space-x-2">
            ${this.getSearchIconButton()}
            ${this.getSortButton()}
          </div>
        </div>
        ${likedFolder}
      </div>
      <div class="flex flex-col pt-2">
        ${playlistFolders}
      </div>
    </div>`
  }

  private buildRecommendationSidebar(label: string, tracksHtml: string) {
    return `<div class="flex flex-col w-full space-x-2">
      <div class="text-xs font-semibold p-2">${label}</div>
      ${tracksHtml}
    </div>`;
  }

  private getSearchIconButton() {
    return `<button type="button" onclick="onCmdClick('searchTracks')"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
      </svg>
    </button>`
  }

  private getSortButton() {
    if (sortingAlphabetically()) {
      return this.getSortByCreationButton();
    }
    return this.getSortAlphaButton();
  }

  private getSortAlphaButton() {
    return `<button type="button" onclick="onCmdClick('sortAlphabetically')"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
      </svg>
    </button>`
  }

  private getSortByCreationButton() {
    return `<button type="button" onclick="onCmdClick('sortToOriginal')"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 48 48" fill="none">
        <rect class="h-5 w-5 text-gray-400" fill="white" fill-opacity="0.01"/>
        <path d="M6 5V30.0036H42V5" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M30 37L24 43L18 37" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M24 30V43" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18.9604 10.9786L23.9972 15.9928L18.9604 21.0903" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M29 10.002V22.0001" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      </svg>
    </button>`
  }

  private buildPlaylistItem(item: any, playlistId: any, tracks: any, refreshOpenFolder: boolean = false) {
    let chevronSvg = this.getChevronRight();
    let tracksHtml = '';
    if (item.id === playlistId) {
      if ((getExpandedPlaylistId() !== playlistId) || getExpandedPlaylistId() === playlistId && refreshOpenFolder) {
        // expand or refresh
        updateExpandedPlaylistId(playlistId);
        chevronSvg = this.getChevronDown();

        if (tracks.length) {
          const selectedTrackItem:PlaylistItem = getSelectedTrackItem();
          tracksHtml = [
            '<div class="pl-2 -m-1">',
            ...tracks.map((item: any) => this.buildTrackItem(item, playlistId)),
            '</div>'
          ].join('\n');
        }
      } else {
        // clear it
        updateExpandedPlaylistId('')
      }
    }
    return `
      <div class="flex flex-col">
        <div class="w-full flex justify-between items-center py-1">
          <button type="button" onclick="onCmdClick('refreshMusicTimeView', { tabView: 'playlists', playlistId: '${item.id}' })"
            class="flex truncate items-center space-x-2 focus:outline-none">
            ${chevronSvg}
            <span class="truncate text-xs hover:text-green-500">${item.name}</span>
          </button>
        </div>
        ${tracksHtml}
      </div>`
  }

  private buildRecommendationTracks(recommendationInfo: any) {
    return [
      '<div class="py-2">',
      ...recommendationInfo.tracks.map((item: any) => this.buildRecommendationTrackItem(item)),
      '</div>'
    ].join('\n');
  }

  private buildTrackItem(item: any, playlistId: string = '') {
    const trackPlaylistId = `${item.id}_${playlistId}`;
    return `<div data-track-container="${trackPlaylistId}" class="w-full flex justify-between items-center">
      <button onclick="onCmdClick('playTrack', { playlistId: '${playlistId}', trackId: '${item.id}' })"
        data-track-id="${trackPlaylistId}"
        data-name="trackItem"
        class="w-full flex truncate items-center pl-2 p-1 space-x-2 focus:outline-none">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-green-600" viewBox="0 0 20 20" fill="currentColor">
          <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
        </svg>
        <span class="text-xs truncate hover:text-green-500">
          ${item.name}
        </span>
      </button>
      ${this.getDotsVerticalMenuButton(playlistId, item.id, item.name)}
    </div>`
  }

  private buildRecommendationTrackItem(item: any) {
    return `<div class="w-full flex justify-between items-center">
      <button onclick="onCmdClick('playRecommendations', { trackId: '${item.id}' })"
        class="w-full flex truncate items-center pl-2 p-1 space-x-2 focus:outline-none">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-green-600" viewBox="0 0 20 20" fill="currentColor">
          <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
        </svg>
        <span class="text-xs truncate hover:text-green-500">
          ${item.name}
        </span>
      </button>
      ${this.getDotsVerticalMenuButton(item.id)}
    </div>`
  }

  private getChevronDown() {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
    </svg>`;
  }

  private getChevronRight() {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
    </svg>`;
  }

  private getDotsVerticalMenuButton(playlistId, trackId, trackName) {
    const trackPlaylistId = `${trackId}_${playlistId}`;
    return `<div class="hidden relative inline-block text-left" id="${trackPlaylistId}">
      <div>
        <button
          data-track-id="${trackPlaylistId}"
          id="menu-button"
          type="button"
          class="rounded-full flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
          data-action="click->plugin--music-time--sidebar#toggleTrackOptions"
          aria-expanded="true" aria-haspopup="true">
          <span class="sr-only">Track menu</span>
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>

      <div class="hidden origin-top-right absolute right-0 mt-2 rounded-lg shadow-lg bg-white dark:bg-gray-900 focus:outline-none"
        id="${trackPlaylistId}_options"
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="menu-button"
        tabindex="-1">
        <div class="p-1 divide-y divide-gray-100 focus:outline-none" role="none" data-track-options-id="${trackPlaylistId}">
          <div class="py-1" role="none">
            <a href class="rounded block px-4 py-2 text-sm focus:outline-none"
              role="menuitem" tabindex="-1" id="menu-item-0">${trackName}</a>
          </div>
          <div class="py-1" role="none">
            <a href class="rounded block px-4 py-2 text-sm focus:outline-none"
              role="menuitem" tabindex="-1" id="menu-item-1">Show album</a>
            <a href class="rounded block px-4 py-2 text-sm focus:outline-none"
              onclick="onCmdClick('getTrackRecommendations', { trackId: '${trackId}', playlistId: '${playlistId}' })"
              role="menuitem" tabindex="-1" id="menu-item-2">Get recommendations</a>
            <a href class="rounded block px-4 py-2 text-sm focus:outline-none"
              role="menuitem" tabindex="-1" id="menu-item-1">Repeat track</a>
            <a href class="rounded block px-4 py-2 text-sm focus:outline-none"
              role="menuitem" tabindex="-1" id="menu-item-2">Share track</a>
            <a href class="rounded block px-4 py-2 text-sm focus:outline-none"
              role="menuitem" tabindex="-1" id="menu-item-2">Add to playlist</a>
          </div>
        </div>
      </div>
    </div>`
  }

  private async getViewData(selectedTabView, playlist_id, spotifyUser) {
    let playlistTracks = {};
    let spotifyPlaylists = [];
    let softwareTop40Playlist = undefined;
    let selectedPlaylistId = undefined;
    let userMusicMetrics = [];
    let globalMusicMetrics = [];
    let audioFeatures = [];
    let averageMusicMetrics = undefined;
    let recommendationInfo = [];
    let musicScatterData = undefined;
    let likedPlaylistItem = getSpotifyLikedPlaylist();
    let likedTracks = [];

    if (spotifyUser?.id) {
      if (selectedTabView === "playlists") {
        playlistTracks = getCachedPlaylistTracks();
        const softwareTop40PlaylistP = getCachedSoftwareTop40Playlist();
        const spotifyPlaylistsP = getCachedSpotifyPlaylists();
        const likedTracksP = getCachedLikedSongsTracks();
        softwareTop40Playlist = await softwareTop40PlaylistP ?? [];
        spotifyPlaylists = await spotifyPlaylistsP ?? [];
        likedPlaylistItem.tracks.total = spotifyPlaylists.length || 1;
        likedTracks = await likedTracksP;

        selectedPlaylistId = playlist_id ? playlist_id : getSelectedPlaylistId();
      } else if (selectedTabView === "metrics") {
        const metricsData = await getUserMusicMetrics();
        userMusicMetrics = metricsData.userMusicMetrics ?? [];
        globalMusicMetrics = metricsData.globalMusicMetrics ?? [];
        averageMusicMetrics = metricsData.averageMusicMetrics ?? [];
        audioFeatures = metricsData.audioFeatures ?? [];
        musicScatterData = metricsData.musicScatterData;
      } else if (selectedTabView === "recommendations") {
        recommendationInfo = getCachedRecommendationInfo();
      }
    }

    return {
      playlistTracks,
      likedPlaylistItem,
      likedTracks,
      spotifyPlaylists,
      softwareTop40Playlist,
      selectedPlaylistId,
      userMusicMetrics,
      audioFeatures,
      globalMusicMetrics,
      musicScatterData,
      averageMusicMetrics,
      recommendationInfo,
    };
  }
}
