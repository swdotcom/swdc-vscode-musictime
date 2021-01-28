import { workspace, Disposable, window, commands } from "vscode";
import KeystrokeStats from "../model/KeystrokeStats";
import { UNTITLED, NO_PROJ_NAME, DEFAULT_DURATION_MILLIS } from "../Constants";
import {
  getRootPathForFile,
  getNowTimes,
  getFileAgeInDays,
  isFileActive,
  codeTimeExtInstalled,
} from "../Util";
import { FileChangeInfo } from "../model/models";
import { storeCurrentPayload } from "./FileManager";
import Project from "../model/Project";
import { PluginDataManager } from "./PluginDataManager";
import { TrackerManager } from "./TrackerManager";

let _keystrokeMap = {};
let _staticInfoMap = {};

export class KpmManager {
  private static instance: KpmManager;

  private _disposable: Disposable;

  private _currentPayloadTimeout;

  private _keystrokeTriggerTimeout;

  private tracker: TrackerManager;

  constructor() {
    // only listen if code time is not installed
    if (!codeTimeExtInstalled()) {
      this.tracker = TrackerManager.getInstance();
      // document listener handlers
      const subscriptions: Disposable[] = [];
      workspace.onDidOpenTextDocument(this._onOpenHandler, this);
      workspace.onDidCloseTextDocument(this._onCloseHandler, this);
      workspace.onDidChangeTextDocument(this._onEventHandler, this);
      // window state changed handler
      window.onDidChangeWindowState(this._windowStateChanged, this);

      this._disposable = Disposable.from(...subscriptions);
    }
  }

  static getInstance(): KpmManager {
    if (!KpmManager.instance) {
      KpmManager.instance = new KpmManager();
    }

    return KpmManager.instance;
  }

  public hasKeystrokeData() {
    return _keystrokeMap && Object.keys(_keystrokeMap).length ? true : false;
  }

  public async sendKeystrokeDataIntervalHandler(isUnfocus: boolean = false) {
    //
    // Go through all keystroke count objects found in the map and send
    // the ones that have data (data is greater than 1), then clear the map
    //
    if (this.hasKeystrokeData()) {
      let keys = Object.keys(_keystrokeMap);
      // use a normal for loop since we have an await within the loop
      for (let key of keys) {
        const keystrokeStats = _keystrokeMap[key];

        // check if we have keystroke data
        if (keystrokeStats.hasData()) {
          // post the payload offline until the batch interval sends it out
          keystrokeStats.postData(isUnfocus);
        }
      }
    }

    // clear out the keystroke map
    _keystrokeMap = {};

    // clear out the static info map
    _staticInfoMap = {};
  }

  private async _windowStateChanged(event) {
    if (event.focused) {
      PluginDataManager.getInstance().editorFocusHandler();
      this.tracker.trackEditorAction("editor", "focus");
    } else {
      // Process this window's keystroke data since the window has become unfocused
      commands.executeCommand("musictime.processKeystrokeData");
      this.tracker.trackEditorAction("editor", "unfocus");
    }
  }

  /**
   * File Close Handler
   * @param event
   */
  private async _onCloseHandler(event) {
    if (!event || !window.state.focused) {
      return;
    }

    const filename = this.getFileName(event);
    if (!this.isTrueEventFile(event, filename, true)) {
      return;
    }

    this.tracker.trackEditorAction("file", "close", event);
  }

  /**
   * File Open Handler
   * @param event
   */
  private async _onOpenHandler(event) {
    if (!event || !window.state.focused) {
      return;
    }

    const filename = this.getFileName(event);
    if (!this.isTrueEventFile(event, filename)) {
      return;
    }
    this.tracker.trackEditorAction("file", "open", event);
    const staticInfo = await this.getStaticEventInfo(event, filename);

    let rootPath = getRootPathForFile(staticInfo.filename);

    if (!rootPath) {
      rootPath = NO_PROJ_NAME;
    }

    await this.initializeKeystrokesCount(staticInfo.filename, rootPath);

    // make sure other files end's are set
    this.endPreviousModifiedFiles(staticInfo.filename, rootPath);

    const rootObj = _keystrokeMap[rootPath];
    this.updateStaticValues(rootObj, staticInfo);

    rootObj.source[staticInfo.filename].open += 1;
  }

