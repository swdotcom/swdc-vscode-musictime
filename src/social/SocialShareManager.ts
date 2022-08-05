import { launchWebUrl, logIt } from "../Util";
import { showQuickPick } from "../MenuManager";
import {
    buildSpotifyLink,
    MusicControlManager
} from "../music/MusicControlManager";
import {
    showSlackChannelMenu,
    connectSlackWorkspace,
    hasSlackWorkspaces,
} from "../managers/SlackManager";
import { window } from "vscode";

const queryString = require("query-string");
const { WebClient } = require("@slack/web-api");

let musicId: string = "";
let title: string = "";
let spotifyLinkUrl: string = "";
let playlistSelected: boolean = false;

export class SocialShareManager {
    private static instance: SocialShareManager;

    private constructor() {
        //
    }

    static getInstance(): SocialShareManager {
        if (!SocialShareManager.instance) {
            SocialShareManager.instance = new SocialShareManager();
        }

        return SocialShareManager.instance;
    }

    shareIt(sharer: string, options: any) {
        let shareUrl = this.getShareUrl(sharer, options);
        launchWebUrl(shareUrl);
    }

    getShareUrl(sharer: string, options: any) {
        const sharers = {
            facebook: {
                shareUrl: "https://www.facebook.com/sharer/sharer.php",
                params: {
                    u: options["url"],
                    hashtag: options["hashtag"]
                }
            },
            // linkedin: {
            //     shareUrl: "https://www.linkedin.com/shareArticle",
            //     params: {
            //         url: options["url"],
            //         mini: true
            //     }
            // },
            twitter: {
                shareUrl: "https://twitter.com/intent/tweet/",
                params: {
                    text: options["title"],
                    url: options["url"],
                    hashtags: options["hashtags"],
                    via: options["via"]
                }
            },
            tumblr: {
                shareUrl: "http://tumblr.com/widgets/share/tool",
                params: {
                    canonicalUrl: options["url"],
                    content: options["url"],
                    posttype: "link",
                    title: options["title"],
                    caption: options["caption"],
                    tags: options["tags"]
                }
            },
            whatsapp: {
                shareUrl: "https://api.whatsapp.com/send",
                params: {
                    text: `${options["title"]}: ${options["url"]}`
                },
                isLink: true
            }
        };

        const sharerObj = sharers[sharer.toLowerCase()];
        const shareUrl = `${sharerObj.shareUrl}${queryString.stringify(sharerObj.params)}`;
        return shareUrl;
    }

    async showMenu(id: string, label: string, isPlaylist: boolean) {
        musicId = id;
        playlistSelected = isPlaylist;

        let menuOptions = {
            items: []
        };

        const context = isPlaylist ? "Playlist" : "Song";
        title = `Check out this ${context}`;

        spotifyLinkUrl = buildSpotifyLink(musicId, isPlaylist);
        // facebook needs the hash
        menuOptions.items.push({
            label: "Facebook",
            detail: `Share '${label}' on Facebook.`,
            url: this.getShareUrl("facebook", {
                url: spotifyLinkUrl,
                hashtag: `#MusicTime`
            })
        });

        if (await hasSlackWorkspaces()) {
            menuOptions.items.push({
                label: "Slack",
                detail: `Share '${label}' on Slack`,
                cb: this.shareSlack
            });
        }

        menuOptions.items.push({
            label: "Tumblr",
            detail: `Share '${label}' on Tumblr.`,
            url: this.getShareUrl("tumblr", {
                url: spotifyLinkUrl,
                title,
                tags: ["MusicTime"],
                caption: "Software Audio Share"
            })
        });

        // twitter doesn't need the hash chars, "via" (optional: twitter username without @)
        menuOptions.items.push({
            label: "Twitter",
            detail: `Tweet '${label}' on Twitter.`,
            url: this.getShareUrl("twitter", {
                url: spotifyLinkUrl,
                title,
                hashtags: ["MusicTime"]
            })
        });

        menuOptions.items.push({
            label: "WhatsApp",
            detail: `Send '${label}' through WhatsApp.`,
            url: this.getShareUrl("whatsapp", {
                url: spotifyLinkUrl,
                title
            })
        });

        menuOptions.items.push({
            label: `Copy ${context} Link`,
            detail: `Copy ${context.toLowerCase()} link to your clipboard.`,
            cb: this.copyLink
        });

        const hasSlackAccess = await hasSlackWorkspaces();
        if (!hasSlackAccess) {
            // show divider
            menuOptions.items.push({
                label:
                    "___________________________________________________________________",
                cb: null,
                url: null,
                command: null
            });

            menuOptions.items.push({
                label: "Connect Slack",
                detail:
                    "To share a playlist or track on Slack, please connect your account",
                url: null,
                cb: connectSlackWorkspace
            });
        }

        showQuickPick(menuOptions);
    }

    copyLink() {
        MusicControlManager.getInstance().copySpotifyLink(
            musicId,
            playlistSelected
        );
    }

    async showSlackMessageInputPrompt() {
        return await window.showInputBox({
            value: `${title}`,
            placeHolder: "Enter a message to appear in the selected channel",
            validateInput: text => {
                return !text
                    ? "Please enter a valid message to continue."
                    : null;
            }
        });
    }

    async validateMessage(name: string) {
        // ...validate...
        await new Promise(resolve => setTimeout(resolve, 1000));
        // return name === 'vscode' ? 'Name not unique' : undefined;
    }

    async shareSlack() {
        const {selectedChannel, access_token} = await showSlackChannelMenu();
        if (!selectedChannel) {
            return;
        }
        // !!! important, need to use the get instance as this
        // method may be called within a callback and "this" will be undefined !!!
        const message = await SocialShareManager.getInstance().showSlackMessageInputPrompt();
        if (!message) {
            return;
        }

        const msg = `${message}\n${spotifyLinkUrl}`;
        const web = new WebClient(access_token);
        await web.chat
            .postMessage({
                text: msg,
                channel: selectedChannel,
                as_user: true
            })
            .then(r => {
                // notify the share is complete
                window.showInformationMessage(`Successfully shared the message to Slack.`);
            })
            .catch(err => {
                logIt(
                    "error posting slack message: " + err.message
                );
            });
    }
}
