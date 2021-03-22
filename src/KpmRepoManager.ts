import { isGitProject } from './repo/GitUtil';
import { execCmd } from "./managers/ExecManager"
import {
  normalizeGithubEmail,
} from "./Util";

//
// use "git symbolic-ref --short HEAD" to get the git branch
// use "git config --get remote.origin.url" to get the remote url
export async function getResourceInfo(projectDir) {
  if (!projectDir || !isGitProject(projectDir)) {
    return null;
  }
  let branch = execCmd("git symbolic-ref --short HEAD", projectDir);
  let identifier = execCmd("git config --get remote.origin.url", projectDir);
  let email = execCmd("git config user.email", projectDir);
  if (email) {
    email = normalizeGithubEmail(email);
  }
  let tag = execCmd("git describe --all", projectDir);

  // both should be valid to return the resource info
  if (branch && identifier) {
    return { branch, identifier, email, tag };
  }
  // we don't have git info
  return null;
}
