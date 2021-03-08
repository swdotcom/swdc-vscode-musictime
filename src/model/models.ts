import { getVersion, getPluginId, getOs } from "../Util";
import { PlaylistItem } from "cody-music";

export enum UIInteractionType {
  Keyboard = "keyboard",
  Click = "click",
}

export class KpmItem extends PlaylistItem {
  description: string = "";
  value: string = "";
  commandArgs: any[] = [];
  contextValue: string = "";
  callback: any = null;
  icon: string = null;
  children: KpmItem[] = [];
  eventDescription: string = null;
}


export class DocumentChangeInfo {
  linesAdded: number = 0;
  linesDeleted: number = 0;
  charactersAdded: number = 0;
  charactersDeleted: number = 0;
  singleDeletes: number = 0;
  multiDeletes: number = 0;
  singleAdds: number = 0;
  multiAdds: number = 0;
  autoIndents: number = 0;
  replacements: number = 0;
}

export class FileChangeInfo {
  name: string = "";
  fsPath: string = "";
  projectDir: string = "";
  kpm: number = 0;
  keystrokes: number = 0;
  add: number = 0;
  netkeys: number = 0;
  paste: number = 0;
  charsPasted: number = 0;
  open: number = 0;
  close: number = 0;
  delete: number = 0;
  length: number = 0;
  lines: number = 0;
  linesAdded: number = 0;
  linesRemoved: number = 0;
  syntax: string = "";
  fileAgeDays: number = 0;
  repoFileContributorCount: number = 0;
  start: number = 0;
  end: number = 0;
  local_start: number = 0;
  local_end: number = 0;
  update_count: number = 0;
  duration_seconds: number = 0;
  documentChangeInfo: DocumentChangeInfo = new DocumentChangeInfo();
}

export class SessionSummary {
  currentDayMinutes: number = 0;
  currentDayKeystrokes: number = 0;
  currentDayKpm: number = 0;
  currentDayLinesAdded: number = 0;
  currentDayLinesRemoved: number = 0;
  averageDailyMinutes: number = 0;
  averageDailyKeystrokes: number = 0;
  averageDailyKpm: number = 0;
  averageLinesAdded: number = 0;
  averageLinesRemoved: number = 0;
  timePercent: number = 0;
  volumePercent: number = 0;
  velocityPercent: number = 0;
  liveshareMinutes: number = 0;
  latestPayloadTimestampEndUtc: number = 0;
  latestPayloadTimestamp: number = 0;
  lastUpdatedToday: boolean = false;
  currentSessionGoalPercent: number = 0;
  inFlow: boolean = false;
  dailyMinutesGoal: number = 0;
  globalAverageSeconds: number = 0;
  globalAverageDailyMinutes: number = 0;
  globalAverageDailyKeystrokes: number = 0;
  globalAverageLinesAdded: number = 0;
  globalAverageLinesRemoved: number = 0;
}

export class LoggedInState {
  loggedIn: boolean = false;
}

export class CommitChangeStats {
  insertions: number = 0;
  deletions: number = 0;
  fileCount: number = 0;
  commitCount: number = 0;
}

// example: {type: "window", name: "close", timestamp: 1234,
// timestamp_local: 1233, description: "OnboardPrompt"}
export class CodeTimeEvent {
  type: string = "";
  name: string = "";
  timestamp: number = 0;
  timestamp_local: number = 0;
  description: string = "";
  pluginId: number = getPluginId();
  os: string = getOs();
  version: string = getVersion();
  hostname: string = ""; // this is gathered using an await
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone;
}
