import { getOs, getVersion, getPluginId, getNowTimes } from "../Util";
import Project from "./Project";
import { PluginDataManager } from "../managers/PluginDataManager";

export default class KeystrokeStats {
  public source: {};
  public keystrokes: number = 0;
  public start: number = 0;
  public local_start: number = 0;
  public end: number = 0;
  public local_end: number = 0;
  public timezone: string;
  public project: Project;
  public pluginId: number;
  public version: string;
  public os: string;
  public repoContributorCount: number;
  public repoFileCount: number;
  public cumulative_editor_seconds: number = 0;
  public cumulative_session_seconds: number = 0;
  public elapsed_seconds: number = 0;
  public workspace_name: string = "";
  public hostname: string = "";
  public project_null_error: string = "";
  // new as of 6/10/2020
  public elapsed_code_time_seconds: number = 0;
  public elapsed_active_code_time_seconds: number = 0;
  public cumulative_code_time_seconds: number = 0;
  public cumulative_active_code_time_seconds: number = 0;

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
    this.cumulative_editor_seconds = 0;
    this.cumulative_session_seconds = 0;
    this.elapsed_seconds = 0;
    this.project_null_error = "";
    this.hostname = "";
    this.workspace_name = "";
  }

  getCurrentStatsData() {
    return JSON.parse(JSON.stringify(this));
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

    // Now remove files that don't have any keystrokes. These
    // are most likely open/close event files.
    let keystrokesTally = 0;
    keys.forEach((key) => {
      const data = this.source[key];
      if (!data.keystrokes) {
        // delete it, no keystrokes
        delete this.source[key];
      } else {
        keystrokesTally += data.keystrokes;
      }
    });

    if (keystrokesTally && !foundKpmData) {
      // use the keystrokes tally
      foundKpmData = true;
      this.keystrokes = keystrokesTally;
    }
    return foundKpmData;
  }

  /**
   * send the payload
   */
  async postData(isUnfocus: boolean = false) {
    // create the now times in case it's the secondary window and we have to wait
    const nowTimes = getNowTimes();
    PluginDataManager.getInstance().processPayloadHandler(this, nowTimes, isUnfocus);
  }
}
