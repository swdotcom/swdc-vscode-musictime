import { getNowTimes } from "../Util";

export default class TimeCounterStats {
  last_focused_timestamp_utc: number = 0;
  last_unfocused_timestamp_utc: number = 0;
  elapsed_code_time_seconds: number = 0;
  elapsed_active_code_time_seconds: number = 0;
  elapsed_seconds: number = 0;
  focused_editor_seconds: number = 0;
  cumulative_code_time_seconds: number = 0;
  cumulative_active_code_time_seconds: number = 0;
  last_payload_end_utc: number = 0;
  current_day: string = "";

  constructor() {
    const nowTimes = getNowTimes();
    // set the current day (YYYY-MM-DD)
    this.current_day = nowTimes.day;
    // set last_payload end and focused timestamp to now (UTC)
    this.last_payload_end_utc = nowTimes.now_in_sec;
    this.last_focused_timestamp_utc = nowTimes.now_in_sec;
  }
}
