import {
  PlaylistItem,
  PlayerType,
  PlayerName,
  TrackStatus,
  Track,
  CodyResponse,
  getPlaylistTracks,
  PaginationItem,
  CodyResponseType,
  addTracksToPlaylist,
  PlayerDevice,
  getSpotifyPlaylist,
  followPlaylist,
  playSpotifyDevice,
  playSpotifyTrack,
  PlayerContext,
  playTrackInContext,
  accessExpired,
  removeTracksFromPlaylist,
} from "cody-music";
import { SPOTIFY_LIKED_SONGS_PLAYLIST_NAME, SOFTWARE_TOP_40_PLAYLIST_ID, OK_LABEL, YES_LABEL } from "../Constants";
import { commands, window } from "vscode";
import { isMac, getCodyErrorMessage, createUriFromTrackId } from "../Util";
import { isResponseOk, softwareGet } from "../HttpClient";
import { MusicControlManager } from "./MusicControlManager";
import { getDeviceSet, getBestActiveDevice } from "./MusicUtil";
import { MusicDataManager } from "./MusicDataManager";
import { MusicCommandUtil } from "./MusicCommandUtil";
import { getSpotifyIntegration, isPremiumUser } from "../managers/SpotifyManager";
import { getItem, setItem } from "../managers/FileManager";
import { getPlaylistById, getSpotifyPlaylists } from "../managers/PlaylistDataManager";

export class MusicManager {
  private static instance: MusicManager;

  private dataMgr: MusicDataManager;
  private selectedPlayerName: PlayerName;

  private constructor() {
    this.dataMgr = MusicDataManager.getInstance();
  }
  static getInstance(): MusicManager {
    if (!MusicManager.instance) {
      MusicManager.instance = new MusicManager();
    }

    return MusicManager.instance;
  }

  //
  // Clear all of the playlists and tracks
  //
  clearPlaylists() {
    this.dataMgr.playlistMap = {};
    this.dataMgr.playlistTrackMap = {};
  }

  async getSoftwareTop40(playlists): Promise<PlaylistItem> {
    // get the Software Top 40 Playlist
    let softwareTop40: PlaylistItem = playlists.find((n) => n.id === SOFTWARE_TOP_40_PLAYLIST_ID);
    if (!softwareTop40) {
      softwareTop40 = await getSpotifyPlaylist(SOFTWARE_TOP_40_PLAYLIST_ID);
    }
    if (softwareTop40 && softwareTop40.id) {
      softwareTop40.loved = false;
      softwareTop40.itemType = "playlist";
      softwareTop40.tag = "paw";
    }
    return softwareTop40;
  }

  //
  // Fetch the playlist overall state
  //
  async getPlaylistState(playlist_id: string): Promise<TrackStatus> {
    let playlistState: TrackStatus = TrackStatus.NotAssigned;

    const playlistTrackItems: PlaylistItem[] = await this.getPlaylistItemTracksForPlaylistId(playlist_id);

    if (playlistTrackItems && playlistTrackItems.length > 0) {
      for (let i = 0; i < playlistTrackItems.length; i++) {
        const playlistItem: PlaylistItem = playlistTrackItems[i];
        if (playlistItem.id === this.dataMgr.runningTrack.id) {
          return this.dataMgr.runningTrack.state;
        } else {
          // update theis track status to not assigned to ensure it's also updated
          playlistItem.state = TrackStatus.NotAssigned;
        }
      }
    }

    return playlistState;
  }

  clearPlaylistTracksForId(playlist_id) {
    this.dataMgr.playlistTrackMap[playlist_id] = null;
  }

