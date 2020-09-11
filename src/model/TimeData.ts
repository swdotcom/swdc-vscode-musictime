import Project from "./Project";

export default class TimeData {
  editor_seconds: number = 0;
  session_seconds: number = 0;
  file_seconds: number = 0;
  day: string = "";
  project: Project = new Project();
}
