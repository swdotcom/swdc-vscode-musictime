import * as React from "react";
import * as ReactDOM from "react-dom";
import SideBar from "./views/sidebar";

declare global {
  interface Window {
    acquireVsCodeApi(): any;
    stateData: any;
  }
}

const vscode = window.acquireVsCodeApi();

ReactDOM.render(<SideBar vscode={vscode} stateData={window.stateData} />, document.getElementById("root"));
