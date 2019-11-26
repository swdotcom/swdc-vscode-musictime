import { softwarePost, isResponseOk } from "./HttpClient";
import { getItem, logIt } from "./Util";

export async function manageLiveshareSession(session) {
    softwarePost("/data/liveshare", session, getItem("jwt"))
        .then(async resp => {
            if (isResponseOk(resp)) {
                logIt("completed liveshare sync");
            } else {
                logIt(`unable to sync liveshare metrics: ${resp.message}`);
            }
        })
        .catch(err => {
            logIt(`unable to sync liveshare metrics: ${err.message}`);
        });
}
