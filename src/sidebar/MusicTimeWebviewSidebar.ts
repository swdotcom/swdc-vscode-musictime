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
import { getConnectionErrorHtml } from '../local/404';
import { getLoadingHtml } from '../local/Loading';
import { MusicCommandManager } from "../music/MusicCommandManager";
import { appGet, isResponseOk } from '../HttpClient';
import { getConnectedSpotifyUser, hasSpotifyUser } from '../managers/SpotifyManager';
import { getSelectedTabView, getSelectedPlaylistId, getCachedSpotifyPlaylists, getCachedSoftwareTop40Playlist, getCachedPlaylistTracks, getUserMusicMetrics, getCachedRecommendationInfo, getSpotifyLikedPlaylist, getCachedLikedSongsTracks, getExpandedPlaylistId, updateExpandedPlaylistId, sortingAlphabetically, getSelectedTrackItem, getPlayerContext, getCurrentDevices } from '../managers/PlaylistDataManager';
import { SPOTIFY_LIKED_SONGS_PLAYLIST_ID } from '../Constants';
import { PlayerContext, PlaylistItem } from 'cody-music';

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
    if (hasSpotifyUser() && !this._origHtml) {
      this._webview.webview.html = await getLoadingHtml();
    }

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
      sidebarContent = this.buildPlaylistSidebar(likedFolder, playlistFolders, data.playerContext);
    } else if (selectedTabView === 'recommendations') {
      const tracksHtml: string = this.buildRecommendationTracks(data.recommendationInfo);
      sidebarContent = this.buildRecommendationSidebar(data.recommendationInfo.label, tracksHtml);
    } else if (selectedTabView === 'metrics') {
      sidebarContent = '<p class="flex items-center justify-center p-4">Music Time metrics coming soon.</p>'
    }

    html = html.replace('__playlist_items_placeholder__', sidebarContent);
    return html;
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
            <span class="truncate text-xs hover:text-blue-500">${item.name}</span>
          </button>
        </div>
        ${tracksHtml}
      </div>`
  }

  private buildPlaylistSidebar(likedFolder, playlistFolders, playerContext) {
    return `<div class="divide-y dark:divide-gray-100 dark:divide-opacity-25">
      <div class="flex flex-col w-full pb-2">
        <div class="flex justify-between items-center space-x-2 mt-2">
          <div class="text-xs font-semibold">Playlists</div>
          <div class="flex items-center space-x-2">
            ${this.getTrackControlButton(playerContext)}
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

  private buildRecommendationTracks(recommendationInfo: any) {
    return [
      '<div class="py-2">',
      ...recommendationInfo.tracks.map((item: any) => this.buildRecommendationTrackItem(item)),
      '</div>'
    ].join('\n');
  }

  private buildTrackItem(track: any, playlistId: string = '') {
    const trackPlaylistId = `${track.id}_${playlistId}`;
    return `<div data-track-container="${trackPlaylistId}" class="w-full flex justify-between">
      <button onclick="onCmdClick('playTrack', { playlistId: '${playlistId}', trackId: '${track.id}' })"
        data-track-id="${trackPlaylistId}"
        data-name="trackItem"
        class="w-full truncate pl-2 p-1 focus:outline-none">
        <div class="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
          </svg>
          <p class="text-xs hover:text-blue-500">
            ${track.name}
          </p>
        </div>
        <p class="text-left text-xs text-gray-500 font-medium">${track['description']}</p>
      </button>
      ${this.getDotsVerticalMenuButton(track, playlistId)}
    </div>`
  }

  private buildRecommendationTrackItem(track: PlaylistItem) {
    return `<div class="w-full flex justify-between items-center">
      <button onclick="onCmdClick('playRecommendations', { trackId: '${track.id}' })"
        class="w-full truncate pl-2 p-1 focus:outline-none">
        <div class="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
          </svg>
          <p class="text-xs hover:text-blue-500">
            ${track.name}
          </p>
        </div>
        <p class="text-left text-xs text-gray-500 font-medium">${track['description']}</p>
      </button>
      ${this.getDotsVerticalMenuButton(track)}
    </div>`
  }

  private getChevronDown() {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
    </svg>`;
  }

  private getChevronRight() {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
    </svg>`;
  }

  private getDotsVerticalMenuButton(track: PlaylistItem, playlistId = '') {
    const trackPlaylistId = `${track.id}_${playlistId}`;
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

      <div
        class="hidden w-64 border border-gray-500 origin-top-right absolute right-0 mt-2 rounded-lg shadow-lg bg-gray-50 dark:bg-gray-900 focus:outline-none"
        style="--tw-border-opacity: 0.5;"
        id="${trackPlaylistId}_options"
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="menu-button"
        tabindex="-1">
        <div
          class="text-sm p-1 space-y-2 divide-y focus:outline-none" role="none" data-track-options-id="${trackPlaylistId}">
          <div class="pl-1 pr-2 py-2" role="none">
            <p class="text-sm text-blue-500">${track.name}</p>
            <p class="text-xs text-gray-500 font-medium">${track['description']}</p>
          </div>
          <div class="pl-1 pr-2" role="none">
            <a href class="rounded block py-2 text-sm focus:outline-none"
              onclick="onCmdClick('showAlbum', { trackId: '${track.id}', playlistId: '${playlistId}' })"
              role="menuitem" tabindex="-1" id="menu-item-1">Show album</a>
            <a href class="rounded block py-2 text-sm focus:outline-none"
              onclick="onCmdClick('getTrackRecommendations', { trackId: '${track.id}', playlistId: '${playlistId}' })"
              role="menuitem" tabindex="-1" id="menu-item-2">Get recommendations</a>
            <a href class="rounded block py-2 text-sm focus:outline-none"
              onclick="onCmdClick('repeatTrack', { trackId: '${track.id}', playlistId: '${playlistId}' })"
              role="menuitem" tabindex="-1" id="menu-item-1">Repeat track</a>
            <a href class="rounded block py-2 text-sm focus:outline-none"
              onclick="onCmdClick('shareTrack', { trackId: '${track.id}', playlistId: '${playlistId}' })"
              role="menuitem" tabindex="-1" id="menu-item-2">Share track</a>
            <a href class="rounded block py-2 text-sm focus:outline-none"
              onclick="onCmdClick('addToPlaylist', { trackId: '${track.id}', playlistId: '${playlistId}' })"
              role="menuitem" tabindex="-1" id="menu-item-2">Add to playlist</a>
          </div>
        </div>
      </div>
    </div>`
  }

  private getSearchIconButton() {
    return `<button type="button" onclick="onCmdClick('searchTracks')"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
      </svg>
    </button>`
  }

  private getTrackControlButton(playerContext: PlayerContext) {
    return `<div class="relative inline-block text-left">
      <div>
        <button
          id="track-control-button"
          type="button"
          class="rounded-full flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
          data-action="click->plugin--music-time--sidebar#toggleTrackControl"
          aria-expanded="true" aria-haspopup="true">
          <span class="sr-only">Track control</span>
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" class="h-5 w-5 text-gray-400" viewBox="0 0 1000 1000" enable-background="new 0 0 1000 1000" xml:space="preserve">
            <g><g>
              <path fill="currentColor" d="M10,315.6v368.8c0,64.1,45,90.2,100.6,58.3l322.6-185c55.6-31.9,55.6-83.5,0-115.4l-322.6-185C55,225.5,10,251.6,10,315.6z"/>
              <path fill="currentColor" d="M506.8,324.1v351.8c0,64,35.2,116,78.6,116c43.4,0,78.5-51.9,78.5-116V324.1c0-64-35.2-116-78.5-116C541.9,208.1,506.8,260.1,506.8,324.1z"/>
              <path fill="currentColor" d="M832.8,324.1v351.8c0,64,35.2,116,78.6,116c43.4,0,78.6-51.9,78.6-116V324.1c0-64-35.2-116-78.6-116C868,208.1,832.8,260.1,832.8,324.1z"/>
            </g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g></g>
          </svg>
        </button>
      </div>

      <div data-plugin--music-time--sidebar-target="trackControlMenu"
        class="hidden w-64 border border-gray-500 origin-top-right absolute right-0 mt-2 rounded-lg shadow-lg bg-gray-50 dark:bg-gray-900 focus:outline-none"
        style="--tw-border-opacity: 0.5;"
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="track-control-button"
        tabindex="-1">
        <div
          class="text-sm p-1 space-y-2 divide-y focus:outline-none" role="none">
          <!-- show the player if we have it, otherwise, show the player select menu item -->
          <div class="pl-1 pr-2 py-2 space-y-2" role="none">
            ${this.getDeviceItemInfoHtml(playerContext)}
          </div>
          <div class="pl-1 pr-2 py-2 space-y-2" role="none">
            ${this.getPlayingTrackItemHtml(playerContext)}
            ${this.getPlayControlButtonsItemHtml(playerContext)}
          </div>
        </div>
      </div>
    </div>`
  }

  private getDeviceItemInfoHtml(playerContext: PlayerContext) {
    let infoText = 'Connect to a Spotify device.'
    if (playerContext?.device?.name) {
      infoText = `Listening on your ${playerContext.device.name}`
    }

    return `<p class="text-xs text-gray-500 font-medium">${infoText}</p>
      <a href class="rounded py-2 text-xs focus:outline-none"
        onclick="onCmdClick('deviceSelector')">
        Launch the web or desktop player.
      </a>`
  }

  private getPlayingTrackItemHtml(playerContext: PlayerContext) {
    if (playerContext?.item?.name) {
      return `<p class="text-sm text-blue-500">${playerContext.item.name}</p>
      <p class="text-xs text-gray-500 font-medium">${playerContext.item.artist}</p>`
    }
    return `<p class="text-xs text-gray-500 font-medium">Click play.</p>`
  }

  private getPlayControlButtonsItemHtml(playerContext: PlayerContext) {
    this.getRepeatButton(playerContext);
    return `<div class="flex items-center justify-center space-x-2">
      ${this.getPreviousButton()}
      ${this.getPlayPauseButton(playerContext)}
      ${this.getNextButton()}
      ${this.getRepeatButton(playerContext)}
    </div>`
  }

  private getSortButton() {
    if (sortingAlphabetically()) {
      return this.getSortByCreationButton();
    }
    return this.getSortAlphaButton();
  }

  private getSortAlphaButton() {
    return `<button type="button" onclick="onCmdClick('sortAlphabetically')" title="Sort alphabetically"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
      </svg>
    </button>`
  }

  private getSortByCreationButton() {
    return `<button type="button" onclick="onCmdClick('sortToOriginal')" title="Sort by date created"
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

  private getPlayPauseButton(playerContext: PlayerContext) {
    if (!playerContext || !playerContext.is_playing) {
      return this.getPlayButton(playerContext)
    }
    return this.getPauseButton();
  }

  private getPauseButton() {
    return `<button type="button" onclick="onCmdClick('pause')" title="Pause"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>`
  }

  private getPlayButton(playerContext: PlayerContext) {
    let cmd = `onCmdClick('play')`
    if (playerContext?.item?.id) {
      cmd = `onCmdClick('playTrack', { trackId: '${playerContext.item.id}' })`
    }
    return `<button type="button" onclick="${cmd}" title="Play"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>`
  }

  private getPreviousButton() {
    return `<button type="button" onclick="onCmdClick('previous')" title="Previous"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
      </svg>
    </button>`
  }

  private getNextButton() {
    return `<button type="button" onclick="onCmdClick('next')" title="Next"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
      </svg>
    </button>`
  }

  private getRepeatButton(playerContext: PlayerContext) {
    if (!playerContext || playerContext.repeat_state !== "track") {
      // show the repeat once button
      return `<button type="button" onclick="onCmdClick('repeatTrack', { trackId: '${playerContext.item.id}' })" title="Repeat track"
        class="relative font-medium focus:outline-none">
        Repeat
      </button>`
    }
    // show the repeat disable button
    return `<button type="button" onclick="onCmdClick('repeatOff')" title="Disable repeat"
      class="relative font-medium focus:outline-none">
      Repeating
    </button>`
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
    let playerContext: PlayerContext = undefined;

    if (spotifyUser?.id) {
      const playerContextP = getPlayerContext();
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
      playerContext = await playerContextP;
    }

    return {
      playlistTracks,
      playerContext,
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
