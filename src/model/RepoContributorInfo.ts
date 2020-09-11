import TeamMember from "./TeamMember";

export default class RepoContributorInfo {
  public identifier: string = "";
  public tag: string = "";
  public branch: string = "";
  public count: number = 0;
  public members: TeamMember[] = [];
}
