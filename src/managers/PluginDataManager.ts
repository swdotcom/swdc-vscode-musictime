import {
  getNowTimes,
  getProjectFolder,
  getWorkspaceName,
  getHostname,
  coalesceNumber,
} from "../Util";
import {
  getFileDataAsJson,
  storeJsonData,
  getTimeCounterFile,
  isNewDay,
  setItem
} from "./FileManager";
import TimeCounterStats from "../model/TimeCounterStats";
import {
  clearSessionSummaryData,
  getTimeBetweenLastPayload,
  incrementSessionSummaryData,
} from "../storage/SessionSummaryData";
import {
  clearFileChangeInfoSummaryData,
  getFileChangeSummaryAsJson,
  saveFileChangeInfoToDisk,
} from "../storage/FileChangeInfoSummaryData";
import { SummaryManager } from "./SummaryManager";
import KeystrokeStats from "../model/KeystrokeStats";
import { UNTITLED, NO_PROJ_NAME } from "../Constants";
import { WorkspaceFolder } from "vscode";
import {
  getResourceInfo,
  getRepoContributorInfo,
  getRepoFileCount,
  getFileContributorCount,
} from "../KpmRepoManager";
import Project from "../model/Project";
import RepoContributorInfo from "../model/RepoContributorInfo";
import { FileChangeInfo, KeystrokeAggregate } from "../model/models";
import TimeData from "../model/TimeData";
import { clearTimeDataSummary, incrementSessionAndFileSecondsAndFetch } from "../storage/TimeSummaryData";
import { TrackerManager } from "./TrackerManager";

const moment = require("moment-timezone");
const path = require("path");

const FIFTEEN_MIN_IN_SECONDS: number = 60 * 15;
const TWO_MIN_INTERVAL: number = 1000 * 60 * 2;


export class PluginDataManager {
  private static instance: PluginDataManager;

  private stats: TimeCounterStats = null;
  private dayCheckTimer: any = null;

  private constructor() {
    this.initializePluginDataMgr();
  }

  static getInstance(): PluginDataManager {
    if (!PluginDataManager.instance) {
      PluginDataManager.instance = new PluginDataManager();
    }

    return PluginDataManager.instance;
  }

  dispose() {
    if (this.dayCheckTimer) {
      clearInterval(this.dayCheckTimer);
    }
  }

  /**
   * Fetch the data from the timeCounter.json to
   * populate the tiemstamp and seconds values that may
   * have been set from another window or editor
   */
  initializePluginDataMgr() {
    // get the time counter file
    const timeCounterJson = getFileDataAsJson(getTimeCounterFile());
    if (timeCounterJson) {
      this.stats = {
        ...timeCounterJson,
      };
    } else {
      // if our stats are null, initialize it with defaults
      this.stats = new TimeCounterStats();
    }

    // call the focused handler
    this.initializeFocusStats();

    // Initialize the midnight check handler
    this.dayCheckTimer = setInterval(() => {
      this.midnightCheckHandler();
    }, TWO_MIN_INTERVAL);

    // check right away
    this.midnightCheckHandler();
  }

  /**
   * Save all of the updated attributes to the timeCounter.json
   */
  updateFileData() {
    if (this.stats) {
      storeJsonData(getTimeCounterFile(), this.stats);
    }
  }

  initializeFocusStats() {
    const nowTimes = getNowTimes();
    this.stats.last_focused_timestamp_utc = nowTimes.now_in_sec;
    // update the file
    this.updateFileData();
  }

  /**
     * Step 1) Replace last_focused_timestamp_utc with current time (utc)
     * Step 2) Update the elapsed_time_seconds based on the following condition
      const diff = now - last_unfocused_timestamp_utc;
      if (diff <= fifteen_minutes_in_seconds) {
        elapsed_code_time_seconds += diff;
      }
    * Step 3) Clear "last_unfocused_timestamp_utc"
    */
  editorFocusHandler() {
    const timeCounterJson = getFileDataAsJson(getTimeCounterFile());
    if (timeCounterJson) {
      this.stats = {
        ...timeCounterJson,
      };
    }
    const now = moment.utc().unix();

    // Step 1) Replace last_focused_timestamp_utc with current time (utc)
    this.stats.last_focused_timestamp_utc = now;

    // Step 2) Update the elapsed_time_seconds
    let unfocused_diff = coalesceNumber(now - this.stats.last_unfocused_timestamp_utc);
    const diff = Math.max(unfocused_diff, 0);
    if (diff <= FIFTEEN_MIN_IN_SECONDS) {
      this.stats.elapsed_code_time_seconds += diff;
    }
    // Step 3) Clear "last_unfocused_timestamp_utc"
    this.stats.last_unfocused_timestamp_utc = 0;

    // update the file
    this.updateFileData();
  }

