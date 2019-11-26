import {
    window,
    workspace,
    QuickPickOptions,
    ViewColumn,
    commands
} from "vscode";
import {
    launchWebUrl,
    getItem,
    getDashboardFile,
    isLinux,
    toggleStatusBar,
    logIt,
    getDashboardRow,
    humanizeMinutes,
    getSummaryInfoFile,
    launchLogin,
    getSectionHeader,
    isStatusBarTextVisible
} from "./Util";
import { softwareGet, isResponseOk } from "./HttpClient";
import {
    getUserStatus,
    serverIsAvailable,
    getLoggedInCacheState,
    getSessionSummaryStatus
} from "./DataController";
import { launch_url, LOGIN_LABEL } from "./Constants";
const moment = require("moment-timezone");

const fs = require("fs");

const SERVICE_NOT_AVAIL =
    "Our service is temporarily unavailable.\n\nPlease try again later.\n";

let showMusicMetrics = false;
let lastMomentDate = null;

export function clearLastMomentDate() {
    lastMomentDate = null;
}

/**
 * fetch the show music metrics flag
 */
export function updateShowMusicMetrics(val) {
    showMusicMetrics = val;
}

/**
 * Pass in the following array of objects
 * options: {placeholder, items: [{label, description, url, detail, tooltip},...]}
 */

export function showQuickPick(pickOptions): any {
    if (!pickOptions || !pickOptions["items"]) {
        return;
    }
    let options: QuickPickOptions = {
        matchOnDescription: false,
        matchOnDetail: false,
        placeHolder: pickOptions.placeholder || ""
    };

    return window.showQuickPick(pickOptions.items, options).then(async item => {
        if (item) {
            let url = item["url"];
            let cb = item["cb"];
            let command = item["command"];
            if (url) {
                launchWebUrl(url);
            } else if (cb) {
                cb();
            } else if (command) {
                commands.executeCommand(command);
            }
        }
        return item;
    });
}

export async function buildWebDashboardUrl() {
    return launch_url;
}

export async function showMenuOptions() {
    let loggedInCacheState = getLoggedInCacheState();
    let serverIsOnline = await serverIsAvailable();
    let userStatus = {
        loggedIn: loggedInCacheState
    };
    if (loggedInCacheState === null) {
        // update it since it's null
        // {loggedIn: true|false}
        userStatus = await getUserStatus(serverIsOnline);
    }

    // {placeholder, items: [{label, description, url, details, tooltip},...]}
    let kpmMenuOptions = {
        items: []
    };

    kpmMenuOptions.items.push({
        label: "Code Time Dashboard",
        detail: "View your latest coding metrics right here in your editor",
        url: null,
        cb: displayCodeTimeMetricsDashboard
    });

    let loginMsgDetail =
        "To see your coding data in Code Time, please log in to your account";
    if (!serverIsOnline) {
        loginMsgDetail =
            "Our service is temporarily unavailable. Please try again later.";
    }
    if (!userStatus.loggedIn) {
        kpmMenuOptions.items.push({
            label: LOGIN_LABEL,
            detail: loginMsgDetail,
            url: null,
            cb: launchLogin
        });
    }

    let toggleStatusBarTextLabel = "Hide Status Bar Metrics";
    if (!isStatusBarTextVisible()) {
        toggleStatusBarTextLabel = "Show Status Bar Metrics";
    }
    kpmMenuOptions.items.push({
        label: toggleStatusBarTextLabel,
        detail: "Toggle the Code Time status bar metrics text",
        url: null,
        cb: toggleStatusBar
    });

    // if (userStatus.loggedIn && showMusicMetrics) {
    //     kpmMenuOptions.items.push({
    //         label: "Software Top 40",
    //         detail:
    //             "Top 40 most popular songs developers around the world listen to as they code",
    //         url: "https://api.software.com/music/top40",
    //         cb: null
    //     });
    // }

    kpmMenuOptions.items.push({
        label: "Submit an issue on GitHub",
        detail: "Encounter a bug? Submit an issue on our GitHub page",
        url: "https://github.com/swdotcom/swdc-vscode/issues",
        cb: null
    });

    kpmMenuOptions.items.push({
        label: "Submit Feedback",
        detail: "Send us an email at cody@software.com.",
        url: "mailto:cody@software.com",
        cb: null
    });

    if (userStatus.loggedIn) {
        kpmMenuOptions.items.push({
            label: "Web Dashboard",
            detail: "See rich data visualizations in the web app",
            url: null,
            cb: launchWebDashboardView
        });
    }

    showQuickPick(kpmMenuOptions);
}

