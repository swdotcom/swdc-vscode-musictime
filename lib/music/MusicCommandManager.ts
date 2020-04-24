import { window, StatusBarAlignment, StatusBarItem } from "vscode";
import { getSongDisplayName, isMac, getItem } from "../Util";
import { TrackStatus, Track } from "cody-music";
import { MusicManager } from "./MusicManager";
import { requiresSpotifyAccess, getDeviceId } from "./MusicUtil";
import { MusicDataManager } from "./MusicDataManager";

export interface Button {
    /**
     * Id of button
     */
    id: string;
    tooltip: string;
    /**
     * Generator of text for button(Octicons)
     */
    dynamicText?: (cond: boolean) => string;
    /**
     * Generator of color for button
     */
    dynamicColor?: (cond: boolean) => string;
    /**
     * vscode status bar item
     */
    statusBarItem: StatusBarItem;
}

// const songNameDisplayTimeoutMillis: number = 12000;

export class MusicCommandManager {
    private static _buttons: Button[] = [];
    private static _hideSongTimeout = null;
    private static _isLoading: boolean = false;

    private constructor() {
        // private to prevent non-singleton usage
    }

    public static isLoading(): boolean {
        return this._isLoading;
    }

    /**
     * Initialize the music command manager.
     * Create the list of status bar buttons that will be displayed.
     */
    public static async initialize() {
        const musictimeMenuTooltip = this.getMusicMenuTooltip();
        // start with 100 0and go down in sequence
        this.createButton(
            "🎧",
            musictimeMenuTooltip,
            "musictime.revealTree",
            1000
        );
        this.createButton(
            "$(settings) Loading",
            "updating",
            "musictime.progress",
            999
        );
        this.createButton(
            "Connect Spotify",
            "Connect Spotify to add your top productivity tracks.",
            "musictime.connectSpotify",
            999
        );
        // play previous or unicode ⏪
        this.createButton(
            "$(chevron-left)",
            "Previous",
            "musictime.previous",
            999
        );
        // 998 buttons (play, pause)
        this.createButton("$(play)", "Play", "musictime.play", 998);
        // pause unicode ⏸
        this.createButton(
            "$(primitive-square)",
            "Stop",
            "musictime.pause",
            998
        );
        // play next ⏩
        this.createButton("$(chevron-right)", "Next", "musictime.next", 997);
        // 996 buttons (unlike, like)
        this.createButton("♡", "Like", "musictime.like", 996);
        this.createButton("♥", "Unlike", "musictime.unlike", 996);
        // button area for the current song name
        this.createButton(
            "",
            "Click to view track",
            "musictime.currentSong",
            995
        );

        // await this.syncControls(MusicDataManager.getInstance().runningTrack);
    }

    public static initiateProgress(progressLabel: string) {
        this.showProgress(progressLabel);
    }

    public static async syncControls(
        track: Track,
        showLoading: boolean = false,
        statusOverride: TrackStatus = null
    ) {
        if (this._hideSongTimeout) {
            clearTimeout(this._hideSongTimeout);
        }

        const trackStatus: TrackStatus = track
            ? track.state
            : TrackStatus.NotAssigned;

        const {
            needsSpotifyAccess,
            foundDevice,
        } = await this.getSpotifyState();

        let pauseIt = trackStatus === TrackStatus.Playing;
        let playIt = trackStatus === TrackStatus.Paused;

        if (statusOverride) {
            if (statusOverride === TrackStatus.Playing) {
                playIt = false;
                pauseIt = true;
            } else {
                playIt = true;
                pauseIt = false;
            }
        }

        this._isLoading = showLoading;

        if (!needsSpotifyAccess && foundDevice && (pauseIt || playIt)) {
            if (pauseIt) {
                this.showPauseControls(track);
            } else {
                this.showPlayControls(track);
            }
        } else {
            this.showLaunchPlayerControls();
        }
    }

