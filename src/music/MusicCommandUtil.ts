import { window } from "vscode";
import { accessExpired } from "cody-music";
import { disconnectSpotify } from "./MusicControlManager";
import { getItem } from "../Util";
import { showReconnectPrompt } from "./MusicUtil";
import { getMusicTimeUserStatus } from "../DataController";
import { MusicManager } from "./MusicManager";
import { MusicDataManager } from "./MusicDataManager";

export class MusicCommandUtil {
    private static instance: MusicCommandUtil;

    private constructor() {
        //
    }

    static getInstance(): MusicCommandUtil {
        if (!MusicCommandUtil.instance) {
            MusicCommandUtil.instance = new MusicCommandUtil();
        }

        return MusicCommandUtil.instance;
    }

    async runSpotifyCommand(fnc: Function, args: any[] = null): Promise<any> {
        let result = null;
        if (args && args.length) {
            result = await fnc(...args);
        } else {
            result = await fnc();
        }

        // check to see if the access token is still valid
        await this.checkIfAccessExpired(result);
        const error = this.getResponseError(result);

        if (this.isTooManyRequestsError(result)) {
            console.log(
                "Currently experiencing frequent spotify requests, please try again soon."
            );
            return { status: 429 };
        } else if (error !== null) {
            window.showErrorMessage(error.message);
            return error;
        }

        return result;
    }

    isTooManyRequestsError(result) {
        return this.getResponseStatus(result) === 429 ? true : false;
    }

    async checkIfAccessExpired(result) {
        if (this.getResponseStatus(result) === 401) {
            // check to see if they still have their access token
            const spotifyAccessToken = getItem("spotify_access_token");
            if (spotifyAccessToken && (await accessExpired())) {
                // populate the user information in case then check accessExpired again
                let oauthResult = await getMusicTimeUserStatus();
                let expired = true;
                if (oauthResult.loggedOn) {
                    // try one last time
                    expired = await accessExpired();
                }

                if (expired) {
                    const email = getItem("name");

                    // remove their current spotify info and initiate the auth flow
                    await disconnectSpotify(false /*confirmDisconnect*/);

                    showReconnectPrompt(email);
                }
            }
        } else {
            const error = this.getResponseError(result);
            if (error) {
                window.showErrorMessage(error.message);
                return error;
            }
        }
    }

    // error.response.data.error has...
    // {message, reason, status}
    getResponseError(resp) {
        if (
            resp &&
            resp.error &&
            resp.error.response &&
            resp.error.response.data &&
            resp.error.response.data.error
        ) {
            const err = resp.error.response.data.error;
            const dataMgr: MusicDataManager = MusicDataManager.getInstance();
            if (
                !dataMgr.spotifyUser ||
                dataMgr.spotifyUser.product !== "premium"
            ) {
                return err;
            }
        }
        return null;
    }

    getResponseStatus(resp) {
        if (resp && resp.status) {
            return resp.status;
        } else if (resp && resp.data && resp.data.status) {
            return resp.data.status;
        } else if (
            resp &&
            resp.error &&
            resp.error.response &&
            resp.error.response.status
        ) {
            return resp.error.response.status;
        }
        return 200;
    }
}
