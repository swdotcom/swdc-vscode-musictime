import { getSessionSummaryData, saveSessionSummaryToDisk } from "../storage/SessionSummaryData";
import { updateSessionFromSummaryApi } from "../storage/TimeSummaryData";
import { softwareGet, isResponseOk } from "../HttpClient";
import { SessionSummary } from "../model/models";
import { getItem } from "./FileManager";

// every 1 min
const DAY_CHECK_TIMER_INTERVAL = 1000 * 60;

export class SummaryManager {
  private static instance: SummaryManager;

  constructor() {
    //
  }

  static getInstance(): SummaryManager {
    if (!SummaryManager.instance) {
      SummaryManager.instance = new SummaryManager();
    }

    return SummaryManager.instance;
  }

  /**
   * This is only called from the new day checker
   */
  async updateSessionSummaryFromServer() {
    const jwt = getItem("jwt");
    const result = await softwareGet(`/sessions/summary?refresh=true`, jwt);
    if (isResponseOk(result) && result.data) {
      const data = result.data;

      // update the session summary data
      const summary: SessionSummary = getSessionSummaryData();

      Object.keys(data).forEach((key) => {
        const val = data[key];
        if (val !== null && val !== undefined) {
          summary[key] = val;
        }
      });

      // if the summary.currentDayMinutes is greater than the wall
      // clock time then it means the plugin was installed on a
      // different computer or the session was deleted
      updateSessionFromSummaryApi(summary.currentDayMinutes);

      saveSessionSummaryToDisk(summary);
    }
  }
}
