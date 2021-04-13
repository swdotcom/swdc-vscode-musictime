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
  MuiTuneIcon,
  PawIcon,
  DashboardIcon,
} from "../icons";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Collapse from "@material-ui/core/Collapse";
import grey from "@material-ui/core/colors/grey";
import Workspaces from "./workspaces";

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
}));

export default function Account(props) {
  const classes = useStyles();
  const stateData = props.stateData;

  const [accountOpen, setAccountOpen] = useState(false);

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

  function audioClickHandler() {
    const command = {
      action: "musictime.showPlaylistOptionsMenu",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function accountClickHandler() {
    setAccountOpen(!accountOpen);
  }

  return (
    <Grid container className={classes.root}>
      <Grid item key="accont-user-info-grid-item" xs={12}>
        <List disablePadding={true} dense={true}>
          <ListItem key="account_manage_item" disableGutters={true} dense={true}>
            <ListItemText key="account_manage" primary="Account" secondary={!stateData.registered ? "Manage your account" : stateData.email} />
            <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
              <IconButton onClick={audioClickHandler} aria-label="View audio controls">
                <MuiTuneIcon />
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
            <ListItemIcon>
              <DashboardIcon />
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
