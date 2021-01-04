import { getOs, getVersion, getNowTimes, getPluginId } from "./Util";

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

  getLatestPayload() {
    let payload: any = {};
    try {
      payload = JSON.parse(JSON.stringify(this));
      payload = completePayloadInfo(payload);
    } catch (e) {
      //
    }
    return payload;
  }
}

export function completePayloadInfo(payload) {
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
                const end = parseInt(payload.source[key]["end"], 10) || 0;
                if (end === 0) {
                    // set the end time for this file event
                    let nowTimes = getNowTimes();
                    payload.source[key]["end"] = nowTimes.now_in_sec;
                    payload.source[key]["local_end"] = nowTimes.local_now_in_sec;
                }
            }
        }

        payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    return payload;
}
