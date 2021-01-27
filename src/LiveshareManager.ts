import { softwarePost, isResponseOk } from "./HttpClient";
import { getItem } from "./managers/FileManager";

export async function manageLiveshareSession(session) {
    softwarePost("/data/liveshare", session, getItem("jwt"))
        .then(async resp => {
            if (!isResponseOk(resp)) {
                console.debug(`unable to sync liveshare metrics: ${resp.message}`);
            }
        })
        .catch(err => {
            console.debug(`unable to sync liveshare metrics: ${err.message}`);
        });
}
