import {
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    Command,
    EventEmitter,
    Event,
    Disposable,
    TreeView,
    commands
} from "vscode";
import {
    PlaylistItem,
    PlayerName,
    PlayerType,
    TrackStatus,
    playItunesTrackNumberInPlaylist,
    launchAndPlaySpotifyTrack,
    playSpotifyMacDesktopTrack
} from "cody-music";
import { MusicControlManager } from "./MusicControlManager";
import {
    SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
    PLAYLISTS_PROVIDER
} from "../Constants";
import { MusicManager } from "./MusicManager";
import { MusicCommandManager } from "./MusicCommandManager";
import { logIt, getPlaylistIcon } from "../Util";

/**
 * Create the playlist tree item (root or leaf)
 * @param p
 * @param cstate
 */
const createPlaylistTreeItem = (
    p: PlaylistItem,
    cstate: TreeItemCollapsibleState
) => {
    return new PlaylistTreeItem(p, cstate);
};

const musicCtrlMgr: MusicControlManager = MusicControlManager.getInstance();
const musicMgr: MusicManager = MusicManager.getInstance();

let initializedPlaylist = false;

export const playSelectedItem = async (
    playlistItem: PlaylistItem,
    isExpand: boolean
) => {
    const launchConfirmInfo: any = await musicMgr.launchConfirm();
    if (!launchConfirmInfo.proceed) {
        return;
    }

    musicMgr.currentProvider = PLAYLISTS_PROVIDER;

    // is this a track or playlist item?
    if (playlistItem.type === "track") {
        let currentPlaylistId = playlistItem["playlist_id"];

        // !important! set the selected track
        musicMgr.selectedTrackItem = playlistItem;

        if (!musicMgr.selectedPlaylist) {
            // make sure we have a selected playlist
            const playlist: PlaylistItem = await musicMgr.getPlaylistById(
                currentPlaylistId
            );
            musicMgr.selectedPlaylist = playlist;
        }

        const notPlaying = playlistItem.state !== TrackStatus.Playing;

        MusicCommandManager.syncControls(
            musicMgr.runningTrack,
            true /*loading*/
        );

        if (playlistItem.playerType === PlayerType.MacItunesDesktop) {
            if (notPlaying) {
                const pos: number = playlistItem.position || 1;
                await playItunesTrackNumberInPlaylist(
                    musicMgr.selectedPlaylist.name,
                    pos
                );
            } else {
                musicCtrlMgr.pauseSong();
            }
        } else if (launchConfirmInfo.playerName === PlayerName.SpotifyDesktop) {
            // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
            // make sure the track has spotify:track and the playlist has spotify:playlist
            if (launchConfirmInfo.isLaunching) {
                setTimeout(() => {
                    playSpotifyDesktopPlaylistTrack();
                }, 2000);
            } else {
                playSpotifyDesktopPlaylistTrack();
            }
        } else {
            if (launchConfirmInfo.isLaunching) {
                setTimeout(() => {
                    launchAndPlaySpotifyWebPlaylistTrack(true /*isTrack*/);
                }, 2000);
            } else {
                launchAndPlaySpotifyWebPlaylistTrack(true /*isTrack*/);
            }
        }
    } else {
        // !important! set the selected playlist
        musicMgr.selectedPlaylist = playlistItem;

        if (!isExpand) {
            // it's a play request, not just an expand. get the tracks
            const tracks: PlaylistItem[] = await MusicManager.getInstance().getPlaylistItemTracksForPlaylistId(
                playlistItem.id
            );

            // get the tracks
            const selectedTrack: PlaylistItem =
                tracks && tracks.length > 0 ? tracks[0] : null;

            if (!selectedTrack) {
                // no tracks in this playlist, return out
                return;
            }

            // !important! set the selected track now since it's not null
            musicMgr.selectedTrackItem = selectedTrack;

            MusicCommandManager.syncControls(
                musicMgr.runningTrack,
                true /*loading*/
            );

            if (playlistItem.playerType === PlayerType.MacItunesDesktop) {
                const pos: number = 1;
                if (launchConfirmInfo.isLaunching) {
                    setTimeout(() => {
                        playItunesTrackNumberInPlaylist(
                            musicMgr.selectedPlaylist.name,
                            pos
                        );
                    }, 2000);
                } else {
                    playItunesTrackNumberInPlaylist(
                        musicMgr.selectedPlaylist.name,
                        pos
                    );
                }
            } else {
                if (launchConfirmInfo.isLaunching) {
                    if (
                        launchConfirmInfo.playerName ===
                        PlayerName.SpotifyDesktop
                    ) {
                        setTimeout(() => {
                            playSpotifyDesktopPlaylistTrack();
                        }, 2000);
                    } else {
                        setTimeout(() => {
                            launchAndPlaySpotifyWebPlaylistTrack(
                                false /*isTrack*/
                            );
                        }, 2000);
                    }
                } else {
                    if (
                        launchConfirmInfo.playerName ===
                        PlayerName.SpotifyDesktop
                    ) {
                        playSpotifyDesktopPlaylistTrack();
                    } else {
                        launchAndPlaySpotifyWebPlaylistTrack(false /*isTrack*/);
                    }
                }
            }
        }
    }
};

