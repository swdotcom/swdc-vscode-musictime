import { isGitProject } from './repo/GitUtil';
import {
  wrapExecPromise,
  normalizeGithubEmail,
} from "./Util";

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
