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
import * as path from "path";
import {
    PlaylistItem,
    PlayerName,
    PlayerType,
    TrackStatus,
    playItunesTrackNumberInPlaylist,
    launchAndPlaySpotifyTrack,
    playSpotifyMacDesktopTrack,
    getSpotifyDevices,
    launchPlayer,
    isSpotifyRunning
} from "cody-music";
import { MusicControlManager } from "./MusicControlManager";
import {
    SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
    OK_LABEL,
    NOT_NOW_LABEL,
    YES_LABEL
} from "../Constants";
import { MusicManager } from "./MusicManager";
import { MusicCommandManager } from "./MusicCommandManager";
import { logIt, isMac } from "../Util";

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

let checkSpotifyStateTimeout = null;
let initializedPlaylist = false;

export const checkSpotifySongState = (missingDevices: boolean) => {
    if (checkSpotifyStateTimeout) {
        clearTimeout(checkSpotifyStateTimeout);
    }
    checkSpotifyStateTimeout = setTimeout(async () => {
        const musicMgr: MusicManager = MusicManager.getInstance();
        // make sure we get that song, if not then they may not be logged in
        let playingTrack = musicMgr.runningTrack;

        if (
            !playingTrack ||
            (playingTrack.state !== TrackStatus.Paused &&
                playingTrack.state !== TrackStatus.Playing)
        ) {
            // they're not logged in
            window.showInformationMessage(
                "We're unable to play the selected Spotify track. Please make sure you are logged in to your account. You will need the Spotify desktop app if you have a non-premium Spotify account.",
                ...[OK_LABEL]
            );
        } else if (missingDevices) {
            // refresh the playlist
            commands.executeCommand("musictime.refreshPlaylist");
        }
    }, 8000);
};

export const playSelectedItem = async (
    playlistItem: PlaylistItem,
    isExpand: boolean
) => {
    const musicCtrlMgr = new MusicControlManager();
    const musicMgr: MusicManager = MusicManager.getInstance();

    let playerName = musicMgr.getPlayerNameForPlayback();
    // this is another way to check if the player is running or not
    let isRunning = await isSpotifyRunning();
    if (!isExpand && playerName !== PlayerName.ItunesDesktop && isMac()) {
        // const devices = await getSpotifyDevices();
        let isRunning = await isSpotifyRunning();

        if (!isRunning) {
            // ask to launch
            const selectedButton = await window.showInformationMessage(
                `Spotify is currently not running, would you like to launch the desktop instead of the the web player?`,
                ...[NOT_NOW_LABEL, YES_LABEL]
            );
            if (selectedButton === YES_LABEL) {
                // launch the desktop
                playerName = PlayerName.SpotifyDesktop;
            }
        }
    }

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
        } else if (playerName === PlayerName.SpotifyDesktop) {
            // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
            // make sure the track has spotify:track and the playlist has spotify:playlist
            playSpotifyDesktopPlaylistTrack();
        } else {
            launchAndPlaySpotifyWebPlaylistTrack(true /*isTrack*/);
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
                await playItunesTrackNumberInPlaylist(
                    musicMgr.selectedPlaylist.name,
                    pos
                );
            } else {
                if (playerName === PlayerName.SpotifyDesktop) {
                    playSpotifyDesktopPlaylistTrack();
                } else {
                    launchAndPlaySpotifyWebPlaylistTrack(false /*isTrack*/);
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

    const devices = await getSpotifyDevices();

    // launch the app if it's not already running
    if (!devices || devices.length === 0) {
        await launchPlayer(PlayerName.SpotifyDesktop, { quietly: false });
    }

    if (isLikedSongsPlaylist) {
        // just play the 1st track
        playSpotifyMacDesktopTrack(selectedTrack.id);
    } else {
        // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
        // make sure the track has spotify:track and the playlist has spotify:playlist
        playSpotifyMacDesktopTrack(selectedTrack.id, selectedPlaylist.id);
    }
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
        const musicCtrlMgr = new MusicControlManager();

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

        if (element) {
            // return the playlist tracks
            let tracks: PlaylistItem[] = await musicMgr.getPlaylistItemTracksForPlaylistId(
                element.id
            );
            return tracks;
        } else {
            // get the top level playlist parents
            let playlistChildren: PlaylistItem[] = musicMgr.currentPlaylists;
            if (!playlistChildren || playlistChildren.length === 0) {
                // try again if we've just initialized the plugin
                await musicMgr.refreshPlaylists();
                playlistChildren = musicMgr.currentPlaylists;
            }
            return musicMgr.currentPlaylists;
        }
    }
}

