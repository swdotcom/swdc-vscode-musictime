import {
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    Command,
    EventEmitter,
    Event,
    Disposable,
    TreeView,
    commands,
} from "vscode";
import { PlaylistItem } from "cody-music";
import { getPlaylistIcon } from "../Util";
import { MusicManager } from "./MusicManager";
import { MusicDataManager } from "./MusicDataManager";
import { ProviderItemManager } from "./ProviderItemManager";

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

const playRecommendationTrack = async (playlistItem: PlaylistItem) => {
    // play it
    MusicManager.getInstance().playSelectedItem(playlistItem);
};

/**
 * Handles the playlist onDidChangeSelection event
 */
export const connectRecommendationPlaylistTreeView = (
    view: TreeView<PlaylistItem>
) => {
    // view is {selection: Array[n], visible, message}
    return Disposable.from(
        // e is {selection: Array[n]}
        view.onDidChangeSelection(async (e) => {
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

            await playRecommendationTrack(playlistItem);
        }),
        view.onDidChangeVisibility((e) => {
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
        return false;
    }

    getTreeItem(p: PlaylistItem): PlaylistTreeItem {
        const treeItem: PlaylistTreeItem = createPlaylistTreeItem(
            p,
            TreeItemCollapsibleState.None
        );
        return treeItem;
    }

    async getChildren(element?: PlaylistItem): Promise<PlaylistItem[]> {
        const recTrackPlaylistItems = ProviderItemManager.getInstance().convertTracksToPlaylistItems(
            MusicDataManager.getInstance().recommendationTracks
        );
        return recTrackPlaylistItems;
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

        this.description = treeItem.itemType === "track" ? treeItem.artist : "";

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

    iconPath = {
        light: "",
        dark: "",
    };

    contextValue = "playlistItem";
}
