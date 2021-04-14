
import { softwareGet, isResponseOk } from "./HttpClient";

const moment = require("moment-timezone");

let currentDayHour = null;

export function isNewHour() {
    const dayHr = moment().format("YYYY-MM-DD-HH");

    if (!currentDayHour || dayHr !== currentDayHour) {
        currentDayHour = dayHr;
        return true;
    }

    return false;
}

export async function serverIsAvailable() {
    let serverAvailable = await softwareGet("/ping", null)
        .then((result) => {
            return isResponseOk(result);
        })
        .catch((e) => {
            return false;
        });
    return serverAvailable;
}