/**
 * The TreeItem contains the "contextValue", which is represented as the "viewItem"
 * from within the package.json when determining if there should be decoracted context
 * based on that value.
 */
export class PlaylistTreeItem extends TreeItem {
    private resourcePath: string = path.join(
        __filename,
        "..",
        "..",
        "..",
        "resources"
    );

    constructor(
        private readonly treeItem: PlaylistItem,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly command?: Command
    ) {
        super(treeItem.name, collapsibleState);

        // set the track's context value to the playlist item state
        // if it's a track that's playing or paused it will show the appropriate button.
        // if it's a playlist folder that has a track that is playing or paused it will show the appropriate button
        const stateVal =
            treeItem.state !== TrackStatus.Playing ? "notplaying" : "playing";
        this.contextValue = "";
        if (treeItem.tag === "action") {
            this.contextValue = "treeitem-action";
        } else if (
            treeItem["itemType"] === "track" ||
            treeItem["itemType"] === "playlist"
        ) {
            if (treeItem.tag === "paw") {
                // we use the paw to show as the music time playlist, but
                // make sure the contextValue has spotify in it
                this.contextValue = `spotify-${treeItem.type}-item-${stateVal}`;
            } else {
                this.contextValue = `${treeItem.tag}-${treeItem.type}-item-${stateVal}`;
            }
        }

        if (
            treeItem.tag.includes("spotify") ||
            treeItem.type.includes("spotify")
        ) {
            const spotifySvg =
                treeItem.tag === "disabled"
                    ? "spotify-disconnected.svg"
                    : "spotify-logo.svg";
            this.iconPath.light = path.join(
                this.resourcePath,
                "light",
                spotifySvg
            );
            this.iconPath.dark = path.join(
                this.resourcePath,
                "dark",
                spotifySvg
            );
        } else if (treeItem.tag === "itunes" || treeItem.type === "itunes") {
            this.iconPath.light = path.join(
                this.resourcePath,
                "light",
                "itunes-logo.svg"
            );
            this.iconPath.dark = path.join(
                this.resourcePath,
                "dark",
                "itunes-logo.svg"
            );
        } else if (treeItem.tag === "paw") {
            this.iconPath.light = path.join(
                this.resourcePath,
                "light",
                "sw-paw-circle.svg"
            );
            this.iconPath.dark = path.join(
                this.resourcePath,
                "dark",
                "sw-paw-circle.svg"
            );
        } else if (treeItem.type === "connected") {
            this.iconPath.light = path.join(
                this.resourcePath,
                "light",
                "radio-tower.svg"
            );
            this.iconPath.dark = path.join(
                this.resourcePath,
                "dark",
                "radio-tower.svg"
            );
        } else if (treeItem.type === "offline") {
            this.iconPath.light = path.join(
                this.resourcePath,
                "light",
                "nowifi.svg"
            );
            this.iconPath.dark = path.join(
                this.resourcePath,
                "dark",
                "nowifi.svg"
            );
        } else if (treeItem.type === "action" || treeItem.tag === "action") {
            this.iconPath.light = path.join(
                this.resourcePath,
                "light",
                "gear.svg"
            );
            this.iconPath.dark = path.join(
                this.resourcePath,
                "dark",
                "gear.svg"
            );
        } else if (treeItem.type === "login" || treeItem.tag === "login") {
            this.iconPath.light = path.join(
                this.resourcePath,
                "light",
                "sign-in.svg"
            );
            this.iconPath.dark = path.join(
                this.resourcePath,
                "dark",
                "sign-in.svg"
            );
        } else if (treeItem.type === "divider") {
            this.iconPath.light = path.join(
                this.resourcePath,
                "light",
                "blue-line-96.png"
            );
            this.iconPath.dark = path.join(
                this.resourcePath,
                "dark",
                "blue-line-96.png"
            );
        } else {
            // no matching tag, remove the tree item icon path
            delete this.iconPath;
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
