import { accessExpired } from "cody-music";
import { logIt } from '../Util';
import { getDeviceSet } from "../managers/PlaylistDataManager";

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

    const resultStatus = this.getResponseStatus(result);
    if (resultStatus === 401 || resultStatus === 429) {
      // check to see if the access token is still valid
      await this.checkIfAccessExpired(result);
      const error = this.getResponseError(result);

      if (this.isTooManyRequestsError(result)) {
        logIt("Currently experiencing frequent spotify requests, please try again soon.");
        return { status: 429 };
      } else if (error !== null) {
        return error;
      }
    }

    return result;
  }

  async checkIfAccessExpired(result) {
    if (this.getResponseStatus(result) === 401) {
      let expired = await accessExpired();
      if (expired) {
        console.error("Spotify access expired: ", result);
      }
    } else {
      const error = this.getResponseError(result);
      if (error) {
        logIt("Spotify access expired error: " + error.message);
      }
    }
  }

  isTooManyRequestsError(result) {
    return this.getResponseStatus(result) === 429 ? true : false;
  }

  async isDeviceError(result) {
    if (result && this.getResponseStatus(result) === 404) {
      // check to see if there's an active device
      const { webPlayer, desktop, activeDevice, activeComputerDevice, activeWebPlayerDevice } = getDeviceSet();
      if (!webPlayer && !desktop) {
        return true;
      }
    }
    return false;
  }

  // error.response.data.error has...
  // {message, reason, status}
  getResponseError(resp) {
    if (resp && resp.error && resp.error.response && resp.error.response.data && resp.error.response.data.error) {
      return resp.error.response.data.error;
    }
    return null;
  }

  getResponseStatus(resp) {
    if (resp && resp.status) {
      return resp.status;
    } else if (resp && resp.data && resp.data.status) {
      return resp.data.status;
    } else if (resp && resp.error && resp.error.response && resp.error.response.status) {
      return resp.error.response.status;
    }
    return 200;
  }
}
