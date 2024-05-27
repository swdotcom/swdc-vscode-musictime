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
import { getImage, getItem } from "../Util";
import { getConnectionErrorHtml } from '../local/404';
import { getLoadingHtml } from '../local/Loading';
import { MusicCommandManager } from "../music/MusicCommandManager";
import { appGet, isResponseOk } from '../HttpClient';
import { getConnectedSpotifyUser, hasSpotifyUser } from '../managers/SpotifyManager';
import { getSelectedTabView, getSelectedPlaylistId, getCachedSpotifyPlaylists, getCachedSoftwareTop40Playlist, getCachedPlaylistTracks, getCachedRecommendationInfo, getSpotifyLikedPlaylist, getCachedLikedSongsTracks, getExpandedPlaylistId, updateExpandedPlaylistId, sortingAlphabetically, getPlayerContext, getCachedAudioMetrics, isLikedTrackId } from '../managers/PlaylistDataManager';
import { RECOMMENDATION_PLAYLIST_ID, SPOTIFY_LIKED_SONGS_PLAYLIST_ID } from '../Constants';
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

    let sidebarContent = '';
    if (selectedTabView === 'playlists' && data?.spotifyPlaylists?.length) {
      let tracks = [];

      if (playlistId) {
        if (playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
          tracks = data.likedTracks;
        } else {
          tracks = data.playlistTracks[playlistId];
        }
      }

      const likedFolder = this.buildPlaylistItem(data.likedPlaylistItem, playlistId, tracks, refreshOpenFolder);
      const playlistFolders = data.spotifyPlaylists.map(
        (item: any) => this.buildPlaylistItem(item, playlistId, tracks, refreshOpenFolder)
      ).join('\n')
      sidebarContent = await this.buildPlaylistSidebar(likedFolder, playlistFolders, data.playerContext);
    } else if (selectedTabView === 'recommendations' && data.recommendationInfo?.tracks?.length) {
      sidebarContent = await this.buildRecommendationSidebar(data.recommendationInfo, data.playerContext);
    } else if (selectedTabView === 'metrics' && Object.keys(data.audioMetrics).length) {
      sidebarContent = this.getMetricsSidebar(data.audioMetrics);
    } else {
      sidebarContent = this.getMusicConnectErrorHtml();
    }

    html = html.replace('__playlist_items_placeholder__', sidebarContent);
    return html;
  }

  private getMusicConnectErrorHtml() {
    const dancePartyImg = `vscode-resource:${getImage('404-image.png')}`;
    return `<div class="flex flex-col items-center justify-center p-2 space-y-3">
      <h4 class="header text-gray-500 text-sm">Oops! Something went wrong.</h4>
      <img src="${dancePartyImg}" alt="DJ-Cody" class="rounded-xl h-64">
      <p class="text-gray-500 text-sm">
        <a href class="underline text-blue-500 hover:text-gray-500" onclick="onCmdClick('reInitializeSpotify')">Refresh your Spotify acces</a>
      </p>
    </div>`
  }

  private async buildPlaylistSidebar(likedFolder, playlistFolders, playerContext) {
    return `<div class="divide-y dark:divide-gray-100 dark:divide-opacity-25">
      <div class="flex flex-col w-full pb-2">
        <div class="flex justify-between items-center space-x-2 py-3">
          <div class="text-gray-500 text-xs font-semibold">Playlists</div>
          <div class="flex items-center space-x-2">
            ${this.getSearchIconButton()}
            ${this.getSortButton()}
            ${await this.getTrackControlButton(playerContext)}
          </div>
        </div>
        ${likedFolder}
      </div>
      <div class="flex flex-col pt-2">
        ${playlistFolders}
      </div>
    </div>`
  }

  private async buildRecommendationSidebar(recommendationInfo: any, playerContext: PlayerContext) {
    return `<div class="flex flex-col w-full space-y-2">
      <div class="flex justify-between items-center space-x-2 py-3">
        <div class="text-gray-500 text-xs font-semibold">${recommendationInfo.label}</div>
        <div class="flex items-center space-x-2">
          ${this.getMoodSelectorIconButton()}
          ${this.getGenreSelectorIconButton()}
          ${await this.getTrackControlButton(playerContext)}
        </div>
      </div>
      <div class="flex flex-col">
        ${this.buildRecommendationTracks(recommendationInfo)}
      </div>
    </div>`
  }

  private buildPlaylistItem(item: any, playlistId: any, tracks: any, refreshOpenFolder: boolean = false) {
    let chevronSvg = this.getChevronRight();
    let tracksHtml = '';
    if (item.id === playlistId) {
      if ((getExpandedPlaylistId() !== playlistId) || getExpandedPlaylistId() === playlistId && refreshOpenFolder) {
        // expand or refresh
        updateExpandedPlaylistId(playlistId);
        chevronSvg = this.getChevronDown();

        if (tracks?.length) {
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

  private buildRecommendationTracks(recommendationInfo: any) {
    return [
      '<div>',
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
          <div class="w-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
            </svg>
          </div>
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
    const playlistId = RECOMMENDATION_PLAYLIST_ID;
    const trackPlaylistId = `${track.id}_${playlistId}`;
    return `<div class="w-full flex justify-between items-center">
      <button onclick="onCmdClick('playRecommendations', { playlistId: '${playlistId}', trackId: '${track.id}' })"
        data-track-id="${trackPlaylistId}"
        class="w-full truncate pl-2 p-1 focus:outline-none">
        <div class="flex items-center space-x-2">
          <div class="w-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
            </svg>
          </div>
          <p class="text-xs hover:text-blue-500">
            ${track.name}
          </p>
        </div>
        <p class="text-left text-xs text-gray-500 font-medium">${track['description']}</p>
      </button>
      ${this.getDotsVerticalMenuButton(track, playlistId)}
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
            ${this.getLikedActionButton(track, playlistId)}
            ${this.getAlbumButton(track, playlistId)}
            ${this.getTrackRecommendationsButton(track, playlistId)}
            ${this.getShareTrackButton(track, playlistId)}
            ${this.getPlaylistAddButton(track, playlistId)}
          </div>
        </div>
      </div>
    </div>`
  }

  private getLikedActionButton(track: PlaylistItem, playlistId) {
    if (playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_ID || track['liked'] === true) {
      return this.getRemoveLikedSongButton(track.id, playlistId, true);
    }
    return this.getAddToLikedPlaylistButton(track.id, playlistId, true);
  }

  private getRemoveLikedSongButton(trackId, playlistId, showText) {
    return `<a href class="rounded block py-2 text-xs focus:outline-none"
      title="Remove from your library"
      onclick="onCmdClick('unlike', { trackId: '${trackId}', playlistId: '${playlistId}' })"
      role="menuitem" tabindex="-1" id="menu-item-1">
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 hover:text-blue-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
        </svg>
        ${(showText) ? '<p>Remove from your library</p>' : ''}
      </div>
    </a>`
  }

  private getAddToLikedPlaylistButton(trackId, playlistId, showText) {
    return `<a href class="rounded block py-2 text-xs focus:outline-none"
      title="Save to your library"
      onclick="onCmdClick('like', { trackId: '${trackId}', playlistId: '${playlistId}' })"
      role="menuitem" tabindex="-1" id="menu-item-1">
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        ${(showText) ? '<p>Save to your library</p>' : ''}
      </div>
    </a>`
  }

  private getShareTrackButton(track: PlaylistItem, playlistId) {
    return `<a href class="rounded block py-2 text-xs focus:outline-none"
      onclick="onCmdClick('shareTrack', { trackId: '${track.id}', playlistId: '${playlistId}' })"
      role="menuitem" tabindex="-1" id="menu-item-2">
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        <p>Share track</p>
      </div>
    </a>`
  }

  private getTrackRecommendationsButton(track: PlaylistItem, playlistId) {
    return `<a href class="rounded block py-2 text-xs focus:outline-none"
      onclick="onCmdClick('getTrackRecommendations', { trackId: '${track.id}', playlistId: '${playlistId}' })"
      role="menuitem" tabindex="-1" id="menu-item-2">
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <p>Get recommendations</p>
      </div>
    </a>`
  }

  private getAlbumButton(track: PlaylistItem, playlistId) {
    return `<a href class="rounded block py-2 text-xs focus:outline-none"
      onclick="onCmdClick('showAlbum', { trackId: '${track.id}', playlistId: '${playlistId}' })"
      role="menuitem" tabindex="-1" id="menu-item-1">
        <div class="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p>Show album</p>
        </div>
      </a>`
  }

  private getPlaylistAddButton(track: PlaylistItem, playlistId) {
    return `<a href class="rounded block py-2 text-xs focus:outline-none"
      onclick="onCmdClick('showAlbum', { trackId: '${track.id}', playlistId: '${playlistId}' })"
      role="menuitem" tabindex="-1" id="menu-item-1">
        <div class="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <p>Add to playlist</p>
        </div>
      </a>`
  }

  private getSearchIconButton() {
    return `<button type="button" onclick="onCmdClick('searchTracks')"
      class="relative font-medium focus:outline-none hover:text-blue-500">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 hover:text-blue-500" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
      </svg>
    </button>`
  }

  private getMoodSelectorIconButton() {
    return `<button type="button" onclick="onCmdClick('songMoodSelector')"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    </button>`
  }

  private getGenreSelectorIconButton() {
    return `<button type="button" onclick="onCmdClick('songGenreSelector')"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    </button>`
  }

  private async getTrackControlButton(playerContext: PlayerContext) {
    return `<div class="relative inline-block text-left">
      <div>
        <button
          id="track-control-button"
          type="button"
          class="rounded-full flex items-center text-gray-400 hover:text-blue-500 focus:outline-none"
          data-action="click->plugin--music-time--sidebar#toggleTrackControl"
          aria-expanded="true" aria-haspopup="true">
          <span class="sr-only">Track control</span>
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" class="h-5 w-5 text-gray-400 hover:text-blue-500" viewBox="0 0 1000 1000" enable-background="new 0 0 1000 1000" xml:space="preserve">
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
        <div class="text-sm p-1 space-y-2 divide-y focus:outline-none" role="none">
          <div class="pl-1 pr-2 py-2 space-y-2" role="none">
            ${this.getDeviceItemInfoHtml(playerContext)}
          </div>
          <div class="flex flex-col pl-1 pr-2 py-2 space-y-2" role="none">
            ${await this.getPlayingTrackItemHtml(playerContext)}
            ${this.getPlayControlButtonsItemHtml(playerContext)}
          </div>
        </div>
      </div>
    </div>`
  }

  private getDeviceItemInfoHtml(playerContext: PlayerContext) {
    const ctx: PlayerContext = playerContext || new PlayerContext();
    let selectedDeviceText = 'Connect to a Spotify device';
    let deviceInfoText = 'Launch the web or desktop player';
    if (ctx.device?.name) {
      selectedDeviceText = `Listening on your ${playerContext.device.name}`
      deviceInfoText = ctx.device.is_active ? `Active at ${ctx.device.volume_percent}% volume` : `Inactive at ${ctx.device.volume_percent}% volume`;
    }

    return `<p class="text-xs text-gray-500 font-medium">${selectedDeviceText}</p>
      <a href class="rounded py-2 text-xs focus:outline-none"
        onclick="onCmdClick('deviceSelector')">
        ${deviceInfoText}
      </a>`
  }

  private async getPlayingTrackItemHtml(playerContext: PlayerContext) {
    if (playerContext?.item?.name) {
      const isLikedTrack = await isLikedTrackId(playerContext.item.id);
      const playlistId = getSelectedPlaylistId();
      return `<div class="flex items-center justify-between">
        <div class="flex flex-col py-2 space-y-1">
          <p class="text-sm text-blue-500">${playerContext.item.name}</p>
          <p class="text-xs text-gray-500 font-medium">${playerContext.item.artist}</p>
        </div>
        <div>${(isLikedTrack) ? this.getRemoveLikedSongButton(playerContext.item.id, playlistId, false) : this.getAddToLikedPlaylistButton(playerContext.item.id, playlistId, false)}</div>
      </div>`
    }
    return `<div class="flex flex-col py-2">
      <p class="flex text-xs text-gray-500 font-medium justify-center">Select a track to play</p>
    </div>`
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
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 hover:text-blue-500" viewBox="0 0 20 20" fill="currentColor">
        <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
      </svg>
    </button>`
  }

  private getSortByCreationButton() {
    return `<button type="button" onclick="onCmdClick('sortToOriginal')" title="Sort by date created"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 hover:text-blue-500" viewBox="0 0 48 48" fill="none">
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
      return this.getPlayButton();
    }
    return this.getPauseButton();
  }

  private getPauseButton() {
    return `<button type="button" onclick="onCmdClick('pause')" title="Pause"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>`
  }

  private getPlayButton() {
    return `<button type="button" onclick="onCmdClick('play')" title="Play"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>`
  }

  private getPreviousButton() {
    return `<button type="button" onclick="onCmdClick('previous')" title="Previous"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
      </svg>
    </button>`
  }

  private getNextButton() {
    return `<button type="button" onclick="onCmdClick('next')" title="Next"
      class="relative font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
      </svg>
    </button>`
  }

  private getRepeatButton(playerContext: PlayerContext) {
    if (!playerContext || playerContext.repeat_state !== "track") {
      // show the repeat once button
      return `<button type="button" onclick="onCmdClick('repeatOn')" title="Repeat track"
        class="relative font-medium focus:outline-none">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
          viewBox="0 0 384.967 384.967" class="h-5 w-5 text-gray-400 hover:text-blue-500" xml:space="preserve" stroke="currentColor" stroke-width="2">
          <g>
            <g id="Group_Arrows">
              <path fill="currentColor" d="M72.18,192.479c6.641,0,12.03-5.39,12.03-12.03V84.206h199.595l-39.159,39.628c-4.728,4.752-4.728,12.439,0,17.191
                c4.728,4.74,12.391,4.74,17.119,0l59.43-60.139c4.728-4.752,4.728-12.439,0-17.191l0,0l-59.43-60.139
                c-4.728-4.74-12.391-4.74-17.119,0s-4.728,12.439,0,17.179l38.942,39.411H72.18c-6.641,0-12.03,5.39-12.03,12.03v108.273
                C60.15,187.089,65.54,192.479,72.18,192.479z"/>
              <path fill="currentColor" d="M312.786,192.395c-6.641,0-12.03,5.39-12.03,12.03v96.615H100.728l39.508-40.061c4.728-4.752,4.728-12.463,0-17.215
                c-4.728-4.752-12.391-4.752-17.119,0L64,303.723c-5.041,4.764-5.077,12.969,0,17.733l59.129,59.947
                c4.728,4.752,12.391,4.752,17.119,0s4.728-12.463,0-17.215l-38.533-39.074h211.072c6.641,0,12.03-5.39,12.03-12.03V204.437
                C324.817,197.784,319.427,192.395,312.786,192.395z"/>
            </g>
            <g>
            </g>
            <g>
            </g>
            <g>
            </g>
            <g>
            </g>
            <g>
            </g>
            <g>
            </g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
          <g>
          </g>
        </svg>
      </button>`
    }
    // show the repeat disable button
    return `<button type="button" onclick="onCmdClick('repeatOff')" title="Disable repeat"
      class="relative font-medium focus:outline-none">
      <svg class="h-5 w-5 text-gray-400 hover:text-blue-500" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2">
        <g>
          <path fill="none" d="M0 0h24v24H0z"/>
          <path fill="currentColor" d="M8 20v1.932a.5.5 0 0 1-.82.385l-4.12-3.433A.5.5 0 0 1 3.382 18H18a2 2 0 0 0 2-2V8h2v8a4 4 0 0 1-4 4H8zm8-16V2.068a.5.5 0 0 1 .82-.385l4.12 3.433a.5.5 0 0 1-.321.884H6a2 2 0 0 0-2 2v8H2V8a4 4 0 0 1 4-4h10zm-5 4h2v8h-2v-6H9V9l2-1z"/>
        </g>
      </svg>
    </button>`
  }

  private getMetricsSidebar(audioMetrics: any) {
    return `<div class="flex flex-col w-full space-y-2 pt-2 pb-4">
      <div class="flex justify-between items-center space-x-2 py-1">
        <div class="text-gray-500 text-xs font-semibold">Your favorite audio</div>
        <div class="flex items-center space-x-2">
          ${this.getGenerateFeatureRecommendationsButton()}
        </div>
      </div>
      ${this.getFeatureRanges(audioMetrics)}
    </div>`
  }

  private getFeatureRanges(audioMetrics: any) {
    const featureRanges = Object.keys(audioMetrics).map((key) => {
      const value = (parseFloat(audioMetrics[key].avg) / audioMetrics[key].max) * 100
      return `<div class="text-xs px-2">
        <label for="default-range" class="block mb-2 font-medium">${audioMetrics[key].label}</label>
        <input data-feature-slider="${audioMetrics[key].label}" id="default-range" disabled=true type="range" value="${value}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700">
      </div>`
    })
    return `<div class="flex flex-col space-y-4 px-2 pt-4">
      ${featureRanges.join('')}
    </div>`
  }

  private getGenerateFeatureRecommendationsButton() {
    return `<button type="button" title="Generate recommendations"
      onclick="onCmdClick('getAudioFeatureRecommendations')"
      class="relative text-gray-500 hover:text-blue-500 font-medium focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    </button>`
  }

  private async getViewData(selectedTabView, playlist_id, spotifyUser) {
    let playlistTracks = {};
    let spotifyPlaylists = [];
    let softwareTop40Playlist = undefined;
    let selectedPlaylistId = undefined;
    let audioMetrics: any = {};
    let recommendationInfo = {tracks: [], label: ''};
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
        audioMetrics = await getCachedAudioMetrics();
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
      audioMetrics,
      recommendationInfo,
    };
  }
}