  /**
     * Step 1) Replace last_unfocused_timestamp_utc
     * Step 2) Update elapsed_code_time_seconds based on the following condition
      const diff = now - last_focused_timestamp_utc;
      if (diff <=fifteen_minutes_in_seconds) {
        elapsed_code_time_seconds += diff;
      }
    * Step 3) Clear "last_focused_timestamp_utc"
    */
  editorUnFocusHandler() {
    const timeCounterJson = getFileDataAsJson(getTimeCounterFile());
    if (timeCounterJson) {
      this.stats = {
        ...timeCounterJson,
      };
    }
    const now = moment.utc().unix();

    // Step 1) Replace last_focused_timestamp_utc with current time (utc)
    this.stats.last_unfocused_timestamp_utc = now;

    // Step 2) Update elapsed_code_time_seconds
    let focused_diff = coalesceNumber(now - this.stats.last_focused_timestamp_utc);
    const diff = Math.max(focused_diff, 0);
    if (diff <= FIFTEEN_MIN_IN_SECONDS) {
      this.stats.elapsed_code_time_seconds += diff;
    }
    // Step 3) Clear "last_focused_timestamp_utc"
    this.stats.last_focused_timestamp_utc = 0;

    // update the file
    this.updateFileData();
  }

  /**
   * If it's a new day...
   * Step 1)
   *   Send offline data
   * Step 2)
   *   Clear "cumulative_code_time_seconds"
   *   Clear "cumulative_active_code_time_seconds"
   * Step 3)
   *   Send other types of offline data like the time data
   * Step 4)
   *   Clear file metrics and set current day to today
   */
  async midnightCheckHandler() {
    if (isNewDay()) {

      // reset stats
      this.clearStatsForNewDay();

      // Clear the session summary data (report and status bar info)
      clearSessionSummaryData();

      // clear time data data. this will also clear the
      // code time and active code time numbers
      clearTimeDataSummary();

      // clear the file change info (metrics shown in the tree)
      clearFileChangeInfoSummaryData();

      // update the current day
      const nowTimes = getNowTimes();
      setItem("currentDay", nowTimes.day);

      setTimeout(() => {
        SummaryManager.getInstance().updateSessionSummaryFromServer();
      }, 5000);
    }
  }

  /**
     * Step 1) Updating the "elapsed_code_time_seconds" one more time based on the following condition
      const diff = now - last_focused_timestamp_utc;
      if (diff < fifteen_minutes_in_seconds) {
        elapsed_code_time_seconds += diff;
      }
      focused_editor_seconds = diff;
    * Step 2) Replace "last_focused_timestamp_utc" with now
    * Step 3) Update "elapsed_seconds" with the following condition
      elapsed_seconds = now - last_payload_end_utc;
    * Step 4) Update "elapsed_active_code_time_seconds" with the following condition
      get the MIN of elapsed_seconds and focused_editor_seconds
      const min_elapsed_active_code_time_seconds = Math.min(
        this.stats.elapsed_seconds,
        this.stats.focused_editor_seconds
      );
    * Step 5) Update "cumulative_code_time_seconds" with the following condition
      cumulative_code_time_seconds += elapsed_code_time_seconds;
    * Step 6) Update "cumulative_active_code_time_seconds" with the following condition
      cumulative_active_code_time_seconds += elapsed_active_code_time_seconds
    * Step 7) Replace "last_payload_end_utc" with now
    * Step 8) Clear "elapsed_code_time_seconds"
    * Step 9) Clear "focused_editor_seconds"
    */
  async processPayloadHandler(
    payload: KeystrokeStats,
    nowTimes: any,
    isUnfocus: boolean = false
  ) {
    // this should take the now_in_sec as the truth since the unfocus
    // will trigger the process payload and can happen under a minute
    const now = Math.min(nowTimes.now_in_sec, payload.start + 60);

    const timeCounterJson = getFileDataAsJson(getTimeCounterFile());
    if (timeCounterJson) {
      this.stats = {
        ...timeCounterJson,
      };
    }

    // set the payload's end times
    payload.end = now;
    payload.local_end = nowTimes.local_now_in_sec;
    // set the timezone
    payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Step 1) add to the elapsed code time seconds if its less than 15 min
    // set the focused_editor_seconds to the diff
    // get the time from the last time the window was focused and unfocused
    let payload_diff = coalesceNumber(now - this.stats.last_focused_timestamp_utc);
    let diff = Math.max(payload_diff, 0);
    if (diff <= FIFTEEN_MIN_IN_SECONDS) {
      this.stats.elapsed_code_time_seconds += diff;
      this.stats.focused_editor_seconds = diff;
    }

