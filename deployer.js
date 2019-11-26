#!/usr/bin/env node
const { exec } = require("child_process");
const fs = require("fs");

const KEY_MAP = {
    "code-time": "swdc-vscode",
    "music-time": "music-time"
};

const CODE_TIME_DESC =
    "Code Time is an open source plugin that provides programming metrics right in Visual Studio Code.";
const MUSIC_TIME_DESC =
    "Music Time is an open source plugin that curates and launches playlists for coding right from your editor.";
const CODE_TIME_VERSION = "1.2.6";
const MUSIC_TIME_VERSION = "1.1.3";
const CODE_TIME_DISPLAY = "Code Time";
const MUSIC_TIME_DISPLAY = "Music Time";

// copy the scripts data to dist/scripts
// To build and package music-time
// node deployer music-time package
// To build and package code-time
// node deployer code-time package
async function deploy() {
    const args = process.argv;
    let packageIt = false;
    if (!args || args.length <= 2) {
        console.error("Usage: node deployer <code-time|music-time> [package]");
        process.exit(1);
    }
    let pluginKey = process.argv[2];
    if (process.argv[3]) {
        packageIt = process.argv[3] === "package";
    }
    if (!KEY_MAP[pluginKey]) {
        console.error("No matching plugin found");
        console.error("Usage: node deployer <code-time|music-time> [package]");
        process.exit(1);
    }
    let pluginName = KEY_MAP[pluginKey];

    if (!pluginName) {
        console.error(
            `The plugin extension name is not found based on the key: ${key}`
        );
        console.error("Usage: node deployer <code-time|music-time> [package]");
        process.exit(1);
    }

    debug(`------------- Building plugin: ${pluginName}`);

    let extInfoJson = getJsonFromFile(getExtensionFile());
    extInfoJson["name"] = pluginName;

    let packageJson = getJsonFromFile(getPackageFile());
    packageJson["name"] = pluginName;
    if (pluginName === "swdc-vscode") {
        // update the README with the code time readme
        updateReadme(getCodeTimeReadmeFile());

        // remove contributes.viewsContainers and contributes.views
        if (
            packageJson.contributes &&
            packageJson.contributes.viewsContainers
        ) {
            delete packageJson.contributes.viewsContainers;
        }
        if (packageJson.contributes && packageJson.contributes.views) {
            delete packageJson.contributes.views;
        }
        if (packageJson.contributes && packageJson.contributes.menus) {
            delete packageJson.contributes.menus;
        }
        packageJson["description"] = CODE_TIME_DESC;
        packageJson["version"] = CODE_TIME_VERSION;
        packageJson["displayName"] = CODE_TIME_DISPLAY;
        extInfoJson["displayName"] = CODE_TIME_DISPLAY;

        let codeTimeCommands = [];
        let existingCommands = packageJson.contributes["commands"];
        for (let i = 0; i < existingCommands.length; i++) {
            let commandObj = existingCommands[i];
            if (commandObj.command.indexOf("musictime.") === -1) {
                codeTimeCommands.push(commandObj);
            }
        }
        packageJson.contributes["commands"] = codeTimeCommands;
    } else if (pluginName === "music-time") {
        // update the README with the music time readme
        updateReadme(getMusicTimeReadmeFile());

        //
        // add the viewsContainers and views
        packageJson.contributes["viewsContainers"] = {
            activitybar: [
                {
                    id: "music-time",
                    title: "Music Time",
                    icon: "resources/dark/headphone-symbol.svg"
                }
            ]
        };
        packageJson.contributes["views"] = {
            "music-time": [
                {
                    id: "my-playlists",
                    name: "My Playlists"
                }
            ]
        };
        packageJson.contributes["menus"] = {
            "view/item/context": [
                {
                    command: "musictime.play",
                    when: "viewItem =~ /.*item-notplaying$/",
                    group: "inline@1"
                },
                {
                    command: "musictime.pause",
                    when: "viewItem =~ /.*item-playing$/",
                    group: "inline@1"
                },
                {
                    command: "musictime.sharePlaylist",
                    when: "viewItem =~ /spotify-playlist-item.*/",
                    group: "inline@2"
                },
                {
                    command: "musictime.shareTrack",
                    when: "viewItem =~ /track-item.*/",
                    group: "inline@2"
                }
            ],
            "view/title": [
                {
                    command: "musictime.reconcilePlaylist",
                    group: "navigation",
                    when: "view =~ /.*-playlists/"
                },
                {
                    command: "musictime.sortAlphabetically",
                    group: "inline",
                    when: "view =~ /.*-playlists/"
                },
                {
                    command: "musictime.sortToOriginal",
                    group: "inline",
                    when: "view =~ /.*-playlists/"
                }
            ]
        };
        packageJson["description"] = MUSIC_TIME_DESC;
        packageJson["version"] = MUSIC_TIME_VERSION;
        packageJson["displayName"] = MUSIC_TIME_DISPLAY;
        extInfoJson["displayName"] = MUSIC_TIME_DISPLAY;
        let commands = [];
        commands.push({
            command: "musictime.next",
            title: "Play Next Song"
        });
        commands.push({
            command: "musictime.previous",
            title: "Play Previous Song"
        });
        commands.push({
            command: "musictime.play",
            title: "Play",
            icon: {
                light: "resources/light/play.svg",
                dark: "resources/dark/play.svg"
            }
        });
        commands.push({
            command: "musictime.copyTrack",
            title: "Copy Track Link",
            icon: {
                light: "resources/light/icons8-copy-to-clipboard-16.png",
                dark: "resources/dark/icons8-copy-to-clipboard-16.png"
            }
        });
        commands.push({
            command: "musictime.copyPlaylist",
            title: "Copy Playlist Link",
            icon: {
                light: "resources/light/icons8-copy-to-clipboard-16.png",
                dark: "resources/dark/icons8-copy-to-clipboard-16.png"
            }
        });
        commands.push({
            command: "musictime.shareTrack",
            title: "Share Track",
            icon: {
                light: "resources/light/share.svg",
                dark: "resources/dark/share.svg"
            }
        });
        commands.push({
            command: "musictime.sharePlaylist",
            title: "Share Playlist",
            icon: {
                light: "resources/light/share.svg",
                dark: "resources/dark/share.svg"
            }
        });

        commands.push({
            command: "musictime.pause",
            title: "Stop",
            icon: {
                light: "resources/light/stop.svg",
                dark: "resources/dark/stop.svg"
            }
        });

        commands.push({
            command: "musictime.itunesPlaylist",
            title: "Launch iTunes",
            icon: {
                light: "resources/light/itunes-logo.svg",
                dark: "resources/dark/itunes-logo.svg"
            }
        });

        commands.push({
            command: "musictime.spotifyPlaylist",
            title: "Launch Spotify",
            icon: {
                light: "resources/light/spotify-logo.svg",
                dark: "resources/dark/spotify-logo.svg"
            }
        });
        commands.push({
            command: "musictime.reconcilePlaylist",
            title: "Reconcile Playlists",
            icon: {
                light: "resources/light/sync.svg",
                dark: "resources/dark/sync.svg"
            }
        });
        commands.push({
            command: "musictime.sortAlphabetically",
            title: "Sort A-Z"
        });
        commands.push({
            command: "musictime.sortToOriginal",
            title: "Sort Latest"
        });
        commands.push({
            command: "musictime.like",
            title: "Like Song"
        });
        commands.push({
            command: "musictime.unlike",
            title: "Unlike Song"
        });
        commands.push({
            command: "musictime.menu",
            title: "Click to see more from Music Time"
        });
        commands.push({
            command: "musictime.currentSong",
            title: "Click to view track"
        });
        commands.push({
            command: "musictime.spotifyPremiumRequired",
            title:
                "Connect to your premium Spotify account to use the play, pause, next, and previous controls"
        });
        commands.push({
            command: "musictime.connectSpotify",
            title: "Connect your Spotify account",
            tooltip: "Connect your Spotify account to view your playlists"
        });
        commands.push({
            command: "musictime.connectSlack",
            title: "Connect your Slack account",
            tooltip:
                "Connect your Slack account to share your playlists or tracks"
        });
        commands.push({
            command: "musictime.disconnectSpotify",
            title: "Disconnect your Spotify account",
            tooltip: "Disconnect your Spotify account"
        });
        commands.push({
            command: "musictime.disconnectSlack",
            title: "Disconnect your Slack account",
            tooltip: "Disconnect your Slack account"
        });
        commands.push({
            command: "musictime.refreshSettings",
            title: "Refresh Settings"
        });
        commands.push({
            command: "musictime.refreshPlaylist",
            title: "Refresh Playlists"
        });

        packageJson.contributes["commands"] = commands;
    }

    updateJsonContent(extInfoJson, getExtensionFile());
    updateJsonContent(packageJson, getPackageFile());

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
        `${copyCmd} lib${pathSep}extensioninfo.json out${pathSep}lib${pathSep}.`,
        "Copy the extensioninfo.json to the out/lib directory"
    );

    await runCommand(
        `${copyCmd} resources${pathSep}* out${pathSep}resources${pathSep}.`,
        "Copy the resources to the out dir"
    );

    if (packageIt) {
        await runCommand("vsce package", "package the plugin");
    }
}