  /**
   * File Change Event Handler
   * @param event
   */
  private async _onEventHandler(event) {
    if (!event || !window.state.focused) {
      return;
    }

    const filename = this.getFileName(event);

    if (!this.isTrueEventFile(event, filename)) {
      return;
    }
    const staticInfo = await this.getStaticEventInfo(event, filename);

    let rootPath = getRootPathForFile(filename);

    if (!rootPath) {
      rootPath = NO_PROJ_NAME;
    }

    await this.initializeKeystrokesCount(filename, rootPath);

    if (!_keystrokeMap[rootPath].source[filename]) {
      // it's undefined, it wasn't created
      return;
    }

    const rootObj = _keystrokeMap[rootPath];
    const sourceObj: FileChangeInfo = rootObj.source[staticInfo.filename];
    this.updateStaticValues(rootObj, staticInfo);

    // find the contentChange with a range in the contentChanges array
    // THIS CAN HAVE MULTIPLE CONTENTCHANGES WITH RANGES AT ONE TIME.
    // LOOP THROUGH AND REPEAT COUNTS
    const contentChanges = event.contentChanges.filter((change) => change.range);
    // each changeset is triggered by a single keystroke
    if (contentChanges.length > 0) sourceObj.keystrokes += 1;

    for (let contentChange of contentChanges) {
      // get {linesAdded, linesDeleted, charactersDeleted, charactersAdded, changeType}
      const documentChangeCountsAndType = this.analyzeDocumentChange(contentChange);
      // get {hasChanges, linesAdded, linesDeleted, isCharDelete, textChangeLen, hasNonNewLineData}
      const textChangeInfo = this.getTextChangeInfo(contentChange);
      sourceObj.documentChangeInfo.linesAdded += documentChangeCountsAndType.linesAdded;
      sourceObj.documentChangeInfo.linesDeleted += documentChangeCountsAndType.linesDeleted;
      sourceObj.documentChangeInfo.charactersAdded += documentChangeCountsAndType.charactersAdded;
      sourceObj.documentChangeInfo.charactersDeleted +=
        documentChangeCountsAndType.charactersDeleted;

      switch (documentChangeCountsAndType.changeType) {
        case "singleDelete": {
          sourceObj.documentChangeInfo.singleDeletes += 1;
          break;
        }
        case "multiDelete": {
          sourceObj.documentChangeInfo.multiDeletes += 1;
          break;
        }
        case "singleAdd": {
          sourceObj.documentChangeInfo.singleAdds += 1;
          break;
        }
        case "multiAdd": {
          sourceObj.documentChangeInfo.multiAdds += 1;
          break;
        }
        case "autoIndent": {
          sourceObj.documentChangeInfo.autoIndents += 1;
          break;
        }
        case "replacement": {
          sourceObj.documentChangeInfo.replacements += 1;
          break;
        }
      }

      if (textChangeInfo.textChangeLen > 4) {
        // 4 is the threshold here due to typical tab size of 4 spaces
        // it's a copy and paste event
        sourceObj.paste += 1;
        sourceObj.charsPasted += textChangeInfo.textChangeLen;
      } else if (textChangeInfo.textChangeLen < 0) {
        sourceObj.delete += 1;
        // update the overall count
      } else if (textChangeInfo.hasNonNewLineData) {
        // update the data for this fileInfo keys count
        sourceObj.add += 1;
      }
      // increment keystrokes by 1
      rootObj.keystrokes += 1;

      // "netkeys" = add - delete
      sourceObj.netkeys = sourceObj.add - sourceObj.delete;
      sourceObj.lines =
        event.document && event.document.lineCount
          ? event.document.lineCount
          : event.lineCount || 0;

      if (textChangeInfo.linesDeleted) {
        sourceObj.linesRemoved += textChangeInfo.linesDeleted;
      } else if (textChangeInfo.linesAdded) {
        sourceObj.linesAdded += textChangeInfo.linesAdded;
      }
    }

    this.updateLatestPayloadLazily(rootObj);
  }

