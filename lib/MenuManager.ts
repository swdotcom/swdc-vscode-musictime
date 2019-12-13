import { window, QuickPickOptions, commands } from "vscode";
import { launchWebUrl } from "./Util";
import { launch_url } from "./Constants";

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
