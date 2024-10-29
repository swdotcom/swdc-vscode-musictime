
import { logIt } from "../Util";
import { isWindows } from "./DeviceManager";
import { LocalStorageManager } from "./LocalStorageManager";

import * as fs from 'fs';

let storageMgr: LocalStorageManager | undefined = undefined;

function getStorageManager() {
  if (!storageMgr) {
    storageMgr = LocalStorageManager.getCachedStorageManager()
  }
  return storageMgr
}

export function getJsonItem(file: string, key: string, defaultValue: any = '') {
  return getStorageManager()?.getValue(`${getFileNameFromPath(file)}_${key}`) || defaultValue;
}

export function setJsonItem(file: string, key: string, value: any) {
  getStorageManager()?.setValue(`${getFileNameFromPath(file)}_${key}`, value);
}

export async function storeJsonData(fileName, json) {
	try {
    const content: string = JSON.stringify(json);
    fs.writeFileSync(fileName, content, 'utf8');
  } catch (e) {
    logIt(`Unable to write ${fileName} info: ${e.message}`, true);
  }
}

export function getFileNameFromPath(filePath: string) {
  const parts = isWindows() ? filePath.split('\\') : filePath.split('/');
  return parts[parts.length - 1].split('.')[0];
}