    /**
     * Create a status bar button
     * @param text
     * @param tooltip
     * @param command
     * @param priority
     */
    private static createButton(
        text: string,
        tooltip: string,
        command: string,
        priority: number
    ) {
        let statusBarItem = window.createStatusBarItem(
            StatusBarAlignment.Left,
            priority
        );
        statusBarItem.text = text;
        statusBarItem.command = command;
        statusBarItem.tooltip = tooltip;

        let button: Button = {
            id: command,
            statusBarItem,
            tooltip: tooltip,
        };

        this._buttons.push(button);
    }

    private static async showLoadingTrack() {
        if (!this._buttons || this._buttons.length === 0) {
            return;
        }

        this._isLoading = true;

        // hide all except for the launch player button and possibly connect spotify button
        this._buttons = this._buttons.map((button) => {
            const btnCmd = button.statusBarItem.command;

            const isMusicTimeMenuButton = btnCmd === "musictime.revealTree";
            const isProgressButton = btnCmd === "musictime.progress";

            if (isMusicTimeMenuButton || isProgressButton) {
                if (isMusicTimeMenuButton) {
                    button.tooltip = this.getMusicMenuTooltip();
                }
                // always show the headphones button for the launch controls function
                button.statusBarItem.show();
            } else {
                // hide the rest
                button.statusBarItem.hide();
            }
            return button;
        });
    }

    /**
     * Show launch is when the user needs to connect to spotify
     */
    private static async showLaunchPlayerControls() {
        if (!this._buttons || this._buttons.length === 0) {
            return;
        }
        const {
            needsSpotifyAccess,
            showPremiumRequired,
        } = await this.getSpotifyState();
        // hide all except for the launch player button and possibly connect spotify button
        this._buttons = this._buttons.map((button) => {
            const btnCmd = button.statusBarItem.command;

            const isMusicTimeMenuButton = btnCmd === "musictime.revealTree";
            const isConnectSpotifyButton =
                button.statusBarItem.text === "Connect Spotify";

            if (isMusicTimeMenuButton) {
                button.tooltip = this.getMusicMenuTooltip();
                // always show the headphones button for the launch controls function
                button.statusBarItem.show();
            } else if (isConnectSpotifyButton && needsSpotifyAccess) {
                // show the connect button
                button.statusBarItem.show();
            } else {
                // hide the rest
                button.statusBarItem.hide();
            }
            return button;
        });
    }

    /**
     * Show the buttons to play a track
     * @param trackInfo
     */
    private static async showPlayControls(trackInfo: Track) {
        if (!this._buttons || this._buttons.length === 0) {
            return;
        }

        const songInfo = trackInfo
            ? `${trackInfo.name} (${trackInfo.artist})`
            : null;

        const isLiked = MusicDataManager.getInstance().isLikedTrack(
            trackInfo.id
        );

        this._buttons.map((button) => {
            const btnCmd = button.statusBarItem.command;
            const isMusicTimeMenuButton = btnCmd === "musictime.revealTree";
            const isPlayButton = btnCmd === "musictime.play";
            const isLikedButton = btnCmd === "musictime.like";
            const isUnLikedButton = btnCmd === "musictime.unlike";
            const currentSongButton = btnCmd === "musictime.currentSong";
            const isPrevButton = btnCmd === "musictime.previous";
            const isNextButton = btnCmd === "musictime.next";

            if (isMusicTimeMenuButton || isPrevButton || isNextButton) {
                if (isMusicTimeMenuButton) {
                    button.tooltip = this.getMusicMenuTooltip();
                }
                // always show the headphones menu icon
                button.statusBarItem.show();
            } else if (isLikedButton) {
                if (isLiked) {
                    button.statusBarItem.hide();
                } else {
                    button.statusBarItem.show();
                }
            } else if (isUnLikedButton) {
                if (isLiked) {
                    button.statusBarItem.show();
                } else {
                    button.statusBarItem.hide();
                }
            } else if (currentSongButton) {
                button.statusBarItem.tooltip = `(${trackInfo.name}) ${button.tooltip}`;
                button.statusBarItem.text = getSongDisplayName(trackInfo.name);
                button.statusBarItem.show();
            } else if (isPlayButton) {
                if (songInfo) {
                    // show the song info over the play button
                    button.statusBarItem.tooltip = `${button.tooltip} - ${songInfo}`;
                }
                button.statusBarItem.show();
            } else {
                button.statusBarItem.hide();
            }
        });
    }

