import swdcTracker from "swdc-tracker";
import { api_endpoint } from "../Constants";
import { getPluginName, getItem, getPluginId, getVersion, getWorkspaceFolders } from "../Util";
import { KpmItem, FileChangeInfo } from "../model/models";
import { getRepoIdentifierInfo } from "../repo/GitUtil";
import KeystrokeStats from "../model/KeystrokeStats";
import { getResourceInfo } from "../KpmRepoManager";

const moment = require("moment-timezone");

export class TrackerManager {
  private static instance: TrackerManager;

  private trackerReady: boolean = false;
  private pluginParams: any = this.getPluginParams();

  private constructor() {}

  static getInstance(): TrackerManager {
    if (!TrackerManager.instance) {
      TrackerManager.instance = new TrackerManager();
    }

    return TrackerManager.instance;
  }

  public async init() {
    // initialize tracker with swdc api host, namespace, and appId
    const result = await swdcTracker.initialize(api_endpoint, "MusicTime", "swdc-vscode");
    if (result.status === 200) {
      this.trackerReady = true;
      this.trackEditorAction("editor", "activate");
    }
  }

  public async trackCodeTimeEvent(keystrokeStats: KeystrokeStats) {
    if (!this.trackerReady) {
      return;
    }

    // extract the project info from the keystroke stats
    const projectInfo = {
      project_directory: keystrokeStats.project.directory,
      project_name: keystrokeStats.project.name,
    };

    // loop through the files in the keystroke stats "source"
    const fileKeys = Object.keys(keystrokeStats.source);
    for await (let file of fileKeys) {
      const fileData: FileChangeInfo = keystrokeStats.source[file];

      const codetime_entity = {
        keystrokes: fileData.keystrokes,
        lines_added: fileData.documentChangeInfo.linesAdded,
        lines_deleted: fileData.documentChangeInfo.linesDeleted,
        characters_added: fileData.documentChangeInfo.charactersAdded,
        characters_deleted: fileData.documentChangeInfo.charactersDeleted,
        single_deletes: fileData.documentChangeInfo.singleDeletes,
        multi_deletes: fileData.documentChangeInfo.multiDeletes,
        single_adds: fileData.documentChangeInfo.singleAdds,
        multi_adds: fileData.documentChangeInfo.multiAdds,
        auto_indents: fileData.documentChangeInfo.autoIndents,
        replacements: fileData.documentChangeInfo.replacements,
        start_time: moment.unix(fileData.start).utc().format(),
        end_time: moment.unix(fileData.end).utc().format(),
      };

      const file_entity = {
        file_name: fileData.fsPath?.split(fileData.projectDir)?.[1],
        file_path: fileData.fsPath,
        syntax: fileData.syntax,
        line_count: fileData.lines,
        character_count: fileData.length,
      };

      const repoParams = await this.getRepoParams(keystrokeStats.project.directory);

      const codetime_event = {
        ...codetime_entity,
        ...file_entity,
        ...projectInfo,
        ...this.pluginParams,
        ...this.getJwtParams(),
        ...repoParams,
      };

      swdcTracker.trackCodeTimeEvent(codetime_event);
    }
  }

  public async trackUIInteraction(item: KpmItem) {
    // ui interaction doesn't require a jwt, no need to check for that here
    if (!this.trackerReady) {
      return;
    }

    const ui_interaction = {
      interaction_type: item.interactionType,
    };

    const ui_element = {
      element_name: item.name,
      element_location: item.location,
      color: item.color ? item.color : null,
      icon_name: item.interactionIcon ? item.interactionIcon : null,
      cta_text: !item.hideCTAInTracker
        ? item.label || item.description || item.tooltip
        : "redacted",
    };

    const ui_event = {
      ...ui_interaction,
      ...ui_element,
      ...this.pluginParams,
      ...this.getJwtParams(),
    };

    swdcTracker.trackUIInteraction(ui_event);
  }

  public async trackEditorAction(entity: string, type: string, event?: any) {
    if (!this.trackerReady) {
      return;
    }

    const projectParams = this.getProjectParams();
    const repoParams = await this.getRepoParams(projectParams.project_directory);

    const editor_event = {
      entity,
      type,
      ...this.pluginParams,
      ...this.getJwtParams(),
      ...projectParams,
      ...this.getFileParams(event, projectParams.project_directory),
      ...repoParams,
    };
    // send the event
    swdcTracker.trackEditorAction(editor_event);
  }

  // Static attributes
  getPluginParams(): any {
    return {
      plugin_id: getPluginId(),
      plugin_name: getPluginName(),
      plugin_version: getVersion(),
    };
  }

  // Dynamic attributes

  getJwtParams(): any {
    return { jwt: getItem("jwt")?.split("JWT ")[1] };
  }

  getProjectParams() {
    const workspaceFolders = getWorkspaceFolders();
    const project_directory = workspaceFolders.length ? workspaceFolders[0].uri.fsPath : "";
    const project_name = workspaceFolders.length ? workspaceFolders[0].name : "";

    return { project_directory, project_name };
  }

  async getRepoParams(projectRootPath) {
    const resourceInfo = await getResourceInfo(projectRootPath);
    if (!resourceInfo || !resourceInfo.identifier) {
      // return empty data, no need to parse further
      return {
        identifier: "",
        org_name: "",
        repo_name: "",
        repo_identifier: "",
        git_branch: "",
        git_tag: "",
      };
    }

    // retrieve the git identifier info
    const gitIdentifiers = getRepoIdentifierInfo(resourceInfo.identifier);

    return {
      ...gitIdentifiers,
      repo_identifier: resourceInfo.identifier,
      git_branch: resourceInfo.branch,
      git_tag: resourceInfo.tag,
    };
  }

  getFileParams(event, projectRootPath) {
    if (!event) return {};
    // File Open and Close have document attributes on the event.
    // File Change has it on a `document` attribute
    const textDoc = event.document || event;
    if (!textDoc) {
      return {
        file_name: "",
        file_path: "",
        syntax: "",
        line_count: 0,
        character_count: 0,
      };
    }

    let character_count = 0;
    if (typeof textDoc.getText === "function") {
      character_count = textDoc.getText().length;
    }

    return {
      file_name: textDoc.fileName?.split(projectRootPath)?.[1],
      file_path: textDoc.fileName,
      syntax: textDoc.languageId || textDoc.fileName?.split(".")?.slice(-1)?.[0],
      line_count: textDoc.lineCount || 0,
      character_count,
    };
  }
}
