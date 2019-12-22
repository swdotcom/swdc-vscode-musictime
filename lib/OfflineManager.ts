import {
    logIt,
    getSoftwareDir,
    isWindows,
    deleteFile,
    humanizeMinutes,
    showStatus,
    getNowTimes,
    getItem
} from "./Util";
import { DEFAULT_SESSION_THRESHOLD_SECONDS } from "./Constants";
import { serverIsAvailable } from "./DataController";
const fs = require("fs");

/**
 * {
    "currentDayMinutes": 2,
    "averageDailyMinutes": 1.516144578313253,
    "averageDailyKeystrokes": 280.07014725568945,
    "currentDayKeystrokes": 49,
    "liveshareMinutes": null
    }
    */
let sessionSummaryData = {
    currentDayMinutes: 0,
    averageDailyMinutes: 0,
    averageDailyKeystrokes: 0,
    currentDayKeystrokes: 0,
    liveshareMinutes: null,
    lastStart: null
};

export function clearSessionSummaryData() {
    sessionSummaryData = {
        currentDayMinutes: 0,
        averageDailyMinutes: 0,
        averageDailyKeystrokes: 0,
        currentDayKeystrokes: 0,
        liveshareMinutes: null,
        lastStart: null
    };

    saveSessionSummaryToDisk(sessionSummaryData);
}

export function setSessionSummaryLiveshareMinutes(minutes) {
    sessionSummaryData.liveshareMinutes = minutes;
}

export function getSessionThresholdSeconds() {
    const thresholdSeconds =
        getItem("sessionThresholdInSec") || DEFAULT_SESSION_THRESHOLD_SECONDS;
    return thresholdSeconds;
}

export function incrementSessionSummaryData(keystrokes) {
    // what is the gap from the previous start
    const nowTimes = getNowTimes();
    const nowInSec = nowTimes.now_in_sec;
    let incrementMinutes = 1;
    if (sessionSummaryData.lastStart) {
        const lastStart = parseInt(sessionSummaryData.lastStart, 10);
        // get the diff from the prev start
        const diffInSec = nowInSec - lastStart;
        // If it's less or equal to the session threshold seconds
        // then add to the minutes increment. But check if it's a positive
        // number in case the system clock has been moved to the future
        if (diffInSec > 0 && diffInSec <= getSessionThresholdSeconds()) {
            // it's still the same session, add the gap time in minutes
            const diffInMin = diffInSec / 60;
            incrementMinutes += diffInMin;
        }
    }
    sessionSummaryData.currentDayMinutes += incrementMinutes;
    sessionSummaryData.currentDayKeystrokes += keystrokes;
    sessionSummaryData.lastStart = nowInSec;

    saveSessionSummaryToDisk(sessionSummaryData);
}

export function updateStatusBarWithSummaryData() {
    // update the session summary data with what is found in the sessionSummary.json
    sessionSummaryData = getSessionSummaryFileAsJson();

    let currentDayMinutes = sessionSummaryData.currentDayMinutes;
    let currentDayMinutesTime = humanizeMinutes(currentDayMinutes);
    let averageDailyMinutes = sessionSummaryData.averageDailyMinutes;
    let averageDailyMinutesTime = humanizeMinutes(averageDailyMinutes);

    let inFlowIcon = currentDayMinutes > averageDailyMinutes ? "🚀 " : "";
    let msg = `${inFlowIcon}${currentDayMinutesTime}`;
    if (averageDailyMinutes > 0) {
        msg += ` | ${averageDailyMinutesTime}`;
    }
    showStatus(msg, null);
}

export function getSessionSummaryData() {
    return sessionSummaryData;
}

export function getSessionSummaryFile() {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\sessionSummary.json";
    } else {
        file += "/sessionSummary.json";
    }
    return file;
}

export function saveSessionSummaryToDisk(sessionSummaryData) {
    try {
        // JSON.stringify(data, replacer, number of spaces)
        const content = JSON.stringify(sessionSummaryData, null, 4);
        fs.writeFileSync(getSessionSummaryFile(), content, err => {
            if (err)
                logIt(
                    `Deployer: Error writing session summary data: ${err.message}`
                );
        });
    } catch (e) {
        //
    }
}

export function getSessionSummaryFileAsJson() {
    let data = null;
    let file = getSessionSummaryFile();
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file).toString();
        if (content) {
            try {
                data = JSON.parse(content);
            } catch (e) {
                logIt(`unable to read session info: ${e.message}`);
                // error trying to read the session file, delete it
                deleteFile(file);
                data = {};
            }
        }
    }
    return data ? data : {};
}

/**
 * Fetch the data rows of a given file
 * @param file
 */
export async function getDataRows(file) {
    const isonline = await serverIsAvailable();
    if (!isonline) {
        return [];
    }
    try {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file).toString();
            // we're online so just delete the file
            deleteFile(file);
            if (content) {
                const payloads = content
                    .split(/\r?\n/)
                    .map(item => {
                        let obj = null;
                        if (item) {
                            try {
                                obj = JSON.parse(item);
                            } catch (e) {
                                //
                            }
                        }
                        if (obj) {
                            return obj;
                        }
                    })
                    .filter(item => item);
                return payloads;
            }
        }
    } catch (e) {
        logIt(`Unable to read data file ${file}: ${e.message}`);
    }
    return [];
}
