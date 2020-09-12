import { TrackerManager } from "./managers/TrackerManager";

async function uninstall() {
  const tracker: TrackerManager = TrackerManager.getInstance();
  await tracker.trackEditorAction("editor", "deactivate");
  process.exit(0);
}

uninstall();