  private updateLatestPayloadLazily(payload) {
    if (this._currentPayloadTimeout) {
      // cancel the current one
      clearTimeout(this._currentPayloadTimeout);
      this._currentPayloadTimeout = null;
    }
    this._currentPayloadTimeout = setTimeout(() => {
      this.updateLatestPayload(payload);
    }, 2000);
  }

  private updateLatestPayload(payload) {
    storeCurrentPayload(payload);
  }

  /**
   * Update some of the basic/static attributes
   * @param sourceObj
   * @param staticInfo
   */
  private updateStaticValues(payload, staticInfo) {
    const sourceObj: FileChangeInfo = payload.source[staticInfo.filename];
    if (!sourceObj) {
      return;
    }

    // syntax
    if (!sourceObj.syntax) {
      sourceObj.syntax = staticInfo.languageId;
    }
    // fileAgeDays
    if (!sourceObj.fileAgeDays) {
      sourceObj.fileAgeDays = staticInfo.fileAgeDays;
    }

    // length
    sourceObj.length = staticInfo.length;
  }

  private getFileName(event) {
    let filename = "";
    if (event.fileName) {
      filename = event.fileName;
    } else if (event.document && event.document.fileName) {
      filename = event.document.fileName;
    }
    return filename;
  }

  private analyzeDocumentChange(contentChange) {
    const info = {
      linesAdded: 0,
      linesDeleted: 0,
      charactersDeleted: 0,
      charactersAdded: 0,
      changeType: "",
    };

    // extract lines and character change counts
    this.extractChangeCounts(info, contentChange);
    this.characterizeChange(info, contentChange);

    return info;
  }

  private extractChangeCounts(changeInfo, contentChange) {
    changeInfo.linesDeleted = contentChange.range.end.line - contentChange.range.start.line;
    changeInfo.linesAdded = contentChange.text?.match(/[\n\r]/g)?.length || 0;

    changeInfo.charactersDeleted = contentChange.rangeLength - changeInfo.linesDeleted;
    changeInfo.charactersAdded = contentChange.text.length - changeInfo.linesAdded;
  }

  private characterizeChange(changeInfo, contentChange) {
    if (changeInfo.charactersDeleted > 0 || changeInfo.linesDeleted > 0) {
      if (changeInfo.charactersAdded > 0) changeInfo.changeType = "replacement";
      else if (changeInfo.charactersDeleted > 1 || changeInfo.linesDeleted > 1)
        changeInfo.changeType = "multiDelete";
      else if (changeInfo.charactersDeleted == 1 || changeInfo.linesDeleted == 1)
        changeInfo.changeType = "singleDelete";
    } else if (changeInfo.charactersAdded > 1 || changeInfo.linesAdded > 1) {
      if (contentChange.text.match(/^[\n\r]\s*$/)?.length == 1) {
        // the regex matches a text that is a newline followed by only whitespace
        changeInfo.charactersAdded = 0;
        changeInfo.changeType = "autoIndent";
      } else changeInfo.changeType = "multiAdd";
    } else if (changeInfo.charactersAdded == 1 || changeInfo.linesAdded == 1)
      changeInfo.changeType = "singleAdd";
  }

