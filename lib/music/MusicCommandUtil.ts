import { window } from "vscode";
import { accessExpired } from "cody-music";
import { disconnectSpotify, connectSpotify } from "./MusicControlManager";
import { getItem } from "../Util";
import { access } from "fs";
import { showReconnectPrompt } from "./MusicUtil";

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

        if (this.isTooManyRequestsError(result)) {
            window.showErrorMessage(
                "Currently experiencing frequent spotify requests, please try again soon."
            );
            return { status: 429 };
        }

        // check to see if the access token is still valid
        await this.checkIfAccessExpired(result);

        return result;
    }

    isTooManyRequestsError(result) {
        return this.getResponseStatus(result) === 429 ? true : false;
    }

    async checkIfAccessExpired(result) {
        if (this.getResponseStatus(result) === 401) {
            // check to see if they still have their access token
            const spotifyAccessToken = getItem("spotify_access_token");
            if (spotifyAccessToken && accessExpired()) {
                const email = getItem("name");

                // remove their current spotify info and initiate the auth flow
                await disconnectSpotify(false /*confirmDisconnect*/);

                showReconnectPrompt(email);
            }
        }
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
