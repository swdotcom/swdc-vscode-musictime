import {
    storePayload,
    getOs,
    getVersion,
    logIt,
    getNowTimes,
    getPluginId
} from "./Util";

// ? marks that the parameter is optional
type Project = {
    directory: String;
    name?: String;
    identifier: String;
    resource: {};
};

export class KpmDataManager {
    public source: {};
    public keystrokes: Number;
    public start: Number;
    public local_start: Number;
    public timezone: String;
    public project: Project;
    public pluginId: Number;
    public version: String;
    public os: String;
    public repoContributorCount: Number;
    public repoFileCount: Number;

    constructor(project: Project) {
        this.source = {};
        this.keystrokes = 0;
        this.project = project;
        this.pluginId = getPluginId();
        this.version = getVersion();
        this.os = getOs();
        this.repoContributorCount = 0;
        this.repoFileCount = 0;
        this.keystrokes = 0;
    }

    /**
     * check if the payload should be sent or not
     */
    hasData() {
        // delete files that don't have any kpm data
        let foundKpmData = false;
        if (this.keystrokes > 0) {
            return true;
        }
        for (const fileName of Object.keys(this.source)) {
            const fileInfoData = this.source[fileName];
            // check if any of the metric values has data
            if (
                fileInfoData &&
                (fileInfoData.add > 0 ||
                    fileInfoData.paste > 0 ||
                    fileInfoData.open > 0 ||
                    fileInfoData.close > 0 ||
                    fileInfoData.delete > 0 ||
                    fileInfoData.linesAdded > 0 ||
                    fileInfoData.linesRemoved > 0)
            ) {
                foundKpmData = true;
            } else {
                delete this.source[fileName];
            }
        }
        return foundKpmData;
    }

    getLatestPayload() {
        const payload = JSON.parse(JSON.stringify(this));
        return payload;
    }

    /**
     * send the payload
     */
    postData() {
        const payload = this.getLatestPayload();

        // set the end time for the session
        let nowTimes = getNowTimes();
        payload["end"] = nowTimes.now_in_sec;
        payload["local_end"] = nowTimes.local_now_in_sec;
        const keys = Object.keys(payload.source);
        if (keys && keys.length > 0) {
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                // ensure there is an end time
                const end = parseInt(payload.source[key]["end"], 10) || 0;
                if (end === 0) {
                    // set the end time for this file event
                    let nowTimes = getNowTimes();
                    payload.source[key]["end"] = nowTimes.now_in_sec;
                    payload.source[key]["local_end"] =
                        nowTimes.local_now_in_sec;
                }
            }
        }

        payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const projectName =
            payload.project && payload.project.directory
                ? payload.project.directory
                : "null";

        // Null out the project if the project's name is 'null'
        if (projectName === "null") {
            payload.project = null;
        }

        logIt(`storing kpm metrics`);
        storePayload(payload);
    }
}
