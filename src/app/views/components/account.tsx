import React, { useState } from "react";
import Grid from "@material-ui/core/Grid";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import { makeStyles } from "@material-ui/core/styles";
import {
  GoogleIcon,
  MuiGitHubIcon,
  EmailIcon,
  MessageIcon,
  DocumentIcon,
  SpotifyIcon,
  MuiSyncIcon,
  PawIcon,
  MuiDashboardIcon,
  MuiCloseIcon,
  MuiSettingsRemoteIcon,
  MuiSkipPreviousIcon,
  MuiPlayArrowIcon,
  MuiSkipNextIcon,
  MuiRepeatIcon,
  MuiShuffleIcon,
} from "../icons";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Collapse from "@material-ui/core/Collapse";
import { grey, deepPurple } from "@material-ui/core/colors";
import Workspaces from "./workspaces";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import Divider from "@material-ui/core/Divider";
import { DARK_BG_COLOR, MAX_MENU_HEIGHT } from "../../utils/view_constants";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    width: "100%",
    padding: 0,
    margin: 0,
  },
  textButton: {
    width: "100%",
    justifyContent: "flex-start",
    padding: theme.spacing(0.25, 0.5),
    fontWeight: 500,
  },
  secondaryAction: {
    right: 0,
    padding: "14px 20px",
  },
  collapseList: {
    flexGrow: 1,
    width: "100%",
    margin: 0,
    padding: 0,
  },
  collapseListItem: {
    marginLeft: 10,
  },
  primaryListText: {
    flexGrow: 1,
    width: "100%",
    fontWeight: 400,
    fontSize: 12,
  },
  secondaryListText: {
    color: grey[500],
    fontWeight: 300,
    fontSize: 12,
    right: 0,
  },
  label: {
    fontWeight: "inherit",
    color: "inherit",
  },
  labelRoot: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0.5, 0),
  },
  labelIcon: {
    marginRight: theme.spacing(1),
  },
  labelText: {
    fontWeight: "inherit",
    flexGrow: 1,
  },
  controls: {
    display: "flex",
    flexGrow: 1,
    width: "100%",
    paddingLeft: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  menuHeaderPrimary: {
    color: deepPurple[200],
    marginRight: 10,
  },
  menuHeaderSecondary: {
    color: grey[500],
    fontWeight: 300,
    fontSize: 12,
  },
  listItemIcon: {
    display: "flex",
    justifyContent: "center",
    textAlign: "center",
    margin: 0,
    padding: 0,
  },
}));

function getTrackName(currentTrack) {
  let runningTrackName = "Select a track";
  if (isTrackAvailable(currentTrack)) {
    runningTrackName = currentTrack.name;
    if (currentTrack.artist) {
      runningTrackName += ` - ${currentTrack.artist}`;
    } else if (currentTrack.album) {
      runningTrackName += ` - ${currentTrack.album}`;
    }
  }
  return runningTrackName;
}

function getTrackStatus(currentTrack, spotifyContext) {
  const currentVolume = currentTrack.volume ?? 0;

  let msg = "";

  if (currentTrack && currentTrack.id) {
    if (currentTrack.state === "playing") {
      msg += `playing; `;
    } else if (currentTrack.state === "paused") {
      msg += `paused; `;
    }
  }

  if (isRepeatingTrack(spotifyContext)) {
    msg += "repeating track; ";
  } else if (isRepeatingPlaylist(spotifyContext)) {
    msg += "repeating playlist; ";
  }

  if (isShuffling(spotifyContext)) {
    msg += "shuffling playlist; ";
  }

  msg += `volume ${currentVolume}%`;
  return msg;
}

function isRepeatingTrack(spotifyContext) {
  return !!(spotifyContext.repeat_state === "track");
}

function isRepeatingPlaylist(spotifyContext) {
  return !!(spotifyContext.repeat_state === "context");
}

function isShuffling(spotifyContext) {
  return !!(spotifyContext.shuffle_state === true);
}

function isTrackAvailable(currentTrack) {
  return !!(currentTrack && currentTrack.id);
}