  /**
   * Get the text change info:
   * linesAdded, linesDeleted, isCharDelete,
   * hasNonNewLineData, textChangeLen, hasChanges
   * @param contentChange
   */
  private getTextChangeInfo(contentChange) {
    const info = {
      linesAdded: 0,
      linesDeleted: 0,
      isCharDelete: false,
      hasNonNewLineData: false,
      textChangeLen: 0,
      hasChanges: false,
    };

    let textChangeLen = 0;

    // Get the range data
    const rangeData = JSON.parse(JSON.stringify(contentChange));
    let linesChanged = 0;
    if (rangeData.range && rangeData.range.length) {
      // get the number of lines that have changed
      linesChanged = rangeData.range[1].line - rangeData.range[0].line;
    }

    const rangeText = contentChange.text;
    const newLineMatches = rangeText?.match(/[\n\r]/g);
    textChangeLen = rangeText?.length;

    // set the text change length
    info.textChangeLen = textChangeLen;

    if (linesChanged) {
      // update removed lines
      info.linesDeleted = linesChanged;
    } else if (newLineMatches && !linesChanged && textChangeLen) {
      // this means there are new lines added
      info.linesAdded = newLineMatches.length;
    } else if (contentChange.rangeLength && !rangeText) {
      // this may be a character delete
      info.isCharDelete = true;
    }

    // check if its a character deletion
    if (!textChangeLen && contentChange.rangeLength) {
      // NO content text but has a range change length, set the textChangeLen
      // to the inverse of the rangeLength to show the chars deleted
      info.textChangeLen = contentChange.rangeLength / -1;
    }

    if (info.textChangeLen && !info.linesAdded && !info.linesDeleted) {
      // flag to state we have chars deleted but no new lines
      info.hasNonNewLineData = true;
    }

    if (info.linesAdded || info.linesDeleted || info.textChangeLen || info.isCharDelete) {
      // there are changes
      info.hasChanges = true;
    }

    return info;
  }

  private async getStaticEventInfo(event, filename) {
    if (_staticInfoMap[filename]) {
      return _staticInfoMap[filename];
    }

    const textDoc = event.document || event;
    const languageId = textDoc.languageId || textDoc.fileName.split(".").slice(-1)[0];
    let length = 0;
    if (typeof textDoc.getText === "function") {
      length = textDoc.getText().length;
    }
    const lineCount = textDoc.lineCount || 0;
    // get the age of this file
    const fileAgeDays = getFileAgeInDays(filename);

    _staticInfoMap[filename] = {
      filename,
      languageId,
      length,
      fileAgeDays,
      lineCount,
    };

    return _staticInfoMap[filename];
  }

  /**
   * This will return true if it's a true file. we don't
   * want to send events for .git or other event triggers
   * such as extension.js.map events
   */
  private isTrueEventFile(event, filename, isCloseEvent = false) {
    if (!filename) {
      return false;
    }
    // if it's the dashboard file or a liveshare tmp file then
    // skip event tracking

    let scheme = "";
    if (event.uri && event.uri.scheme) {
      scheme = event.uri.scheme;
    } else if (event.document && event.document.uri && event.document.uri.scheme) {
      scheme = event.document.uri.scheme;
    }

    // we'll get "git" as a scheme, but these are the schemes that match to open files in the editor
    const isDocEventScheme =
      scheme === "file" || scheme === "untitled" || scheme === "vscode-remote";

    const isLiveshareTmpFile = filename.match(/.*\.code-workspace.*vsliveshare.*tmp-.*/);
    const isInternalFile = filename.match(
      /.*\.software.*(CommitSummary\.txt|CodeTime\.txt|session\.json|ProjectCodeSummary\.txt|data.json)/
    );

    // return false that its not a doc that we want to track based on the
    // following conditions: non-doc scheme, is liveshare tmp file, is internal file
    // and the file is no longer active
    if (
      !isDocEventScheme ||
      isLiveshareTmpFile ||
      isInternalFile ||
      !isFileActive(filename, isCloseEvent)
    ) {
      return false;
    }

    return true;
  }

