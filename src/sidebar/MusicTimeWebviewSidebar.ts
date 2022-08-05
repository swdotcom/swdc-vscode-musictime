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
import { getSelectedTabView, getSelectedPlaylistId, getCachedSpotifyPlaylists, getCachedSoftwareTop40Playlist, getCachedPlaylistTracks, getUserMusicMetrics, getCachedRecommendationInfo, getSpotifyLikedPlaylist, getCachedLikedSongsTracks } from '../managers/PlaylistDataManager';
import { SPOTIFY_LIKED_SONGS_PLAYLIST_ID } from '../Constants';

export class MusicTimeWebviewSidebar implements Disposable, WebviewViewProvider {
  private _webview: WebviewView | undefined;
  private _disposable: Disposable | undefined;
  private _origHtml: string = '';

  constructor(private readonly _extensionUri: Uri) {
    //
  }

  public async refresh(reloadData = false) {
    if (!this._webview) {
      // its not available to refresh yet
      return;
    }
    if (!this._origHtml || reloadData) {
      this._webview.webview.html = await this.getHtml();
    } else {
      this._webview.webview.html = await this.buildPlaylistItems(this._origHtml);
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
      nav_view: 'playlists'
    };
    const resp = await appGet('/plugin/sidebar', params);
    if (isResponseOk(resp)) {
      this._origHtml = resp.data;
      return await this.buildPlaylistItems(this._origHtml);
    }

    return await getConnectionErrorHtml();
  }

  private async buildPlaylistItems(html: string) {
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

    let playlistSidebar = '';
    if (data?.spotifyPlaylists?.length) {
      const likedFolder = this.buildPlaylistItem(data.likedPlaylistItem, playlistId, tracks);
      const playlistFolders = data.spotifyPlaylists.map(
        (item: any) => this.buildPlaylistItem(item, playlistId, tracks)
      ).join('\n')
      playlistSidebar = this.buildPlaylistSidebar(likedFolder, playlistFolders);
    }

    html = html.replace('__playlist_items_placeholder__', playlistSidebar);
    return html;
  }

  private buildPlaylistSidebar(likedFolder, playlistFolders) {
    return `<div class="divide-y dark:divide-gray-100 dark:divide-opacity-25">
      <div>
        ${likedFolder}
      </div>
      <div>
        ${playlistFolders}
      </div>
    </div>`
  }

  private buildPlaylistItem(item: any, playlistId: any, tracks: any) {
    let chevronSvg = this.getChevronRight();
    let tracksHtml = '';
    if (item.id === playlistId) {
      chevronSvg = this.getChevronDown();

      if (tracks.length) {
        tracksHtml = [
          '<div class="space-y-1" id="sub-menu-1">',
          ...tracks.map((item: any) => this.buildTrackItem(item)),
          '</div>'
        ].join('\n');
      }
    }

    return `
      <div class="space-y-1">
        <button type="button" onclick="onCmdClick('refreshMusicTimeView', { tabView: 'playlists', playlistId: '${item.id}' })"
          class="w-full flex items-center p-2 text-left text-xs rounded-sm focus:outline-none text-gray-700 dark:text-gray-100 hover:text-blue-500">
          ${chevronSvg}
          <span class="truncate">${item.name}</span>
        </button>${tracksHtml}
      </div>`
  }

  private buildTrackItem(item: any) {
    return `<a href onclick="onCmdClick('playTrack')"
      class="w-full flex items-center p-1 text-xs">
      ${item.name}
    </a>`
  }

  private getChevronDown() {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
    </svg>`;
  }

  private getChevronRight() {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
    </svg>`;
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
