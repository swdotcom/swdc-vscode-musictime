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
    PlayerDevice,
    getSpotifyDevices
} from "cody-music";
import { getPlaylistIcon } from "../Util";
import { MusicManager } from "./MusicManager";
import { MusicCommandManager } from "./MusicCommandManager";
import { MusicControlManager } from "./MusicControlManager";
import { MusicDataManager } from "./MusicDataManager";

const musicMgr: MusicManager = MusicManager.getInstance();
const musicControlMgr: MusicControlManager = MusicControlManager.getInstance();

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

const playRecommendationTrack = async (track: PlaylistItem) => {
    // ask to launch web or desktop if neither are running
    const devices: PlayerDevice[] = await getSpotifyDevices();
    const launchConfirmInfo: any = await musicMgr.launchConfirm(devices);
    if (!launchConfirmInfo.proceed) {
        return;
    }

    const launchTimeout =
        launchConfirmInfo.playerName === PlayerName.SpotifyDesktop
            ? 4000
            : 5000;

    MusicCommandManager.syncControls(
        MusicDataManager.getInstance().runningTrack,
        true /*loading*/
    );

    if (launchConfirmInfo.isLaunching) {
        setTimeout(async () => {
            await musicControlMgr.playSpotifyByTrack(track, devices);
        }, launchTimeout);
    } else {
        await musicControlMgr.playSpotifyByTrack(track, devices);
    }
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

            await playRecommendationTrack(playlistItem);
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
        const recTrackPlaylistItems = musicMgr.convertTracksToPlaylistItems(
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