function isWindows() {
    return process.platform.indexOf("win32") !== -1;
}

function getExtensionFile() {
    return __dirname + "/lib/extensioninfo.json";
}

function getPackageFile() {
    return __dirname + "/package.json";
}

function getReadmeFile() {
    return __dirname + "/README.md";
}

function getMusicTimeReadmeFile() {
    return __dirname + "/musictime.readme.md";
}

function getCodeTimeReadmeFile() {
    return __dirname + "/codetime.readme.md";
}

function getJsonFromFile(filename) {
    let content = fs.readFileSync(filename).toString();
    if (content) {
        try {
            const data = JSON.parse(content);
            return data;
        } catch (e) {
            //
        }
    }
    return null;
}

function updateJsonContent(packageJson, filename) {
    try {
        // JSON.stringify(data, replacer, number of spaces)
        const content = JSON.stringify(packageJson, null, 4);
        fs.writeFileSync(filename, content, err => {
            if (err)
                console.log(
                    "Deployer: Error updating the package content: ",
                    err.message
                );
            process.exit(1);
        });
    } catch (e) {
        //
    }
}

function updateReadme(readmeFile) {
    try {
        if (fs.existsSync(readmeFile)) {
            const readmeContent = fs.readFileSync(readmeFile).toString();

            // update the readme file

            fs.writeFileSync(getReadmeFile(), readmeContent, err => {
                if (err) {
                    logIt(
                        `Error writing to the README.md file: ${err.message}`
                    );
                }
            });
        }
    } catch (err) {}
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

deploy();
