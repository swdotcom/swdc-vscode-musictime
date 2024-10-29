import { execCmd } from "./ExecManager";

import * as os from "os";

export function isLinux() {
  return isWindows() || isMac() ? false : true;
}

// process.platform return the following...
//   -> 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
export function isWindows() {
  return process.platform.indexOf("win32") !== -1;
}

export function isMac() {
  return process.platform.indexOf("darwin") !== -1;
}

export async function getHostname() {
  const hostname = execCmd("hostname");
  return hostname;
}

export function getOs() {
  const parts = [];
  const osType = os.type();
  if (osType) {
    parts.push(osType);
  }
  const osRelease = os.release();
  if (osRelease) {
    parts.push(osRelease);
  }
  const platform = os.platform();
  if (platform) {
    parts.push(platform);
  }
  if (parts.length > 0) {
    return parts.join("_");
  }
  return "";
}

export async function getOsUsername() {
  let username = os.userInfo().username;
  if (!username || username.trim() === "") {
    username = execCmd("whoami");
  }
  return username;
}