export async function launchWebDashboardView() {
    let webUrl = await buildWebDashboardUrl();
    launchWebUrl(`${webUrl}/login`);
}

export async function fetchCodeTimeMetricsDashboard(summary) {
    let summaryInfoFile = getSummaryInfoFile();

    const duration = lastMomentDate
        ? moment.duration(moment().diff(lastMomentDate))
        : null;
    const hours = duration ? duration.asHours() : 6;
    if (hours >= 6) {
        lastMomentDate = moment();

        // let showMusicMetrics = workspace
        //     .getConfiguration()
        //     .get("showMusicMetrics");
        let showGitMetrics = workspace.getConfiguration().get("showGitMetrics");
        // let showWeeklyRanking = workspace
        //     .getConfiguration()
        //     .get("showWeeklyRanking");

        let api = `/dashboard?showMusic=false&showGit=${showGitMetrics}&showRank=false&linux=${isLinux()}&showToday=false`;
        const dashboardSummary = await softwareGet(api, getItem("jwt"));

        let summaryContent = "";

        if (isResponseOk(dashboardSummary)) {
            // get the content
            summaryContent += dashboardSummary.data;
        } else {
            summaryContent = SERVICE_NOT_AVAIL;
        }

        fs.writeFileSync(summaryInfoFile, summaryContent, err => {
            if (err) {
                logIt(
                    `Error writing to the code time summary content file: ${err.message}`
                );
            }
        });
    }

    // concat summary info with the dashboard file
    let dashboardFile = getDashboardFile();
    let dashboardContent = "";
    const formattedDate = moment().format("ddd, MMM Do h:mma");
    dashboardContent = `CODE TIME          (Last updated on ${formattedDate})`;
    dashboardContent += "\n\n";

    const todayStr = moment().format("ddd, MMM Do");
    dashboardContent += getSectionHeader(`Today (${todayStr})`);

    if (summary) {
        let averageTime = humanizeMinutes(summary.averageDailyMinutes);
        let hoursCodedToday = humanizeMinutes(summary.currentDayMinutes);
        let liveshareTime = null;
        if (summary.liveshareMinutes) {
            liveshareTime = humanizeMinutes(summary.liveshareMinutes);
        }
        dashboardContent += getDashboardRow(
            "Hours coded today",
            hoursCodedToday
        );
        dashboardContent += getDashboardRow("90-day avg", averageTime);
        if (liveshareTime) {
            dashboardContent += getDashboardRow("Live Share", liveshareTime);
        }
        dashboardContent += "\n";
    }

    if (fs.existsSync(summaryInfoFile)) {
        const summaryContent = fs.readFileSync(summaryInfoFile).toString();

        // create the dashboard file
        dashboardContent += summaryContent;
    }

    fs.writeFileSync(dashboardFile, dashboardContent, err => {
        if (err) {
            logIt(
                `Error writing to the code time dashboard content file: ${err.message}`
            );
        }
    });
}

export async function displayCodeTimeMetricsDashboard() {
    let filePath = getDashboardFile();

    let result = await getSessionSummaryStatus();

    if (result.status === "OK") {
        fetchCodeTimeMetricsDashboard(result.data);
    }

    workspace.openTextDocument(filePath).then(doc => {
        // only focus if it's not already open
        window.showTextDocument(doc, ViewColumn.One, false).then(e => {
            // done
        });
    });
}