  //
  // Fetch the tracks for a given playlist ID
  //
  async getPlaylistItemTracksForPlaylistId(playlist_id: string): Promise<PlaylistItem[]> {
    let playlistItemTracks: PlaylistItem[] = this.dataMgr.playlistTrackMap[playlist_id];

    if (!playlistItemTracks || playlistItemTracks.length === 0) {
      if (this.dataMgr.currentPlayerName === PlayerName.ItunesDesktop) {
        // get the itunes tracks based on this playlist id name
        const codyResp: CodyResponse = await getPlaylistTracks(PlayerName.ItunesDesktop, playlist_id);
        playlistItemTracks = this.getPlaylistItemTracksFromCodyResponse(codyResp);
      } else {
        // fetch from spotify web
        if (playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
          playlistItemTracks = this.getPlaylistItemTracksFromTracks(this.dataMgr.spotifyLikedSongs);
        } else {
          // get the playlist tracks from the spotify api
          const codyResp: CodyResponse = await getPlaylistTracks(PlayerName.SpotifyWeb, playlist_id);
          playlistItemTracks = this.getPlaylistItemTracksFromCodyResponse(codyResp);
        }
      }

      // update the map
      this.dataMgr.playlistTrackMap[playlist_id] = playlistItemTracks;
    }

    if (playlistItemTracks && playlistItemTracks.length > 0) {
      for (let i = 0; i < playlistItemTracks.length; i++) {
        const track: PlaylistItem = playlistItemTracks[i];
        // check to see if this track is the current track
        if (this.dataMgr.runningTrack.id === track.id) {
          playlistItemTracks[i].state = this.dataMgr.runningTrack.state;
        } else {
          playlistItemTracks[i].state = TrackStatus.NotAssigned;
        }
        playlistItemTracks[i]["playlist_id"] = playlist_id;
      }
    }

    return playlistItemTracks;
  }

  //
  // Build the playlist items from the list of tracks
  //
  getPlaylistItemTracksFromTracks(tracks: Track[]): PlaylistItem[] {
    let playlistItems: PlaylistItem[] = [];
    if (tracks && tracks.length > 0) {
      for (let i = 0; i < tracks.length; i++) {
        let track = tracks[i];
        const position = i + 1;
        let playlistItem: PlaylistItem = this.createPlaylistItemFromTrack(track, position);
        playlistItems.push(playlistItem);
      }
    }
    return playlistItems;
  }

  getPlaylistItemTracksFromCodyResponse(codyResponse: CodyResponse): PlaylistItem[] {
    let playlistItems: PlaylistItem[] = [];
    if (codyResponse && codyResponse.state === CodyResponseType.Success) {
      let paginationItem: PaginationItem = codyResponse.data;

      if (paginationItem && paginationItem.items) {
        playlistItems = paginationItem.items.map((track: Track, idx: number) => {
          const position = idx + 1;
          let playlistItem: PlaylistItem = this.createPlaylistItemFromTrack(track, position);

          return playlistItem;
        });
      }
    }

    return playlistItems;
  }

  getArtist(track: any) {
    if (!track) {
      return null;
    }
    if (track.artist) {
      return track.artist;
    }
    if (track.artists && track.artists.length > 0) {
      const trackArtist = track.artists[0];
      return trackArtist.name;
    }
    return null;
  }

  createPlaylistItemFromTrack(track: Track, position: number) {
    const popularity = track.popularity ? track.popularity : null;
    const artistName = this.getArtist(track);

    let tooltip = track.name;
    if (artistName) {
      tooltip += ` - ${artistName}`;
    }
    if (popularity) {
      tooltip += ` (Popularity: ${popularity})`;
    }

    let playlistItem: PlaylistItem = new PlaylistItem();
    playlistItem.type = "track";
    playlistItem.name = track.name;
    playlistItem.tooltip = tooltip;
    playlistItem.id = track.id;
    playlistItem.uri = track.uri;
    playlistItem.popularity = track.popularity;
    playlistItem.position = position;
    playlistItem.artist = artistName;
    playlistItem.playerType = track.playerType;
    playlistItem.itemType = "track";
    playlistItem["albumId"] = track?.album?.id;
    playlistItem["albumName"] = track?.album?.name;

    delete playlistItem.tracks;

    if (track.id === this.dataMgr.runningTrack.id) {
      playlistItem.state = this.dataMgr.runningTrack.state;
      this.dataMgr.selectedTrackItem = playlistItem;
    } else {
      playlistItem.state = TrackStatus.NotAssigned;
    }
    return playlistItem;
  }

  async playNextLikedSong() {
    const device = getBestActiveDevice();

    // play the next song
    const nextTrack: Track = this.getNextSpotifyLikedSong();
    if (nextTrack) {
      let playlistItem: PlaylistItem = this.createPlaylistItemFromTrack(nextTrack, 0);
      this.dataMgr.selectedTrackItem = playlistItem;
      if (isPremiumUser()) {
        // play the next track
        await MusicCommandUtil.getInstance().runSpotifyCommand(playSpotifyTrack, [playlistItem.id, device?.id]);
      } else {
        // play it using the track id
        const trackUri = createUriFromTrackId(playlistItem.id);
        const params = [trackUri];
        await playTrackInContext(PlayerName.SpotifyDesktop, params);
      }
    }
  }