/**
 * Helper function to play a track or playlist if we've determined to play
 * against the mac spotify desktop app.
 */
export const playSpotifyDesktopPlaylistTrack = async () => {
    const musicMgr = MusicManager.getInstance();
    // get the selected playlist
    const selectedPlaylist = musicMgr.selectedPlaylist;
    // get the selected track
    const selectedTrack = musicMgr.selectedTrackItem;
    const isLikedSongsPlaylist =
        selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;

    if (isLikedSongsPlaylist) {
        // just play the 1st track
        playSpotifyDesktopPlaylistByTrack(selectedTrack);
    } else {
        // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
        // make sure the track has spotify:track and the playlist has spotify:playlist
        playSpotifyMacDesktopTrack(selectedTrack.id, selectedPlaylist.id);
    }
};

export const playSpotifyDesktopPlaylistByTrack = (track: PlaylistItem) => {
    // just play the 1st track
    playSpotifyMacDesktopTrack(track.id);
};

/**
 * Launch and play a spotify track via the web player.
 * @param isTrack boolean
 */
export const launchAndPlaySpotifyWebPlaylistTrack = async (
    isTrack: boolean
) => {
    const musicMgr = MusicManager.getInstance();

    // get the selected playlist
    const selectedPlaylist = musicMgr.selectedPlaylist;
    // get the selected track
    const selectedTrack = musicMgr.selectedTrackItem;

    const notPlaying = selectedTrack.state !== TrackStatus.Playing;
    const progressLabel = notPlaying
        ? `Playing ${selectedTrack.name}`
        : `Pausing ${selectedTrack.name}`;

    MusicCommandManager.initiateProgress(progressLabel);

    const isLikedSongsPlaylist =
        selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;

    if (isTrack) {
        // a track was selected, check if we should play or pause it

        if (notPlaying) {
            await launchAndPlaySpotifyTrack(
                selectedTrack.id,
                selectedPlaylist.id
            );
        } else {
            musicCtrlMgr.pauseSong();
        }
    } else {
        if (isLikedSongsPlaylist) {
            // play the 1st track in the non-playlist liked songs folder
            await launchAndPlaySpotifyTrack(
                selectedTrack.id,
                selectedPlaylist.id
            );
        } else {
            // use the normal play playlist by offset 0 call
            await launchAndPlaySpotifyTrack("", selectedPlaylist.id);
        }
    }
};

/**
 * Handles the playlist onDidChangeSelection event
 */
export const connectPlaylistTreeView = (view: TreeView<PlaylistItem>) => {
    // view is {selection: Array[n], visible, message}
    return Disposable.from(
        // e is {selection: Array[n]}
        view.onDidChangeSelection(async e => {
            if (!e.selection || e.selection.length === 0) {
                return;
            }
            let playlistItem: PlaylistItem = e.selection[0];

            if (playlistItem.command) {
                // run the command
                commands.executeCommand(playlistItem.command);
                return;
            } else if (playlistItem["cb"]) {
                const cbFunc = playlistItem["cb"];
                cbFunc();
                return;
            }

            const isExpand = playlistItem.type === "playlist" ? true : false;

            // play it
            playSelectedItem(playlistItem, isExpand);

            if (playlistItem.type === "track") {
                // deselect it
                try {
                    const currentPlaylistId = playlistItem["playlist_id"];
                    const itemPlaylist = await musicMgr.getPlaylistById(
                        currentPlaylistId
                    );
                    if (itemPlaylist) {
                        musicMgr.selectedPlaylist = itemPlaylist;
                        // don't "select" it though. that will invoke the pause/play action
                        view.reveal(itemPlaylist, {
                            focus: false,
                            select: true
                        });
                    }
                } catch (err) {
                    logIt(`Unable to deselect track: ${err.message}`);
                }
            }
        }),
        view.onDidChangeVisibility(e => {
            if (e.visible) {
                if (!initializedPlaylist) {
                    // fetch the playlist
                    commands.executeCommand("musictime.refreshPlaylist");
                    initializedPlaylist = true;
                }
            }
        })
    );
};
export class MusicPlaylistProvider implements TreeDataProvider<PlaylistItem> {
    private _onDidChangeTreeData: EventEmitter<
        PlaylistItem | undefined
    > = new EventEmitter<PlaylistItem | undefined>();

