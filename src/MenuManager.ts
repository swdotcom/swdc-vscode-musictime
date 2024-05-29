import { window, QuickPickOptions, commands } from "vscode";
import { launchWebUrl } from "./Util";
import { app_endpoint } from "./Constants";

/**
 * Pass in the following array of objects
 * options: {placeholder, items: [{label, description, url, detail, tooltip},...]}
 */

export function showQuickPick(pickOptions): any {
    if (!pickOptions || !pickOptions["items"]) {
        return;
    }
    const options: QuickPickOptions = {
        matchOnDescription: false,
        matchOnDetail: false,
        placeHolder: pickOptions.placeholder || ""
    };

    return window.showQuickPick(pickOptions.items, options).then(async item => {
        if (item) {
            const url = item["url"];
            const cb = item["cb"];
            const command = item["command"];
            const args = item["args"];
            if (url) {
                launchWebUrl(url);
            } else if (cb) {
                cb();
            } else if (command) {
                commands.executeCommand(command, args);
            }
        }
        return item;
    });
}

export async function buildWebDashboardUrl() {
    return app_endpoint;
}

export async function launchWebDashboardView() {
    const webUrl = await buildWebDashboardUrl();
    launchWebUrl(`${webUrl}/login`);
}
