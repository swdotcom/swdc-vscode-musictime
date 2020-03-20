import { window } from "vscode";

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
        return result;
    }

    isTooManyRequestsError(result) {
        return result &&
            result.error &&
            result.error.response &&
            result.error.response.status === 429
            ? true
            : false;
    }
}
