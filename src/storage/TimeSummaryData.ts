import { getFileDataArray, getNowTimes, getActiveProjectWorkspace } from "../Util";
import { getResourceInfo } from "../KpmRepoManager";
import { WorkspaceFolder } from "vscode";
import { NO_PROJ_NAME, UNTITLED } from "../Constants";
import CodeTimeSummary from "../model/CodeTimeSummary";
import Project from "../model/Project";
import TimeData from "../model/TimeData";
import { getTimeDataSummaryFile } from "../managers/FileManager";

const fileIt = require("file-it");

/**
 * Build a new TimeData summary
 * @param project
 */
async function getNewTimeDataSummary(project: Project): Promise<TimeData> {
  const { day } = getNowTimes();

  let timeData: TimeData = null;
  if (!project) {
    const activeWorkspace: WorkspaceFolder = getActiveProjectWorkspace();
    project = await getCurrentTimeSummaryProject(activeWorkspace);
    // but make sure we're not creating a new one on top of one that already exists
    timeData = findTimeDataSummary(project);
    if (timeData) {
      return timeData;
    }
  }

  // still unable to find an existing td, create a new one
  timeData = new TimeData();
  timeData.day = day;
  timeData.project = project;
  return timeData;
}

export async function clearTimeDataSummary() {
  const file = getTimeDataSummaryFile();
  let payloads: TimeData[] = [];
  fileIt.writeJsonFileSync(file, payloads, { spaces: 4 });
}

export async function getCurrentTimeSummaryProject(
  workspaceFolder: WorkspaceFolder
): Promise<Project> {
  const project: Project = new Project();
  if (!workspaceFolder || !workspaceFolder.name) {
    // no workspace folder
    project.directory = UNTITLED;
    project.name = NO_PROJ_NAME;
  } else {
    let rootPath: string = workspaceFolder.uri.fsPath;
    let name: string = workspaceFolder.name;
    if (rootPath) {
      // create the project
      project.directory = rootPath;
      project.name = name;

      try {
        const resource = await getResourceInfo(rootPath);
        if (resource) {
          project.resource = resource;
          project.identifier = resource.identifier || "";
        }
      } catch (e) {
        //
      }
    }
  }

  return project;
}

export async function incrementEditorSeconds(editor_seconds: number) {
  const activeWorkspace: WorkspaceFolder = getActiveProjectWorkspace();

  // only increment if we have an active workspace
  if (activeWorkspace && activeWorkspace.name) {
    const project: Project = await getCurrentTimeSummaryProject(activeWorkspace);
    if (project && project.directory) {
      const timeData: TimeData = await getTodayTimeDataSummary(project);
      timeData.editor_seconds += editor_seconds;
      timeData.editor_seconds = Math.max(timeData.editor_seconds, timeData.session_seconds);

      // save the info to disk
      saveTimeDataSummaryToDisk(timeData);
    }
  }
}

export async function updateSessionFromSummaryApi(currentDayMinutes: number) {
  const { day } = getNowTimes();

  const codeTimeSummary: CodeTimeSummary = getCodeTimeSummary();

  // find out if there's a diff
  const diffActiveCodeMinutesToAdd =
    codeTimeSummary.activeCodeTimeMinutes < currentDayMinutes
      ? currentDayMinutes - codeTimeSummary.activeCodeTimeMinutes
      : 0;

  // get the current open project
  const activeWorkspace: WorkspaceFolder = getActiveProjectWorkspace();
  let project: Project = null;
  let timeData: TimeData = null;
  if (activeWorkspace) {
    project = await getCurrentTimeSummaryProject(activeWorkspace);
    timeData = await getTodayTimeDataSummary(project);
  } else {
    const file = getTimeDataSummaryFile();
    const payloads: TimeData[] = getFileDataArray(file);
    const filtered_payloads: TimeData[] = payloads.filter((n: TimeData) => n.day === day);
    if (filtered_payloads && filtered_payloads.length) {
      timeData = filtered_payloads[0];
    }
  }

  if (!timeData) {
    // create a untitled one
    project = new Project();
    project.directory = UNTITLED;
    project.name = NO_PROJ_NAME;

    timeData = new TimeData();
    timeData.day = day;
    timeData.project = project;
  }

  // save the info to disk
  const secondsToAdd = diffActiveCodeMinutesToAdd * 60;
  timeData.session_seconds += secondsToAdd;
  timeData.editor_seconds += secondsToAdd;
  // make sure editor seconds isn't less
  saveTimeDataSummaryToDisk(timeData);
}

export async function incrementSessionAndFileSecondsAndFetch(
  project: Project,
  sessionSeconds: number
): Promise<TimeData> {
  // get the matching time data object or create one
  const timeData: TimeData = await getTodayTimeDataSummary(project);

  if (timeData) {
    const session_seconds = sessionSeconds;
    timeData.session_seconds += session_seconds;
    // max editor seconds should be equal or greater than session seconds
    timeData.editor_seconds = Math.max(timeData.editor_seconds, timeData.session_seconds);
    timeData.file_seconds += 60;
    // max file seconds should not be greater than session seconds
    timeData.file_seconds = Math.min(timeData.file_seconds, timeData.session_seconds);

    // save the info to disk (synchronous)
    saveTimeDataSummaryToDisk(timeData);

    return timeData;
  }
  return null;
}

export function getCodeTimeSummary(): CodeTimeSummary {
  const summary: CodeTimeSummary = new CodeTimeSummary();

  const { day } = getNowTimes();

  // gather the time data elements for today
  const file = getTimeDataSummaryFile();
  const payloads: TimeData[] = getFileDataArray(file);

  const filtered_payloads: TimeData[] = payloads.filter((n: TimeData) => n.day === day);

  if (filtered_payloads && filtered_payloads.length) {
    filtered_payloads.forEach((n: TimeData) => {
      summary.activeCodeTimeMinutes += n.session_seconds / 60;
      summary.codeTimeMinutes += n.editor_seconds / 60;
      summary.fileTimeMinutes += n.file_seconds / 60;
    });
  }

  return summary;
}

export async function getTodayTimeDataSummary(project: Project): Promise<TimeData> {
  let timeData: TimeData = findTimeDataSummary(project);

  // not found, create one since we passed the non-null project and dir
  if (!timeData) {
    timeData = await getNewTimeDataSummary(project);
    saveTimeDataSummaryToDisk(timeData);
  }

  return timeData;
}

function findTimeDataSummary(project: Project): TimeData {
  if (!project || !project.directory) {
    // no project or directory, it shouldn't exist in the file
    return null;
  }
  const { day } = getNowTimes();

  let timeData: TimeData = null;
  const file = getTimeDataSummaryFile();
  const payloads: TimeData[] = getFileDataArray(file);

  if (payloads && payloads.length) {
    // find the one for this day
    timeData = payloads.find((n) => n.day === day && n.project.directory === project.directory);
  }

  return timeData;
}

function saveTimeDataSummaryToDisk(data: TimeData) {
  if (!data) {
    return;
  }

  const file = getTimeDataSummaryFile();

  let payloads: TimeData[] = getFileDataArray(file);

  if (payloads && payloads.length) {
    // find the one for this day
    const idx = payloads.findIndex(
      (n) => n.day === data.day && n.project.directory === data.project.directory
    );
    if (idx !== -1) {
      payloads[idx] = data;
    } else {
      // add it
      payloads.push(data);
    }
  } else {
    payloads = [data];
  }

  fileIt.writeJsonFileSync(file, payloads, { spaces: 4 });
}