    readonly onDidChangeTreeData: Event<PlaylistItem | undefined> = this
        ._onDidChangeTreeData.event;

    private view: TreeView<PlaylistItem>;

    constructor() {
        //
    }

    bindView(view: TreeView<PlaylistItem>): void {
        this.view = view;
    }

    getParent(_p: PlaylistItem) {
        return void 0; // all playlists are in root
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    refreshParent(parent: PlaylistItem) {
        this._onDidChangeTreeData.fire(parent);
    }

    isTrackInPlaylistRunning(p: PlaylistItem) {
        const selectedTrack: PlaylistItem = MusicManager.getInstance()
            .selectedTrackItem;
        if (selectedTrack && selectedTrack["playlist_id"] === p.id) {
            this.selectTrack(selectedTrack, false /* select */);
            return true;
        }
        return false;
    }

    selectTrack(p: PlaylistItem, select: boolean = true) {
        // reveal the track state if it's playing or paused
        try {
            // don't "select" it though. that will invoke the pause/play action
            this.view.reveal(p, {
                focus: true,
                select
            });
        } catch (err) {
            logIt(`Unable to select track: ${err.message}`);
        }
    }

    async selectPlaylist(p: PlaylistItem) {
        try {
            // don't "select" it though. that will invoke the pause/play action
            await this.view.reveal(p, {
                focus: true,
                select: false,
                expand: true
            });
            playSelectedItem(p, false);
        } catch (err) {
            logIt(`Unable to select playlist: ${err.message}`);
        }
    }

    getTreeItem(p: PlaylistItem): PlaylistTreeItem {
        let treeItem: PlaylistTreeItem = null;
        if (p.type === "playlist") {
            // it's a track parent (playlist)
            if (p && p.tracks && p.tracks["total"] && p.tracks["total"] > 0) {
                const folderState: TreeItemCollapsibleState = this.isTrackInPlaylistRunning(
                    p
                )
                    ? TreeItemCollapsibleState.Expanded
                    : TreeItemCollapsibleState.Collapsed;
                return createPlaylistTreeItem(p, folderState);
            }
            treeItem = createPlaylistTreeItem(p, TreeItemCollapsibleState.None);
        } else {
            // it's a track or a title
            treeItem = createPlaylistTreeItem(p, TreeItemCollapsibleState.None);
        }

        return treeItem;
    }

    async getChildren(element?: PlaylistItem): Promise<PlaylistItem[]> {
        const musicMgr: MusicManager = MusicManager.getInstance();

        if (musicMgr.ready) {
            if (element) {
                // return the playlist tracks
                let tracks: PlaylistItem[] = await musicMgr.getPlaylistItemTracksForPlaylistId(
                    element.id
                );
                return tracks;
            } else {
                // get the top level playlist parents
                let playlistChildren: PlaylistItem[] =
                    musicMgr.currentPlaylists;
                if (!playlistChildren || playlistChildren.length === 0) {
                    // try again if we've just initialized the plugin
                    await musicMgr.refreshPlaylists();
                    playlistChildren = musicMgr.currentPlaylists;
                } else {
                    initializedPlaylist = true;
                }
                return musicMgr.currentPlaylists;
            }
        } else {
            const loadingItem: PlaylistItem = musicMgr.getLoadingButton();
            return [loadingItem];
        }
    }
}

/**
 * The TreeItem contains the "contextValue", which is represented as the "viewItem"
 * from within the package.json when determining if there should be decoracted context
 * based on that value.
 */
export class PlaylistTreeItem extends TreeItem {
    constructor(
        private readonly treeItem: PlaylistItem,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly command?: Command
    ) {
        super(treeItem.name, collapsibleState);

        const { lightPath, darkPath, contextValue } = getPlaylistIcon(treeItem);
        if (lightPath && darkPath) {
            this.iconPath.light = lightPath;
            this.iconPath.dark = darkPath;
        } else {
            // no matching tag, remove the tree item icon path
            delete this.iconPath;
        }
        this.contextValue = contextValue;
    }

    get tooltip(): string {
        if (!this.treeItem) {
            return "";
        }
        if (this.treeItem.tooltip) {
            return `${this.treeItem.tooltip}`;
        } else {
            return `${this.treeItem.name}`;
        }
    }

    iconPath = {
        light: "",
        dark: ""
    };

    contextValue = "playlistItem";
}