    /**
     * Show the buttons to pause a track
     * @param trackInfo
     */
    private static async showPauseControls(trackInfo: Track) {
        if (!this._buttons || this._buttons.length === 0) {
            return;
        }

        const songInfo = trackInfo
            ? `${trackInfo.name} (${trackInfo.artist})`
            : null;

        const isLiked = MusicDataManager.getInstance().isLikedTrack(
            trackInfo.id
        );

        this._buttons.map((button) => {
            const btnCmd = button.statusBarItem.command;
            const isMusicTimeMenuButton = btnCmd === "musictime.revealTree";
            const isPauseButton = btnCmd === "musictime.pause";
            const isLikedButton = btnCmd === "musictime.like";
            const isUnLikedButton = btnCmd === "musictime.unlike";
            const currentSongButton = btnCmd === "musictime.currentSong";
            const isPrevButton = btnCmd === "musictime.previous";
            const isNextButton = btnCmd === "musictime.next";

            if (isMusicTimeMenuButton || isPrevButton || isNextButton) {
                if (isMusicTimeMenuButton) {
                    button.tooltip = this.getMusicMenuTooltip();
                }
                // always show the headphones menu icon
                button.statusBarItem.show();
            } else if (isLikedButton) {
                if (isLiked) {
                    button.statusBarItem.hide();
                } else {
                    button.statusBarItem.show();
                }
            } else if (isUnLikedButton) {
                if (isLiked) {
                    button.statusBarItem.show();
                } else {
                    button.statusBarItem.hide();
                }
            } else if (currentSongButton) {
                button.statusBarItem.tooltip = `(${trackInfo.name}) ${button.tooltip}`;
                button.statusBarItem.text = getSongDisplayName(trackInfo.name);
                button.statusBarItem.show();
            } else if (isPauseButton) {
                if (songInfo) {
                    button.statusBarItem.tooltip = `${button.tooltip} - ${songInfo}`;
                }
                button.statusBarItem.show();
            } else {
                button.statusBarItem.hide();
            }
        });
    }

    private static showProgress(progressLabel: string) {
        this._buttons.map((button) => {
            const btnCmd = button.statusBarItem.command;
            const isMusicTimeMenuButton = btnCmd === "musictime.revealTree";
            const isMusicTimeProgress = btnCmd === "musictime.progress";

            if (isMusicTimeMenuButton || isMusicTimeProgress) {
                if (isMusicTimeMenuButton) {
                    button.tooltip = this.getMusicMenuTooltip();
                }
                // if (isMusicTimeProgress) {
                //     button.statusBarItem.text = progressLabel;
                // }
                // show progress and headphones menu buttons
                button.statusBarItem.show();
            } else {
                // hide the rest
                button.statusBarItem.hide();
            }
        });
    }

    private static getMusicMenuTooltip() {
        const name = getItem("name");
        const needsSpotifyAccess = requiresSpotifyAccess();
        if (needsSpotifyAccess) {
            return "Connect Spotify";
        }

        let musicTimeTooltip = "Click to see more from Music Time";
        if (name) {
            musicTimeTooltip = `${musicTimeTooltip} (${name})`;
        }
        return musicTimeTooltip;
    }

    private static async getSpotifyState() {
        const musicMgr: MusicManager = MusicManager.getInstance();
        const needsSpotifyAccess = requiresSpotifyAccess();
        const hasSpotifyPlaybackAccess = musicMgr.hasSpotifyPlaybackAccess();
        const hasSpotifyUser = musicMgr.hasSpotifyUser();

        const foundDevice = getDeviceId() ? true : false;

        const showPremiumRequired =
            isMac() && !hasSpotifyPlaybackAccess && hasSpotifyUser;
        return {
            needsSpotifyAccess,
            showPremiumRequired,
            foundDevice,
        };
    }
}
