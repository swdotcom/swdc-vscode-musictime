import { isGitProject } from './repo/GitUtil';
import {
  getCommandResultString,
  normalizeGithubEmail,
} from "./Util";

//
// use "git symbolic-ref --short HEAD" to get the git branch
// use "git config --get remote.origin.url" to get the remote url
export async function getResourceInfo(projectDir) {
  if (!projectDir || !isGitProject(projectDir)) {
    return null;
  }
  let branch = getCommandResultString("git symbolic-ref --short HEAD", projectDir);
  let identifier = getCommandResultString("git config --get remote.origin.url", projectDir);
  let email = getCommandResultString("git config user.email", projectDir);
  email = normalizeGithubEmail(email);
  let tag = getCommandResultString("git describe --all", projectDir);

  // both should be valid to return the resource info
  if (branch && identifier) {
    return { branch, identifier, email, tag };
  }
  // we don't have git info
  return null;
}
