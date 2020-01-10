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
    playItunesTrackNumberInPlaylist,
    getSpotifyDevices,
    PlayerDevice
} from "cody-music";
import { PLAYLISTS_PROVIDER } from "../Constants";
import { MusicManager } from "./MusicManager";
import { MusicCommandManager } from "./MusicCommandManager";
import { logIt, getPlaylistIcon } from "../Util";
import { MusicControlManager } from "./MusicControlManager";

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

const musicMgr: MusicManager = MusicManager.getInstance();
const musicControlMgr: MusicControlManager = MusicControlManager.getInstance();

let initializedPlaylist = false;

export const playSelectedItem = async (
    playlistItem: PlaylistItem,
    isExpand: boolean
) => {
    // ask to launch web or desktop if neither are running
    const devices: PlayerDevice[] = await getSpotifyDevices();
    const launchConfirmInfo: any = await musicMgr.launchConfirm(devices);
    if (!launchConfirmInfo.proceed) {
        return;
    }

    // let the congtrols know we're loading
    MusicCommandManager.syncControls(musicMgr.runningTrack, true /*loading*/);

    musicMgr.currentProvider = PLAYLISTS_PROVIDER;

    const launchTimeout =
        launchConfirmInfo.playerName === PlayerName.SpotifyDesktop
            ? 4000
            : 5000;

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

        if (playlistItem.playerType === PlayerType.MacItunesDesktop) {
            // ITUNES
            const pos: number = playlistItem.position || 1;
            await playItunesTrackNumberInPlaylist(
                musicMgr.selectedPlaylist.name,
                pos
            );
        } else if (launchConfirmInfo.playerName === PlayerName.SpotifyDesktop) {
            // explicitly selected SPOTIFY DESKTOP
            // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
            // make sure the track has spotify:track and the playlist has spotify:playlist
            if (launchConfirmInfo.isLaunching) {
                setTimeout(() => {
                    musicControlMgr.playSpotifyDesktopPlaylistTrack(devices);
                }, launchTimeout);
            } else {
                musicControlMgr.playSpotifyDesktopPlaylistTrack(devices);
            }
        } else {
            // SPOTIFY WEB
            if (launchConfirmInfo.isLaunching) {
                setTimeout(() => {
                    musicControlMgr.playSpotifyWebPlaylistTrack(
                        true /*isTrack*/,
                        devices
                    );
                }, launchTimeout);
            } else {
                musicControlMgr.playSpotifyWebPlaylistTrack(
                    true /*isTrack*/,
                    devices
                );
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

            if (playlistItem.playerType === PlayerType.MacItunesDesktop) {
                const pos: number = 1;
                if (launchConfirmInfo.isLaunching) {
                    setTimeout(() => {
                        playItunesTrackNumberInPlaylist(
                            musicMgr.selectedPlaylist.name,
                            pos
                        );
                    }, launchTimeout);
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
                            musicControlMgr.playSpotifyDesktopPlaylistTrack(
                                devices
                            );
                        }, launchTimeout);
                    } else {
                        setTimeout(() => {
                            musicControlMgr.playSpotifyWebPlaylistTrack(
                                false /*isTrack*/,
                                devices
                            );
                        }, launchTimeout);
                    }
                } else {
                    if (
                        launchConfirmInfo.playerName ===
                        PlayerName.SpotifyDesktop
                    ) {
                        musicControlMgr.playSpotifyDesktopPlaylistTrack(
                            devices
                        );
                    } else {
                        musicControlMgr.playSpotifyWebPlaylistTrack(
                            false /*isTrack*/,
                            devices
                        );
                    }
                }
            }
        }
    }

    if (launchConfirmInfo.isLaunching) {
        setTimeout(() => {
            // refresh the list to reflect the running device
            commands.executeCommand("musictime.refreshPlaylist");
        }, launchTimeout);
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

            if (playlistItem.type !== "track") {
                // play it if it's a track, otherwise return out since there
                // are no functions associated with it
                return;
            }

            // set the selected playlist
            const currentPlaylistId = playlistItem["playlist_id"];
            const selectedPlaylist = await musicMgr.getPlaylistById(
                currentPlaylistId
            );
            musicMgr.selectedPlaylist = selectedPlaylist;

            // play it
            playSelectedItem(playlistItem, false /*isExpand*/);

            // deselect it
            try {
                // re-select the track without focus
                view.reveal(playlistItem, {
                    focus: false,
                    select: false
                });
            } catch (err) {
                logIt(`Unable to deselect track: ${err.message}`);
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

    getTreeItem(p: PlaylistItem): PlaylistTreeItem {
        let treeItem: PlaylistTreeItem = null;
        if (p.type === "playlist") {
            // it's a track parent (playlist)
            if (p && p.tracks && p.tracks["total"] && p.tracks["total"] > 0) {
                // in the future we can use TreeItemCollapsibleState.Expanded
                // if we have a clean way of check that a track is playing when the
                // playlist folders are loaded, but currently the tracks load after you
                // open the playlist so we don't know if it's playing or not
                return createPlaylistTreeItem(
                    p,
                    TreeItemCollapsibleState.Collapsed
                );
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