  async playPreviousLikedSong() {
    const device = getBestActiveDevice();
    // play the next song
    const prevTrack: Track = this.getPreviousSpotifyLikedSong();
    if (prevTrack) {
      let playlistItem: PlaylistItem = this.createPlaylistItemFromTrack(prevTrack, 0);
      this.dataMgr.selectedTrackItem = playlistItem;
      if (isPremiumUser()) {
        // launch and play the next track
        await MusicCommandUtil.getInstance().runSpotifyCommand(playSpotifyTrack, [playlistItem.id, device?.id]);
      } else {
        // play it using the track id
        const trackUri = createUriFromTrackId(playlistItem.id);
        const params = [trackUri];
        await playTrackInContext(PlayerName.SpotifyDesktop, params);
      }
    }
  }

  /**
   * Return the next Spotify Track from the Liked Songs list.
   * It will return null if the Liked Songs list doesn't exist or the current track ID is not assigned.
   * It will return the 1st track if the current track ID is not assigned and the Liked Songs list exists.
   */
  getNextSpotifyLikedSong(): Track {
    const currentTrackId = this.dataMgr.selectedTrackItem.id;
    const hasLikedSongs = this.dataMgr.spotifyLikedSongs && this.dataMgr.spotifyLikedSongs.length > 0;
    if (currentTrackId && hasLikedSongs) {
      let currTrackIndex = this.dataMgr.spotifyLikedSongs.findIndex((i) => i.id === currentTrackId);
      if (currTrackIndex !== -1) {
        // if the curr track index is the last element, return zero, else return the next one
        if (currTrackIndex + 1 < this.dataMgr.spotifyLikedSongs.length) {
          return this.dataMgr.spotifyLikedSongs[currTrackIndex + 1];
        } else {
          return this.dataMgr.spotifyLikedSongs[0];
        }
      }
    } else if (!currentTrackId && hasLikedSongs) {
      return this.dataMgr.spotifyLikedSongs[0];
    }
    return null;
  }

  getPreviousSpotifyLikedSong(): Track {
    const currentTrackId = this.dataMgr.selectedTrackItem.id;
    const hasLikedSongs = this.dataMgr.spotifyLikedSongs && this.dataMgr.spotifyLikedSongs.length > 0;
    if (currentTrackId && hasLikedSongs) {
      const currTrackIndex = this.dataMgr.spotifyLikedSongs.findIndex((i) => i.id === currentTrackId);
      if (currTrackIndex !== -1) {
        // if the curr track index is the last element, return zero, else return the next one
        if (currTrackIndex - 1 >= 0) {
          return this.dataMgr.spotifyLikedSongs[currTrackIndex - 1];
        } else {
          return this.dataMgr.spotifyLikedSongs[this.dataMgr.spotifyLikedSongs.length - 1];
        }
      }
    }
    return null;
  }

  /**
   * These are the top productivity songs for this user
   */
  async syncUsersWeeklyTopSongs() {
    const response = await softwareGet("/music/recommendations?limit=40", getItem("jwt"));

    if (isResponseOk(response) && response.data.length > 0) {
      this.dataMgr.userTopSongs = response.data;
    } else {
      // clear the favorites
      this.dataMgr.userTopSongs = [];
    }
  }

  async addTracks(playlist_id: string, name: string, tracksToAdd: string[]) {
    if (playlist_id) {
      // create the playlist_id in software
      const addTracksResult: CodyResponse = await addTracksToPlaylist(playlist_id, tracksToAdd);

      if (addTracksResult.state === CodyResponseType.Success) {
        window.showInformationMessage(`Successfully created ${name} and added tracks.`);
      } else {
        window.showErrorMessage(`There was an unexpected error adding tracks to the playlist. ${addTracksResult.message}`, ...[OK_LABEL]);
      }
    }
  }

  async requiresReAuthentication(): Promise<boolean> {
    const spotifyIntegration = getSpotifyIntegration();
    if (spotifyIntegration) {
      const expired = await accessExpired();

      if (expired) {
        setItem("requiresSpotifyReAuth", true);
      }
      return expired;
    }
    return false;
  }