export default function Account(props) {
  const classes = useStyles();
  const stateData = props.stateData;
  const spotifyContext = props.stateData.spotifyPlayerContext;
  const currentTrack = props.stateData.currentlyRunningTrack;

  const runningTrackName = getTrackName(currentTrack);
  const runningTrackStatus = getTrackStatus(currentTrack, spotifyContext);
  const enableControls = isTrackAvailable(currentTrack);
  const repeatingTrack = isRepeatingTrack(currentTrack);

  /**
   * paused song
   * spotifyPlayerContext
   * {"timestamp":0,"device":{"id":"","is_active":"","is_restricted":false,
   * "name":"","type":"","volume_percent":0},"progress_ms":"","is_playing":false,
   * "currently_playing_type":"","actions":null,"item":null,"shuffle_state":false,
   * "repeat_state":"","context":null}
   *
   * currentlyRunningTrack:
   * {"artist":"Yves V","album":"Echo","genre":"","disc_number":1,"duration":180560,"played_count":0,
   * "track_number":1,"id":"57Zcl7oKKr29qHp38dzzWi","name":"Echo","state":"paused",
   * "volume":100,"popularity":67,
   * "artwork_url":"https://i.scdn.co/image/ab67616d0000b2730b74292f2a1f6825f10f3c4f",
   * "spotify_url":"spotify:track:57Zcl7oKKr29qHp38dzzWi","progress_ms":27898,
   * "uri":"spotify:track:57Zcl7oKKr29qHp38dzzWi"}
   */

  const [accountOpen, setAccountOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  function documentationClickHandler() {
    const command = {
      action: "musictime.displayReadme",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    setAccountOpen(false);
  }

  function dashboardClickHandler() {
    const command = {
      action: "musictime.displayDashboard",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    setAccountOpen(false);
  }

  function webAnalyticsClickHandler() {
    const command = {
      action: "musictime.launchAnalytics",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    setAccountOpen(false);
  }

  function submitIssueClickHandler() {
    const command = {
      action: "musictime.submitAnIssue",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    setAccountOpen(false);
  }

  function switchSpotifyHandler() {
    const command = {
      action: "musictime.switchSpotifyAccount",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    setAccountOpen(false);
  }

  function connectSpotifyHandler() {
    if (stateData.spotifyUser) {
      return;
    }
    const command = {
      action: "musictime.connectSpotify",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    setAccountOpen(false);
  }

  function accountClickHandler() {
    setAccountOpen(!accountOpen);
  }

  function handleAudioOptionsClick(event) {
    setAnchorEl(event.currentTarget);
    event.preventDefault();
  }

  function handleClose(event = null) {
    setAnchorEl(null);
    event.preventDefault();
  }

  function toggleShuffleHandler() {}

  return (
    <Grid container className={classes.root}>
      <Grid item key="accont-user-info-grid-item" xs={12}>
        <List disablePadding={true} dense={true}>
          <ListItem key="account_manage_item" disableGutters={true} dense={true}>
            <ListItemText key="account_manage" primary="Account" secondary={!stateData.registered ? "Manage your account" : stateData.email} />
            <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
              <IconButton onClick={handleAudioOptionsClick} aria-label="View audio controls">
                <MuiSettingsRemoteIcon />
              </IconButton>
              <IconButton edge="end" onClick={accountClickHandler} aria-label="View account info">
                {!stateData.registered ? null : stateData.authType === "github" ? (
                  <MuiGitHubIcon />
                ) : stateData.authType === "google" ? (
                  <GoogleIcon />
                ) : (
                  <EmailIcon />
                )}
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Grid>
      <Menu
        id="main-audio-options-menu"
        anchorEl={anchorEl}
        keepMounted
        open={open}
        PaperProps={{
          style: {
            maxHeight: MAX_MENU_HEIGHT,
            backgroundColor: DARK_BG_COLOR,
            paddingRight: 6,
            paddingLeft: 0,
          },
        }}
      >
        <MenuItem key="audio-options-menu-item" style={{ padding: 0, margin: 0 }}>
          <List disablePadding={true} dense={true} style={{ marginLeft: 10, marginRight: 10, marginBottom: 0, marginTop: 0 }}>
            <ListItem key={`audo-options-info-li`} disableGutters={true} dense={true}>
              <ListItemText
                primary={
                  <Typography noWrap className={classes.menuHeaderPrimary}>
                    {runningTrackName}
                  </Typography>
                }
                secondary={
                  <Typography noWrap className={classes.menuHeaderSecondary}>
                    {runningTrackStatus}
                  </Typography>
                }
              />
            </ListItem>
          </List>
          <IconButton aria-label="Close" onClick={handleClose} style={{ position: "absolute", right: 2, top: 2 }}>
            <MuiCloseIcon />
          </IconButton>
        </MenuItem>
        <div style={{ width: "100%" }}>
          <Box display="flex" p={1}>
            <Box>
              <IconButton>
                <MuiSkipPreviousIcon />
              </IconButton>
              <IconButton>
                <MuiPlayArrowIcon />
              </IconButton>
              <IconButton>
                <MuiSkipNextIcon />
              </IconButton>
            </Box>
            <Box flexGrow={1}></Box>
            <Box>
              <IconButton>
                <MuiRepeatIcon />
              </IconButton>
            </Box>
            <Box>
              <IconButton>
                <MuiShuffleIcon />
              </IconButton>
            </Box>
          </Box>
        </div>
      </Menu>
      <Collapse in={accountOpen} timeout="auto" unmountOnExit className={classes.root}>
        <List className={classes.collapseList} disablePadding={true} dense={true}>
          {!props.stateData.spotifyUser && (
            <ListItem key="spotify-connect" disableGutters={true} dense={true} button onClick={connectSpotifyHandler}>
              <ListItemIcon>
                <SpotifyIcon />
              </ListItemIcon>
              <ListItemText id="spotify-connect-li" primary="Connect Spotify" classes={{ primary: classes.primaryListText }} />
            </ListItem>
          )}
          {props.stateData.spotifyUser && (
            <Grid container justify="space-between" alignItems="center">
              <Grid item key={`account-user-icon-container`} xs={10}>
                <div className={classes.labelRoot}>
                  <ListItemIcon>
                    <SpotifyIcon />
                  </ListItemIcon>
                  <Typography>{props.stateData.spotifyUser.email}</Typography>
                </div>
              </Grid>
              <Grid item key={`account-user-product-info`} xs={2} className={classes.secondaryListText}>
                {props.stateData.spotifyUser?.product === "premium" ? "Premium" : "Open"}
              </Grid>
            </Grid>
          )}

          {props.stateData.spotifyUser && (
            <ListItem key="switch-spotify" disableGutters={true} dense={true} button onClick={switchSpotifyHandler}>
              <ListItemIcon style={{ marginLeft: 3 }}>
                <MuiSyncIcon />
              </ListItemIcon>
              <ListItemText id="spotify-switch-li" primary="Switch spotify account" classes={{ primary: classes.primaryListText }} />
            </ListItem>
          )}

          <ListItem key="report-dashboard" disableGutters={true} dense={true} button onClick={dashboardClickHandler}>
            <ListItemIcon style={{ marginLeft: 3 }}>
              <MuiDashboardIcon />
            </ListItemIcon>
            <ListItemText id="report-dashboard-li" primary="Dashboard" classes={{ primary: classes.primaryListText }} />
          </ListItem>

          <ListItem key="web-analytics" disableGutters={true} dense={true} button onClick={webAnalyticsClickHandler}>
            <ListItemIcon>
              <PawIcon />
            </ListItemIcon>
            <ListItemText id="web-analytics-li" primary="More data at Software.com" classes={{ primary: classes.primaryListText }} />
          </ListItem>

          <ListItem key="documentation" disableGutters={true} dense={true} button onClick={documentationClickHandler}>
            <ListItemIcon>
              <DocumentIcon />
            </ListItemIcon>
            <ListItemText id="documentation-li" primary="Documentation" classes={{ primary: classes.primaryListText }} />
          </ListItem>

          <ListItem key="submit-issue" disableGutters={true} dense={true} button onClick={submitIssueClickHandler}>
            <ListItemIcon>
              <MessageIcon />
            </ListItemIcon>
            <ListItemText id="submit-issue-li" primary="Submit an issue" classes={{ primary: classes.primaryListText }} />
          </ListItem>

          <ListItem key="slack-workspaces" disableGutters={true} dense={true}>
            <Workspaces vscode={props.vscode} stateData={props.stateData} />
          </ListItem>
        </List>
      </Collapse>
    </Grid>
  );
}
