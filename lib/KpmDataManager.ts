import {
    storePayload,
    storeKpmDataForMusic,
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
        const keys = Object.keys(this.source);
        if (!keys || keys.length === 0) {
            return false;
        }

        // delete files that don't have any kpm data
        let foundKpmData = false;
        if (this.keystrokes > 0) {
            foundKpmData = true;
        }

        // Now remove files that don't have any keystrokes that only
        // have an open or close associated with them. If they have
        // open AND close then it's ok, keep it.
        let keystrokesTally = 0;
        keys.forEach(key => {
            const data = this.source[key];

            const hasOpen = data.open > 0;
            const hasClose = data.close > 0;
            // tally the keystrokes for this file
            data.keystrokes =
                data.add +
                data.paste +
                data.delete +
                data.linesAdded +
                data.linesRemoved;
            const hasKeystrokes = data.keystrokes > 0;
            keystrokesTally += data.keystrokes;
            if (
                (hasOpen && !hasClose && !hasKeystrokes) ||
                (hasClose && !hasOpen && !hasKeystrokes)
            ) {
                // delete it, no keystrokes and only an open
                delete this.source[key];
            } else if (!foundKpmData && hasOpen && hasClose) {
                foundKpmData = true;
            }
        });

        if (keystrokesTally > 0 && keystrokesTally !== this.keystrokes) {
            // use the keystrokes tally
            foundKpmData = true;
            this.keystrokes = keystrokesTally;
        }
        return foundKpmData;
    }

    getLatestPayload() {
        let payload: any = {};
        try {
            payload = JSON.parse(JSON.stringify(this));
            if (payload.source) {
                // set the end time for the session
                let nowTimes = getNowTimes();
                payload["end"] = nowTimes.now_in_sec;
                payload["local_end"] = nowTimes.local_now_in_sec;
                const keys = Object.keys(payload.source);
                if (keys && keys.length > 0) {
                    for (let i = 0; i < keys.length; i++) {
                        const key = keys[i];
                        // ensure there is an end time
                        const end =
                            parseInt(payload.source[key]["end"], 10) || 0;
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
            }
        } catch (e) {
            //
        }
        return payload;
    }

    postMusicData(payload: any) {
        logIt(`storing kpm metrics for music time`);
        storeKpmDataForMusic(payload);
    }

    /**
     * send the payload
     */
    postData(payload: any) {
        logIt(`storing kpm metrics`);
        storePayload(payload);
    }
}