  public buildBootstrapKpmPayload() {
    let rootPath = UNTITLED;
    let fileName = UNTITLED;
    let name = NO_PROJ_NAME;

    // send the code time bootstrap payload
    let keystrokeStats = new KeystrokeStats({
      // project.directory is used as an object key, must be string
      directory: rootPath,
      name,
      identifier: "",
      resource: {},
    });
    keystrokeStats.keystrokes = 0;
    let nowTimes = getNowTimes();
    const start = nowTimes.now_in_sec - 60;
    const local_start = nowTimes.local_now_in_sec - 60;
    keystrokeStats.start = start;
    keystrokeStats.local_start = local_start;
    const fileInfo = new FileChangeInfo();
    fileInfo.add = 0;
    fileInfo.keystrokes = 0;
    fileInfo.start = start;
    fileInfo.local_start = local_start;
    keystrokeStats.source[fileName] = fileInfo;

    setTimeout(() => {
      keystrokeStats.postData();
    }, 0);
  }

  private endPreviousModifiedFiles(filename, rootPath) {
    let keystrokeStats = _keystrokeMap[rootPath];
    if (keystrokeStats) {
      // close any existing
      const fileKeys = Object.keys(keystrokeStats.source);
      const nowTimes = getNowTimes();
      if (fileKeys.length) {
        // set the end time to now for the other files that don't match this file
        fileKeys.forEach((key) => {
          let sourceObj: FileChangeInfo = keystrokeStats.source[key];
          if (key !== filename && sourceObj.end === 0) {
            sourceObj.end = nowTimes.now_in_sec;
            sourceObj.local_end = nowTimes.local_now_in_sec;
          }
        });
      }
    }
  }

  private async initializeKeystrokesCount(filename, rootPath) {
    // the rootPath (directory) is used as the map key, must be a string
    rootPath = rootPath || NO_PROJ_NAME;
    // if we don't even have a _keystrokeMap then create it and take the
    // path of adding this file with a start time of now
    if (!_keystrokeMap) {
      _keystrokeMap = {};
    }

    const nowTimes = getNowTimes();

    let keystrokeStats = _keystrokeMap[rootPath];

    // create the keystroke count if it doesn't exist
    if (!keystrokeStats) {
      // add keystroke count wrapper
      keystrokeStats = await this.createKeystrokeStats(filename, rootPath, nowTimes);
    }

    // check if we have this file or not
    const hasFile = keystrokeStats.source[filename];

    if (!hasFile) {
      // no file, start anew
      this.addFile(filename, nowTimes, keystrokeStats);
    } else if (parseInt(keystrokeStats.source[filename].end, 10) !== 0) {
      // re-initialize it since we ended it before the minute was up
      keystrokeStats.source[filename].end = 0;
      keystrokeStats.source[filename].local_end = 0;
    }

    _keystrokeMap[rootPath] = keystrokeStats;
  }

  private addFile(filename, nowTimes, keystrokeStats) {
    const fileInfo = new FileChangeInfo();
    fileInfo.start = nowTimes.now_in_sec;
    fileInfo.local_start = nowTimes.local_now_in_sec;
    keystrokeStats.source[filename] = fileInfo;
  }

  private async createKeystrokeStats(filename, rootPath, nowTimes) {
    // start off with an empty project
    const p: Project = new Project();
    const keystrokeStats: KeystrokeStats = new KeystrokeStats(p);

    keystrokeStats.start = nowTimes.now_in_sec;
    keystrokeStats.local_start = nowTimes.local_now_in_sec;
    keystrokeStats.keystrokes = 0;

    // start the minute timer to send the data
    const timeout = DEFAULT_DURATION_MILLIS;
    this._keystrokeTriggerTimeout = setTimeout(() => {
      this.sendKeystrokeDataIntervalHandler();
    }, timeout);

    return keystrokeStats;
  }

  public processKeystrokeData(isUnfocus: boolean = false) {
    if (this._keystrokeTriggerTimeout) {
      clearTimeout(this._keystrokeTriggerTimeout);
    }
    this.sendKeystrokeDataIntervalHandler(isUnfocus);
  }

  public dispose() {
    this._disposable.dispose();
  }
}
