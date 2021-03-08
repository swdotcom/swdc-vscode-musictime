import { isGitProject } from './repo/GitUtil';
import {
  wrapExecPromise,
  isWindows,
  getRootPaths,
  normalizeGithubEmail,
  getFileType,
  getCommandResultAsList,
  getCommandResult,
  countUniqueStrings,
} from "./Util";

function getProjectDir(fileName = null) {
  let projectDirs = getRootPaths();

  if (!projectDirs || projectDirs.length === 0) {
    return null;
  }

  // VSCode allows having multiple workspaces.
  // for now we only support using the 1st project directory
  // in a given set of workspaces if the provided fileName is null.
  if (projectDirs && projectDirs.length > 0) {
    if (!fileName) {
      return projectDirs[0];
    }

    for (let i = 0; i < projectDirs.length; i++) {
      const dir = projectDirs[i];
      if (fileName.includes(dir)) {
        return dir;
      }
    }
  }
  return null;
}

export async function getFileContributorCount(fileName) {
  let fileType = getFileType(fileName);

  if (fileType === "git") {
    return 0;
  }

  const projectDir = getProjectDir(fileName);
  if (!projectDir || !isGitProject(projectDir)) {
    return 0;
  }

  // all we need is the filename of the path
  // const baseName = path.basename(fileName);

  const cmd = `git log --pretty="%an" ${fileName}`;

  // get the list of users that modified this file
  let resultList = await getCommandResultAsList(cmd, projectDir);
  if (!resultList) {
    // something went wrong, but don't try to parse a null or undefined str
    return 0;
  }

  let uniqueStrings = 0;
  if (resultList.length) {
    uniqueStrings = countUniqueStrings(resultList);
  }
  return uniqueStrings;
}

export async function getRepoFileCount(fileName) {
  const projectDir = getProjectDir(fileName);
  if (!projectDir || !isGitProject(projectDir)) {
    return 0;
  }

  // windows doesn't support the wc -l so we'll just count the list
  let cmd = `git ls-files`;
  // get the author name and email
  let resultList = await getCommandResult(cmd, projectDir);
  if (!resultList) {
    // something went wrong, but don't try to parse a null or undefined str
    return 0;
  }

  return resultList.length;
}

export async function getRepoContributorInfo(fileName, filterOutNonEmails: boolean = true) {
  const projectDir = getProjectDir(fileName);
  if (!projectDir || !isGitProject(projectDir)) {
    return null;
  }

  let repoContributorInfo = {
    identifier: "",
    tag: "",
    branch: "",
    count: 0,
    members: [],
  };

  // get the repo url, branch, and tag
  const resourceInfo = await getResourceInfo(projectDir);
  if (resourceInfo && resourceInfo.identifier) {
    repoContributorInfo.identifier = resourceInfo.identifier;
    repoContributorInfo.tag = resourceInfo.tag;
    repoContributorInfo.branch = resourceInfo.branch;

    // windows doesn't support the "uniq" command, so
    // we'll just go through all of them if it's windows....
    // username, email
    let cmd = `git log --pretty="%an,%ae" | sort`;
    if (!isWindows()) {
      cmd += " | uniq";
    }
    // get the author name and email
    let resultList = await getCommandResult(cmd, projectDir);
    if (!resultList) {
      // something went wrong, but don't try to parse a null or undefined str
      return repoContributorInfo;
    }

    let map = {};
    if (resultList && resultList.length > 0) {
      // count name email
      resultList.forEach((listInfo) => {
        const devInfo = listInfo.split(",");
        const name = devInfo[0];
        const email = normalizeGithubEmail(devInfo[1], filterOutNonEmails);
        if (!map[email]) {
          repoContributorInfo.members.push({
            name,
            email,
          });
          map[email] = email;
        }
      });
    }
    repoContributorInfo.count = repoContributorInfo.members.length;
  }

  return repoContributorInfo;
}

//
// use "git symbolic-ref --short HEAD" to get the git branch
// use "git config --get remote.origin.url" to get the remote url
export async function getResourceInfo(projectDir) {
  if (!projectDir || !isGitProject(projectDir)) {
    return {};
  }
  let branch = await wrapExecPromise("git symbolic-ref --short HEAD", projectDir);
  let identifier = await wrapExecPromise("git config --get remote.origin.url", projectDir);
  let email = await wrapExecPromise("git config user.email", projectDir);
  email = normalizeGithubEmail(email);
  let tag = await wrapExecPromise("git describe --all", projectDir);

  // both should be valid to return the resource info
  if (branch && identifier) {
    return { branch, identifier, email, tag };
  }
  // we don't have git info, return an empty object
  return {};
}