    // Step 2) Replace "last_focused_timestamp_utc" with now
    this.stats.last_focused_timestamp_utc = now;

    // Step 3) update the elapsed seconds based on the now minus the last payload end time
    let elapsed_seconds_dif = coalesceNumber(now - this.stats.last_payload_end_utc);
    this.stats.elapsed_seconds = Math.max(elapsed_seconds_dif, 0);

    // Step 4) Update "elapsed_active_code_time_seconds"
    // get the MIN of elapsed_seconds and focused_editor_seconds
    let min_elapsed_active_code_time_seconds = Math.min(
      this.stats.elapsed_seconds,
      this.stats.focused_editor_seconds
    );
    min_elapsed_active_code_time_seconds = coalesceNumber(min_elapsed_active_code_time_seconds);
    // make sure min_elapsed_active_code_time_seconds is not negative
    min_elapsed_active_code_time_seconds = Math.max(min_elapsed_active_code_time_seconds, 0);
    // set the elapsed_active_code_time_seconds to the min of the above only
    // if its greater than zero and less than/equal to 15 minutes
    this.stats.elapsed_active_code_time_seconds =
      min_elapsed_active_code_time_seconds <= FIFTEEN_MIN_IN_SECONDS
        ? min_elapsed_active_code_time_seconds
        : 0;

    // Step 5) Update "cumulative_code_time_seconds"
    this.stats.cumulative_code_time_seconds += this.stats.elapsed_code_time_seconds;
    // Step 6) Update "cumulative_active_code_time_seconds"
    this.stats.cumulative_active_code_time_seconds += this.stats.elapsed_active_code_time_seconds;

    // Step 7) Replace "last_payload_end_utc" with now
    this.stats.last_payload_end_utc = now;

    // PAYLOAD related updates. stats have been merged to payload object by now
    payload.elapsed_code_time_seconds = this.stats.elapsed_code_time_seconds;
    payload.elapsed_active_code_time_seconds = this.stats.elapsed_active_code_time_seconds;
    payload.cumulative_code_time_seconds = this.stats.cumulative_code_time_seconds;
    payload.cumulative_active_code_time_seconds = this.stats.cumulative_active_code_time_seconds;

    // Final steps after setting the payload above
    // Step 8) Clear "elapsed_code_time_seconds"
    // Step 9) Clear "focused_editor_seconds"
    this.stats.focused_editor_seconds = 0;
    this.stats.elapsed_code_time_seconds = 0;

    // FINAL: update the file with the updated stats
    this.updateFileData();

    // ensure the payload has the project info
    await this.populatePayloadProject(payload);

    // make sure all files have an end time
    await this.completeFileEndTimes(payload, nowTimes);

    // Get time between payloads
    const { sessionSeconds } = getTimeBetweenLastPayload();
    await this.updateCumulativeSessionTime(payload, sessionSeconds);

    // update the aggregation data for the tree info
    this.aggregateFileMetrics(payload, sessionSeconds);

    // Update the latestPayloadTimestampEndUtc. It's used to determine session time and elapsed_seconds
    const latestPayloadTimestampEndUtc = getNowTimes().now_in_sec;
    setItem("latestPayloadTimestampEndUtc", latestPayloadTimestampEndUtc);

