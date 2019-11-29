import { window, workspace, QuickPickOptions, commands } from "vscode";
import {
    launchWebUrl,
    getItem,
    getDashboardFile,
    isLinux,
    logIt,
    getDashboardRow,
    humanizeMinutes,
    getSummaryInfoFile,
    getSectionHeader
} from "./Util";
import { softwareGet, isResponseOk } from "./HttpClient";
import { launch_url } from "./Constants";
const moment = require("moment-timezone");

const fs = require("fs");

const SERVICE_NOT_AVAIL =
    "Our service is temporarily unavailable.\n\nPlease try again later.\n";

let lastMomentDate = null;

export function clearLastMomentDate() {
    lastMomentDate = null;
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