  async isLikedSong() {
    const playlistId = this.dataMgr.selectedPlaylist ? this.dataMgr.selectedPlaylist.id : null;
    const isLikedSong = playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME ? true : false;
    return isLikedSong;
  }

  isMacDesktopEnabled() {
    const { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice, activeDesktopPlayerDevice } = getDeviceSet();
    return isMac() && (desktop || activeDesktopPlayerDevice) ? true : false;
  }

  getPlayerNameForPlayback() {
    // if you're offline you may still have spotify desktop player abilities.
    // check if the current player is spotify and we don't have web access.
    // if no web access, then use the desktop player
    if (this.dataMgr.currentPlayerName !== PlayerName.ItunesDesktop && isMac() && !isPremiumUser()) {
      return PlayerName.SpotifyDesktop;
    }
    return this.dataMgr.currentPlayerName;
  }

  async followSpotifyPlaylist(playlist: PlaylistItem) {
    const codyResp: CodyResponse = await followPlaylist(playlist.id);
    if (codyResp.state === CodyResponseType.Success) {
      window.showInformationMessage(`Successfully following the '${playlist.name}' playlist.`);

      // repopulate the playlists since we've changed the state of the playlist
      await getSpotifyPlaylists();

      commands.executeCommand("musictime.refreshMusicTimeView");
    } else {
      window.showInformationMessage(`Unable to follow ${playlist.name}. ${codyResp.message}`, ...[OK_LABEL]);
    }
  }

  async removeTrackFromPlaylist(trackItem: PlaylistItem) {
    // get the playlist it's in
    const currentPlaylistId = trackItem["playlist_id"];
    const foundPlaylist = getPlaylistById(currentPlaylistId);
    if (foundPlaylist) {
      // if it's the liked songs, then send it to the setLiked(false) api
      if (foundPlaylist.id === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
        const buttonSelection = await window.showInformationMessage(
          `Are you sure you would like to remove '${trackItem.name}' from your '${SPOTIFY_LIKED_SONGS_PLAYLIST_NAME}' playlist?`,
          ...[YES_LABEL]
        );

        if (buttonSelection === YES_LABEL) {
          await MusicControlManager.getInstance().setLiked(trackItem, false);
        }
      } else {
        // remove it from a playlist
        const tracks = [trackItem.id];
        const result = await removeTracksFromPlaylist(currentPlaylistId, tracks);

        const errMsg = getCodyErrorMessage(result);
        if (errMsg) {
          window.showInformationMessage(`Error removing the selected track. ${errMsg}`);
        } else {
          window.showInformationMessage("Song removed successfully");
          commands.executeCommand("musictime.refreshMusicTimeView");
        }
      }
    }
  }

  /**
   * Transfer to this device
   * @param computerDevice
   */
  async transferToComputerDevice(computerDevice: PlayerDevice = null) {
    const devices: PlayerDevice[] = await this.dataMgr.currentDevices;
    if (!computerDevice) {
      computerDevice = devices && devices.length > 0 ? devices.find((d) => d.type.toLowerCase() === "computer") : null;
    }
    if (computerDevice) {
      await playSpotifyDevice(computerDevice.id);
    }
  }

  async isTrackRepeating(): Promise<boolean> {
    // get the current repeat state
    const spotifyContext: PlayerContext = this.dataMgr.spotifyContext;
    // "off", "track", "context", ""
    const repeatState = spotifyContext ? spotifyContext.repeat_state : "";
    return repeatState && repeatState === "track" ? true : false;
  }

  async getPlaylistTrackState(playlistId): Promise<TrackStatus> {
    let playlistItemTracks: PlaylistItem[] = this.dataMgr.playlistTrackMap[playlistId];
    if (!playlistItemTracks || playlistItemTracks.length === 0) {
      playlistItemTracks = await this.getPlaylistItemTracksForPlaylistId(playlistId);
    }

    if (playlistItemTracks && playlistItemTracks.length > 0) {
      for (let i = 0; i < playlistItemTracks.length; i++) {
        const track: PlaylistItem = playlistItemTracks[i];
        // check to see if this track is the current track
        if (this.dataMgr.runningTrack.id === track.id) {
          return this.dataMgr.runningTrack.state;
        }
      }
    }
    return TrackStatus.NotAssigned;
  }
}
