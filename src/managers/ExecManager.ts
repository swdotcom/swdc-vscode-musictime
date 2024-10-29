// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execSync } = require("child_process");

export function execCmd(cmd = "", projectDir = null, returnLines = false): any {
	let result = returnLines ? [] : null;
	if (!cmd) {
	  // no command to run, return default
	  return result;
	}

	try {
	  const opts = projectDir ? { cwd: projectDir, encoding: "utf8" } : { encoding: "utf8" };

	  const cmdResult = execSync(cmd, opts);
	  if (cmdResult && cmdResult.length) {
		const lines = cmdResult.trim().replace(/^\s+/g, " ").replace(/</g, "").replace(/>/g, "").split(/\r?\n/);
		if (lines.length) {
		  result = returnLines ? lines : lines[0];
		}
	  }
	} catch (e) {
	  console.error("command error: ", e);
	}
	return result;
  }
