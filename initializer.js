const { exec } = require("child_process");
const fs = require("fs");

async function initialize() {
    const copyCmd = !isWindows() ? "cp -R" : "xcopy /E";
    const pathSep = !isWindows() ? "/" : "\\";

    await runCommand(
        `mkdir -p out${pathSep}lib`,
        "Creating the out/lib directory if it doesn't exist",
        true
    );

    await runCommand(
        `mkdir -p out${pathSep}resources`,
        "Creating the out/resources directory if it doesn't exist",
        true
    );

    await runCommand(
        `mkdir -p out${pathSep}lib${pathSep}images`,
        "Creating the out/lib/images directory if it doesn't exist",
        true
    );

    await runCommand(
        `${copyCmd} lib${pathSep}extensioninfo.json README.md out${pathSep}lib${pathSep}.`,
        "Copy the extensioninfo.json and README.md to the out/lib directory"
    );

    await runCommand(
        `${copyCmd} resources${pathSep}* out${pathSep}resources${pathSep}.`,
        "Copy the resources to the out dir"
    );

    await runCommand(
        `${copyCmd} images${pathSep}* out${pathSep}lib${pathSep}images${pathSep}.`,
        "Copy the images to the out dir"
    );
}

async function runCommand(cmd, execMsg, ignoreError = false) {
    debug("Executing task to " + execMsg + ".");
    let execResult = await wrapExecPromise(cmd);

    if (execResult && execResult.status === "failed" && !ignoreError) {
        /* error happened */
        debug("Failed to " + execMsg + ", reason: " + execResult.message);
        process.exit(1);
    }
}

function isWindows() {
    return process.platform.indexOf("win32") !== -1;
}

async function wrapExecPromise(cmd, dir) {
    let result = null;
    try {
        let dir = __dirname;
        let opts = dir !== undefined && dir !== null ? { cwd: dir } : {};
        result = await execPromise(cmd, opts);
    } catch (e) {
        result = { status: "failed", message: e.message };
    }
    return result;
}

function execPromise(command, opts) {
    return new Promise(function(resolve, reject) {
        exec(command, opts, (error, stdout, stderr) => {
            if (stderr) {
                resolve({ status: "failed", message: stderr.trim() });
                return;
            } else if (error) {
                resolve({ status: "failed", message: error.message });
                return;
            } else {
                resolve({ status: "success", message: stdout.trim() });
            }
        });
    });
}

function debug(message) {
    console.log("-- " + message + "\n");
}

initialize();
