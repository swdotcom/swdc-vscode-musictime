import {
  CancellationToken,
  commands,
  Disposable,
  Event,
  EventEmitter,
  Uri,
  ViewColumn,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from "vscode";
import path = require("path");
import { getItem } from "../managers/FileManager";
import { getReactData } from "./ReactData";
import { MusicCommandManager } from "../music/MusicCommandManager";

export class MusicTimeWebviewSidebar implements Disposable, WebviewViewProvider {
  private _webview: WebviewView | undefined;
  private _disposable: Disposable | undefined;

  constructor(private readonly _extensionUri: Uri) {
    //
  }

  public async refresh(tab_view = undefined, playlist_id = undefined, loading = false) {
    if (!this._webview) {
      // its not available to refresh yet
      return;
    }
    this._webview.webview.html = await this.getReactHtml(tab_view, playlist_id, loading);
  }

  private _onDidClose = new EventEmitter<void>();
  get onDidClose(): Event<void> {
    return this._onDidClose.event;
  }

  // this is called when a view first becomes visible. This may happen when the view is first loaded
  // or when the user hides and then shows a view again
  public async resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext<unknown>, token: CancellationToken) {
    if (!this._webview) {
      this._webview = webviewView;
    }

    this._webview.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [this._extensionUri],
    };

    this._disposable = Disposable.from(this._webview.onDidDispose(this.onWebviewDisposed, this));

    this._webview.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "command_execute":
          if (message.arguments?.length) {
            commands.executeCommand(message.action, ...message.arguments);
          } else {
            commands.executeCommand(message.action);
          }
          break;
      }
    });

    this.loadWebview();
  }

  private async loadWebview(tries = 10) {
    const musicInitialized = MusicCommandManager.isInitialized();
    // make sure the jwt is available. The session info may have
    // been removed while this view was open.
    if ((getItem("jwt") && musicInitialized) || tries <= 0) {
      this._webview.webview.html = await this.getReactHtml(null, null, true);
    } else {
      tries--;
      setTimeout(() => {
        this.loadWebview(tries);
      }, 2000);
    }
  }

  private async getReactHtml(tab_view = undefined, playlist_id = undefined, loading = false): Promise<string> {
    const reactAppPathOnDisk = Uri.file(path.join(__dirname, "webviewSidebar.js"));
    const reactAppUri = reactAppPathOnDisk.with({ scheme: "vscode-resource" });
    const stateData = JSON.stringify(await getReactData(tab_view, playlist_id, loading));

    return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Config View</title>
			<style>
			  body {
				margin: 0;
				padding: 0;
				font-family: Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans,
				Droid Sans, Helvetica Neue, sans-serif;
				background-color: transparent !important;
			  }
			</style>
			<meta http-equiv="Content-Security-Policy"
						content="default-src 'none';
								img-src https:;
								script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:;
								style-src vscode-resource: 'unsafe-inline';">
			<script>
			  window.acquireVsCodeApi = acquireVsCodeApi;
			  window.stateData = ${stateData}
			</script>
		</head>
		<body>
			<div id="root"></div>
			<script src="${reactAppUri}"></script>
		</body>
		</html>`;
  }

  dispose() {
    this._disposable && this._disposable.dispose();
  }

  private onWebviewDisposed() {
    this._onDidClose.fire();
  }

  get viewColumn(): ViewColumn | undefined {
    // this._view._panel.viewColumn;
    return undefined;
  }

  get visible() {
    return this._webview ? this._webview.visible : false;
  }
}
