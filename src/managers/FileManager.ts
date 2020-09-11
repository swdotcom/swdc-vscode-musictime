import { softwarePost, isResponseOk } from "../HttpClient";
import {
  deleteFile,
  logIt,
  getFileDataPayloadsAsJson,
  getFileDataArray,
  getItem,
  isWindows,
  isBatchSizeUnderThreshold,
} from "../Util";
import KeystrokeStats from "../model/KeystrokeStats";
import TimeData from "../model/TimeData";

const fileIt = require("file-it");
const fs = require("fs");
const os = require("os");

// each file within the plugin data is about 1 to 2kb. the queue
// size limit is 256k. we should be able to safely send 50
// at a time, but the batch logic should check the size as well
const batch_limit = 50;

let extensionName = null;
let extensionDisplayName = null; // Code Time or Music Time
let latestPayload: KeystrokeStats = null;

export function clearLastSavedKeystrokeStats() {
  latestPayload = null;
}

export function getSoftwareSessionFile() {
  return getFile("session.json");
}

export function getSoftwareDataStoreFile() {
  return getFile("data.json");
}

export function getPluginEventsFile() {
  return getFile("events.json");
}

export function getTimeCounterFile() {
  return getFile("timeCounter.json");
}

export function getDashboardFile() {
  return getFile("CodeTime.txt");
}

export function getCommitSummaryFile() {
  return getFile("CommitSummary.txt");
}

export function getSummaryInfoFile() {
  return getFile("SummaryInfo.txt");
}

export function getProjectCodeSummaryFile() {
  return getFile("ProjectCodeSummary.txt");
}

export function getProjectContributorCodeSummaryFile() {
  return getFile("ProjectContributorCodeSummary.txt");
}

export function getDailyReportSummaryFile() {
  return getFile("DailyReportSummary.txt");
}

export function getTimeDataSummaryFile() {
  return getFile("projectTimeData.json");
}

export function getMusicTimeFile() {
  return getFile("MusicTime.txt");
}

export function getMusicTimeMarkdownFile() {
  return getFile("MusicTime.html");
}

export function getSongSessionDataFile() {
  return getFile("songSessionData.json");
}

export function getSessionSummaryFile() {
  return getFile("sessionSummary.json");
}

export function getExtensionDisplayName() {
  if (extensionDisplayName) {
    return extensionDisplayName;
  }

  const extInfoFile = `${__dirname}${getFile("extensioninfo.json")}`;

  const data = fileIt.readJsonFileSync(extInfoFile);
  if (data) {
    extensionDisplayName = data.displayName;
  }

  if (!extensionDisplayName) {
    extensionDisplayName = "Music Time";
  }
  return extensionDisplayName;
}

export function getExtensionName() {
  if (extensionName) {
    return extensionName;
  }

  const extInfoFile = `${__dirname}${getFile("extensioninfo.json")}`;

  const data = fileIt.readJsonFileSync(extInfoFile);
  if (data) {
    extensionName = data.name;
  }
  if (!extensionName) {
    extensionName = "music-time";
  }
  return extensionName;
}

export function getSoftwareDir(autoCreate = true) {
  const homedir = os.homedir();

  const softwareDataDir = `${homedir}${getSeparator(".software")}`;

  if (autoCreate && !fs.existsSync(softwareDataDir)) {
    fs.mkdirSync(softwareDataDir);
  }

  return softwareDataDir;
}

export function getFileChangeSummaryFile() {
  return getFile("fileChangeSummary.json");
}

export function getFile(name) {
  const file_path = `${getSoftwareDir()}${getSeparator(name)}`;
  return file_path;
}

function getSeparator(name) {
  if (isWindows()) {
    return `\\${name}`;
  }
  return `/${name}`;
}

/**
 * send the offline TimeData payloads
 */
export async function sendOfflineTimeData() {
  batchSendArrayData("/data/time", getTimeDataSummaryFile());

  // clear time data data. this will also clear the
  // code time and active code time numbers
  clearTimeDataSummary();
}

export async function clearTimeDataSummary() {
  const file = getTimeDataSummaryFile();
  let payloads: TimeData[] = [];
  fileIt.writeJsonFileSync(file, payloads, { spaces: 4 });
}

/**
 * send the offline data.
 */
export async function sendOfflineData() {
  batchSendData("/data/batch", getSoftwareDataStoreFile());
}

export function getFileDataAsJson(file) {
  let data = fileIt.readJsonFileSync(file);
  return data;
}

/**
 * batch send array data
 * @param api
 * @param file
 */
export async function batchSendArrayData(api, file) {
  const payloads = getFileDataArray(file);
  if (payloads && payloads.length) {
    batchSendPayloadData(api, file, payloads);
  }
}

