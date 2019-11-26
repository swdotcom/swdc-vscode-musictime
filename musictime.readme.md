[![](https://vsmarketplacebadge.apphb.com/version-short/softwaredotcom.swdc-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=softwaredotcom.swdc-vscode) [![](https://vsmarketplacebadge.apphb.com/installs-short/softwaredotcom.swdc-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=softwaredotcom.swdc-vscode) [![](https://vsmarketplacebadge.apphb.com/rating-short/softwaredotcom.swdc-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=softwaredotcom.swdc-vscode)
[![](https://aka.ms/vsls-badge)](https://aka.ms/vsls)

# Music Time for Visual Studio Code

> Developers: Use data and AI to discover the most productive music to listen to as you code

<p align="center" style="margin: 0 10%">
  <img src="https://swdc-static-assets.s3-us-west-1.amazonaws.com/music-time-dashboard.png" alt="Music Time for VS Code" />
</p>

## Features

**Weekly music dashboard**
See your top songs, artists, and genres each week by productivity score and plays while coding.

**Global top 40 playlists**
Discover new music from developers around the world in our Software Top 40 playlist.

**Embedded playlists**
Browse and play your Spotify and iTunes playlists and songs from your editor.

**Integrated player controls**
Control your music right from the status bar of your editor. 

**Slack integration**
Share the music that makes you most productive with your team.

**Data visualizations**
Learn more about your music with a range of music metrics and data visualizations.

## Player controls support

On Mac, player controls are fully supported for both Spotify and iTunes. On Windows and Linux, users must integrate a premium Spotify account to use the player controls. iTunes is currently not supported on Windows or Linux.

| Player  | Spotify                                                         | iTunes        |
|---------|-----------------------------------------------------------------|---------------|
| MacOS   | Premium users, non-premium users with the desktop app installed | Supported     |
| Windows | Premium users only                                              | Not supported |
| Linux   | Premium users only                                              | Not supported |

All Windows and Linux users will see a button in the status bar (“Connect Premium”) and a button in the playlist tree (“Spotify Premium Required”) during their first-time use.

Whereas Music Time can control the Spotify desktop player using osascript on MacOS, on Windows and Linux, Music Time requires a Spotify API connection. Since controlling the Spotify player is a premium Spotify feature, you will not be able to control your music or view your playlists on Windows without a premium Spotify account. However, you will still be able to view your currently playing track and like/unlike songs from the status bar, since those interactions don’t require a premium account. You will also be able to take advantage of other features that Music Time has to offer, such as seeing your top songs by productivity, both in the in-editor and web dashboards. 

You can check out the [cody-music](https://www.npmjs.com/package/cody-music) NPM for more information.

## Slack integration

You can connect Slack to share songs and playlists in public channels in your workspace.

<p align="center" style="margin: 0 10%">
  <img src="https://swdc-static-assets.s3-us-west-1.amazonaws.com/music-time-integrate-slack.png" alt="Music Time for VS Code" />
</p>

You must be a workspace admin to install a Slack app, but you may request that your workspace admin install an app. You can read more about Slack app permissions [here](https://get.slack.help/hc/en-us/articles/202035138-Add-an-app-to-your-workspace).

## FAQs

**What players are supported?**
We support iTunes and Spotify. We will support Google Play in a future release.

**Why does Music Time cause iTunes to open when I click “Switch to iTunes”?**
In order to control music in your iTunes playlists, iTunes must be open. We open iTunes in the foreground when you click “Switch to iTunes”.

**Why do I need to sign into Spotify?**
You must be signed into your Spotify account to control the Spotify music player and view your playlists embedded in your editor.

**How do you calculate my productivity score?**
Productivity score is calculated by combining data from coding metrics when a song is played and historical metrics about productivity from over 10,000 developers, including language and complexity factors. Learn more about productivity score here.  

**What is the Software Top 40?**
The Software Top 40 consists of the top 40 most productive songs for all Music Time users. It is updated each week.

**How are songs recommended?**
Songs are recommended using machine learning and data including a number of different metrics, such as productivity score, plays, hearts (favorites), tempo, loudness, speechiness, energy, and valence.

**What data does Music Time collect?**
Music Time captures metrics such as the song name, artist, start, and end time of the currently playing song. It also captures keystrokes, lines, copy/paste actions, file open/close, file names, and project names. See the [Code Time](https://marketplace.visualstudio.com/items?itemName=softwaredotcom.swdc-vscode&ssr=false#review-details) plugin for more details.

**How accurate is Music Time?**
Music Time checks every 15 seconds to see if a new track is playing. 

**How is my music data correlated with my coding metrics?**
Coding metrics are calculated for the playing period of each song, and then all plays are combined for individuals and collections of users. We take the raw data and run a calculation to determine the productivity score for each song. Songs are then ranked by productivity score.

**Why is there latency when using the player controls?**
For Spotify, many of the player controls work via the Spotify API, which may result in a slight lag in responsiveness.

**Why do only 50 of my playlists appear in my tree view?**
We limit the number of playlists in the tree view to 50.

**What happens to my personalized playlist if I disconnect Spotify?**
If you disconnect Spotify, your AI Top 40 playlist will remain in your Spotify library. To refresh this playlist, you must reconnect your Spotify account.

**Can I use Music Time on multiple devices?**
Yes. If you are using Spotify, the playlist tree view will you if your Spotify account is available for playback on your current device.

## Contributing & Feedback

You can open an issue on a GitHub page or contact us at [cody@software.com](mailto:cody@software.com) with any additional questions or comments.
