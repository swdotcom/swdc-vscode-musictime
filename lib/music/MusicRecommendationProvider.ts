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
import * as path from "path";
import { PlaylistItem, TrackStatus } from "cody-music";
import { RecommendationManager } from "./RecommendationManager";
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
            // playSelectedItem(playlistItem, isExpand);
        }),
        view.onDidChangeVisibility(e => {
            if (e.visible) {
                //
            }
        })
    );
};
export class MusicRecommendationProvider
    implements TreeDataProvider<PlaylistItem> {
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
        // const selectedTrack: PlaylistItem = RecommendationManager.getInstance()
        //     .selectedTrackItem;
        // if (selectedTrack && selectedTrack["playlist_id"] === p.id) {
        //     this.selectTrack(selectedTrack, false /* select */);
        //     return true;
        // }
        // return false;
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
            // playSelectedItem(p, false);
        } catch (err) {
            logIt(`Unable to select playlist: ${err.message}`);
        }
    }

    getTreeItem(p: PlaylistItem): PlaylistTreeItem {
        // let treeItem: PlaylistTreeItem = null;
        // if (p.type === "playlist") {
        //     // it's a track parent (playlist)
        //     if (p && p.tracks && p.tracks["total"] && p.tracks["total"] > 0) {
        //         const folderState: TreeItemCollapsibleState = this.isTrackInPlaylistRunning(
        //             p
        //         )
        //             ? TreeItemCollapsibleState.Expanded
        //             : TreeItemCollapsibleState.Collapsed;
        //         return createPlaylistTreeItem(p, folderState);
        //     }
        //     treeItem = createPlaylistTreeItem(p, TreeItemCollapsibleState.None);
        // } else {
        //     // it's a track or a title
        //     treeItem = createPlaylistTreeItem(p, TreeItemCollapsibleState.None);
        // }

        // return treeItem;
        return null;
    }

    async getChildren(element?: PlaylistItem): Promise<PlaylistItem[]> {
        // const musicMgr: MusicManager = MusicManager.getInstance();

        // if (element) {
        //     // return the playlist tracks
        //     let tracks: PlaylistItem[] = await musicMgr.getPlaylistItemTracksForPlaylistId(
        //         element.id
        //     );
        //     return tracks;
        // } else {
        //     // get the top level playlist parents
        //     let playlistChildren: PlaylistItem[] = musicMgr.currentPlaylists;
        //     if (!playlistChildren || playlistChildren.length === 0) {
        //         // try again if we've just initialized the plugin
        //         await musicMgr.refreshPlaylists();
        //         playlistChildren = musicMgr.currentPlaylists;
        //     }
        //     return musicMgr.currentPlaylists;
        // }
        return null;
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

        const pathIcons = getPlaylistIcon(treeItem);
        if (!pathIcons) {
            // no matching tag, remove the tree item icon path
            delete this.iconPath;
        } else {
            this.iconPath.light = pathIcons.lightPath;
            this.iconPath.dark = pathIcons.darkPath;
        }
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
