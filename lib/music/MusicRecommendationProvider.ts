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
    window
} from "vscode";
import {
    PlaylistItem,
    launchAndPlaySpotifyTrack,
    isSpotifyRunning,
    PlayerName,
    launchPlayer
} from "cody-music";
import { logIt, getPlaylistIcon } from "../Util";
import { MusicManager } from "./MusicManager";
import {
    NOT_NOW_LABEL,
    YES_LABEL,
    RECOMMENDATIONS_PROVIDER
} from "../Constants";
import { playSpotifyDesktopPlaylistByTrack } from "./MusicPlaylistProvider";
import { MusicCommandManager } from "./MusicCommandManager";

const musicMgr: MusicManager = MusicManager.getInstance();

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
    const isRunning = await isSpotifyRunning();

    musicMgr.currentProvider = RECOMMENDATIONS_PROVIDER;

    // ask to show the desktop if they're a premium user
    let launchDesktop = false;
    if (!isRunning && musicMgr.isSpotifyPremium()) {
        // ask to launch
        const selectedButton = await window.showInformationMessage(
            `Spotify is currently not running, would you like to launch the desktop instead of the the web player?`,
            ...[NOT_NOW_LABEL, YES_LABEL]
        );
        if (selectedButton && selectedButton === YES_LABEL) {
            launchDesktop = true;
            await launchPlayer(PlayerName.SpotifyDesktop, { quietly: false });
        }
    }

    MusicCommandManager.syncControls(musicMgr.runningTrack, true /*loading*/);

    if (!isRunning && !launchDesktop) {
        launchAndPlaySpotifyTrack(track.id);
    } else if (launchDesktop) {
        playSpotifyDesktopPlaylistByTrack(track);
    } else {
        // this will just tell spotify which track to play
        launchAndPlaySpotifyTrack(track.id);
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
        const treeItem: PlaylistTreeItem = createPlaylistTreeItem(
            p,
            TreeItemCollapsibleState.None
        );
        return treeItem;
    }

    async getChildren(element?: PlaylistItem): Promise<PlaylistItem[]> {
        const recTrackPlaylistItems = musicMgr.convertTracksToPlaylistItems(
            musicMgr.recommendationTracks
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
