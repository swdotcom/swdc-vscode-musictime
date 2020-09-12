import KeystrokeStats from "../model/KeystrokeStats";
import { getSoftwareDataStoreFile } from "./FileManager";

const fileIt = require("file-it");

/**
 * this should only be called if there's file data in the source
 * @param payload
 */
export async function storePayload(payload: KeystrokeStats) {
  // make sure the data that is stored is valid
  if (payload && Object.keys(payload).length && Object.keys(payload.source).length) {
    // store the payload into the data.json file
    fileIt.appendJsonFileSync(getSoftwareDataStoreFile(), payload);
  }
}