    // Set the unfocused timestamp only if the isUnfocus flag is true.
    // When the user is typing more than a minute or if this is the bootstrap
    // payload, the "isUnfocus" will not be set to true
    if (isUnfocus) {
      this.editorUnFocusHandler();
    }

    // send the payload to the tracker manager
    TrackerManager.getInstance().trackCodeTimeEvent(payload);
  }

  async clearStatsForNewDay() {
    const nowTimes = getNowTimes();
    // reset stats
    this.stats.cumulative_code_time_seconds = 0;
    this.stats.cumulative_active_code_time_seconds = 0;
    this.stats.elapsed_code_time_seconds = 0;
    this.stats.focused_editor_seconds = 0;
    // set the current day
    this.stats.current_day = nowTimes.day;
    // update the file with the updated stats
    this.updateFileData();
  }

  //// Everything after this line is for time counter v1 ////

  async aggregateFileMetrics(payload, sessionSeconds) {
    // get a mapping of the current files
    const fileChangeInfoMap = getFileChangeSummaryAsJson();
    await this.updateAggregateInfo(fileChangeInfoMap, payload, sessionSeconds);

    // write the fileChangeInfoMap
    saveFileChangeInfoToDisk(fileChangeInfoMap);
  }

  async populateRepoMetrics(payload: KeystrokeStats) {
    if (payload.project && payload.project.identifier && payload.project.directory) {
      // REPO contributor count
      const repoContributorInfo: RepoContributorInfo = await getRepoContributorInfo(
        payload.project.directory,
        true
      );
      payload.repoContributorCount = repoContributorInfo ? repoContributorInfo.count || 0 : 0;

      // REPO file count
      const repoFileCount = await getRepoFileCount(payload.project.directory);
      payload.repoFileCount = repoFileCount || 0;
    } else {
      payload.repoContributorCount = 0;
      payload.repoFileCount = 0;
    }
  }

  /**
   * Populate the project information for this specific payload
   * @param payload
   */
  async populatePayloadProject(payload: KeystrokeStats) {
    // GET the project
    // find the best workspace root directory from the files within the payload
    const keys = Object.keys(payload.source);
    let directory = UNTITLED;
    let projName = NO_PROJ_NAME;
    let resourceInfo = null;
    for (let i = 0; i < keys.length; i++) {
      const fileName = keys[i];
      const workspaceFolder: WorkspaceFolder = getProjectFolder(fileName);
      if (workspaceFolder) {
        directory = workspaceFolder.uri.fsPath;
        projName = workspaceFolder.name;
        // since we have this, look for the repo identifier
        resourceInfo = await getResourceInfo(directory);
        break;
      }
    }

    // CREATE the project into the payload
    const p: Project = new Project();
    p.directory = directory;
    p.name = projName;
    p.resource = resourceInfo;
    p.identifier = resourceInfo && resourceInfo.identifier ? resourceInfo.identifier : "";
    payload.project = p;

    await this.populateRepoMetrics(payload);
  }

  /**
   * Set the end times for the files that didn't get a chance to set the end time
   * @param payload
   * @param nowTimes
   */
  async completeFileEndTimes(payload: KeystrokeStats, nowTimes) {
    const keys = Object.keys(payload.source);
    // go through each file and make sure the end time is set
    if (keys && keys.length > 0) {
      for await (let key of keys) {
        const fileInfo: FileChangeInfo = payload.source[key];
        // ensure there is an end time
        if (!fileInfo.end) {
          fileInfo.end = nowTimes.now_in_sec;
          fileInfo.local_end = nowTimes.local_now_in_sec;
        }

        // only get the contributor info if we have a repo identifier
        if (payload.project && payload.project.identifier) {
          // set the contributor count per file
          const repoFileContributorCount = await getFileContributorCount(key);
          fileInfo.repoFileContributorCount = repoFileContributorCount || 0;
        }
        payload.source[key] = fileInfo;
      }
    }
  }

  /**
   * This will update the cumulative editor and session seconds.
   * It will also provide any error details if any are encountered.
   * @param payload
   * @param sessionSeconds
   */
  async updateCumulativeSessionTime(payload: KeystrokeStats, sessionSeconds: number) {
    // increment the projects session and file seconds
    // This will find a time data object based on the current day
    let td: TimeData = await incrementSessionAndFileSecondsAndFetch(
      payload.project,
      sessionSeconds
    );

    // default error to empty
    payload.project_null_error = "";

    // check to see if we're in a new day
    if (isNewDay()) {
      if (td) {
        // don't rely on the previous TimeData
        td = null;
        payload.project_null_error = `TimeData should be null as its a new day`;
      }
      await this.midnightCheckHandler();
    }

    // set the workspace name
    payload.workspace_name = getWorkspaceName();
    payload.hostname = await getHostname();

    // set the project null error if we're unable to find the time project metrics for this payload
    if (!td) {
      // We don't have a TimeData value, use the last recorded kpm data
      payload.project_null_error = `No TimeData for: ${payload.project.directory}`;
    }

    // get the editor seconds
    let cumulative_editor_seconds = 60;
    let cumulative_session_seconds = 60;
    if (td) {
      // We found a TimeData object, use that info
      cumulative_editor_seconds = td.editor_seconds;
      cumulative_session_seconds = td.session_seconds;
    }

    // Check if the final cumulative editor seconds is less than the cumulative session seconds
    if (cumulative_editor_seconds < cumulative_session_seconds) {
      // make sure to set it to at least the session seconds
      cumulative_editor_seconds = cumulative_session_seconds;
    }

    // update the cumulative editor seconds
    payload.cumulative_editor_seconds = cumulative_editor_seconds;
    payload.cumulative_session_seconds = cumulative_session_seconds;
  }

  async updateAggregateInfo(fileChangeInfoMap, payload, sessionSeconds) {
    const aggregate: KeystrokeAggregate = new KeystrokeAggregate();
    aggregate.directory = payload.project
      ? payload.project.directory || NO_PROJ_NAME
      : NO_PROJ_NAME;
    Object.keys(payload.source).forEach((key) => {
      const fileInfo: FileChangeInfo = payload.source[key];
      /**
       * update the project info
       * project has {directory, name}
       */
      const baseName = path.basename(key);
      fileInfo.name = baseName;
      fileInfo.fsPath = key;
      fileInfo.projectDir = payload.project.directory;
      fileInfo.duration_seconds = fileInfo.end - fileInfo.start;

      // update the aggregate info
      aggregate.add += fileInfo.add;
      aggregate.close += fileInfo.close;
      aggregate.delete += fileInfo.delete;
      aggregate.keystrokes += fileInfo.keystrokes;
      aggregate.linesAdded += fileInfo.linesAdded;
      aggregate.linesRemoved += fileInfo.linesRemoved;
      aggregate.open += fileInfo.open;
      aggregate.paste += fileInfo.paste;

      const existingFileInfo: FileChangeInfo = fileChangeInfoMap[key];
      if (!existingFileInfo) {
        fileInfo.update_count = 1;
        fileInfo.kpm = aggregate.keystrokes;
        fileChangeInfoMap[key] = fileInfo;
      } else {
        // aggregate
        existingFileInfo.update_count += 1;
        existingFileInfo.keystrokes += fileInfo.keystrokes;
        existingFileInfo.kpm = existingFileInfo.keystrokes / existingFileInfo.update_count;
        existingFileInfo.add += fileInfo.add;
        existingFileInfo.close += fileInfo.close;
        existingFileInfo.delete += fileInfo.delete;
        existingFileInfo.keystrokes += fileInfo.keystrokes;
        existingFileInfo.linesAdded += fileInfo.linesAdded;
        existingFileInfo.linesRemoved += fileInfo.linesRemoved;
        existingFileInfo.open += fileInfo.open;
        existingFileInfo.paste += fileInfo.paste;
        existingFileInfo.duration_seconds += fileInfo.duration_seconds;

        // non aggregates, just set
        existingFileInfo.lines = fileInfo.lines;
        existingFileInfo.length = fileInfo.length;
      }
    });

    // this will increment and store it offline
    await incrementSessionSummaryData(aggregate, sessionSeconds);
  }
}