export async function batchSendData(api, file) {
  try {
    if (fs.existsSync(file)) {
      const payloads = getFileDataPayloadsAsJson(file);
      batchSendPayloadData(api, file, payloads);
    }
  } catch (e) {
    logIt(`Error batch sending payloads: ${e.message}`);
  }
}

export async function getLastSavedKeystrokesStats() {
  const el = fileIt.findSortedJsonElement(getSoftwareDataStoreFile(), "start", "desc");
  if (el) {
    return el;
  }
  // returns one in memory if not found in file
  return latestPayload;
}

export async function batchSendPayloadData(api, file, payloads) {
  // send the batch
  if (payloads && payloads.length > 0) {
    // Check to see if these payloads are the plugin payloads.
    // If so, check to see how many files are in each. We'll want to
    // break out the files into another payload if it exceeds what the
    // queue can handle in size, which is 256k. If it's not a plugin payload,
    // for example an event payload, then just make sure it's batched with
    // a limit of 100 or so to keep it under the 256k per POST request.

    logIt(`sending batch payloads`);

    // send batch_limit at a time
    let batch = [];
    for (let i = 0; i < payloads.length; i++) {
      if (batch.length >= batch_limit) {
        const resp = await processBatch(api, batch);
        if (!resp) {
          // there was a problem with the transmission.
          // bail out so we don't delete the offline data
          return;
        }

        batch = [];
      }
      batch.push(payloads[i]);
    }
    // send the remaining
    if (batch.length > 0) {
      const resp = await processBatch(api, batch);
      if (!resp) {
        // there was a problem with the transmission.
        // bail out so we don't delete the offline data
        return;
      }
    }
  }

  // we're online so just delete the file
  deleteFile(file);
}

async function processBatch(api, batch) {
  const batchInfo = Buffer.byteLength(JSON.stringify(batch));
  // check if the batch data too large (256k is the max size but we'll use 250k)
  const isLargeFile = batchInfo >= 250000 ? true : false;
  if (isLargeFile) {
    // break these into their own batch size
    let newBatch = [];
    for (let x = 0; x < batch.length; x++) {
      const batchPayload = batch[x];

      // process the plugin data payloads one way
      if (batchPayload.source) {
        // plugin data payload
        const keys = Object.keys(batchPayload.source);
        if (keys && keys.length) {
          const sourceData = batchPayload.source;
          delete batchPayload.source;

          let newSource = {};

          for (let y = 0; y < keys.length; y++) {
            const fileName = keys[y];
            if (Object.keys(newSource).length >= batch_limit) {
              const newPayload = {
                ...batchPayload,
                source: newSource,
              };
              newBatch.push(newPayload);
              // send the current new batch
              const resp = await sendBatchPayload(api, newBatch);
              if (!isResponseOk(resp)) {
                // there was a problem with the transmission.
                // bail out so we don't delete the offline data
                return false;
              }
              newSource = {};
              // clear the array
              newBatch = [];
            }
            newSource[fileName] = {
              ...sourceData[fileName],
            };
          }

          // process the remaining keys
          if (Object.keys(newSource).length) {
            const newPayload = {
              ...batchPayload,
              source: newSource,
            };
            newBatch.push(newPayload);
            const resp = await sendBatchPayload(api, newBatch);
            if (!isResponseOk(resp)) {
              // there was a problem with the transmission.
              // bail out so we don't delete the offline data
              return false;
            }
            // clear the array
            newBatch = [];
          }
        }
      } else {
        // process non-plugin data payloads another way
        if (newBatch.length) {
          if (!isBatchSizeUnderThreshold(newBatch)) {
            const resp = await sendBatchPayload(api, newBatch);
            if (!isResponseOk(resp)) {
              // there was a problem with the transmission.
              // bail out so we don't delete the offline data
              return false;
            }
            // clear the array
            newBatch = [];
          }
        }

        newBatch.push(batchPayload);
      }
    }

    // send any remaining
    if (newBatch.length) {
      const resp = await sendBatchPayload(api, newBatch);
      if (!isResponseOk(resp)) {
        // there was a problem with the transmission.
        // bail out so we don't delete the offline data
        return false;
      }
    }
  } else {
    // the batch size is within bounds, send it off
    const resp = await sendBatchPayload(api, batch);
    if (!isResponseOk(resp)) {
      // there was a problem with the transmission.
      // bail out so we don't delete the offline data
      return false;
    }
  }
  return true;
}

export function sendBatchPayload(api, batch) {
  return softwarePost(api, batch, getItem("jwt")).catch((e) => {
    logIt(`Unable to send plugin data batch, error: ${e.message}`);
  });
}

export function getCurrentPayloadFile() {
  return getFile("latestKeystrokes.json");
}

export async function storeCurrentPayload(payload) {
  storeJsonData(this.getCurrentPayloadFile(), payload);
}

export async function storeJsonData(fileName, data) {
  fileIt.writeJsonFileSync(fileName, data);
}
