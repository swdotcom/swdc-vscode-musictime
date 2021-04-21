import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import Tooltip from "@material-ui/core/Tooltip";
import Divider from "@material-ui/core/Divider";
import { DARK_BG_COLOR } from "../../utils/view_constants";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import IconButton from "@material-ui/core/IconButton";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import AudioControl from "./audio_control";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import SlackWorkspaces from "./slack_workspaces";
import {
  GoogleIcon,
  MuiGitHubIcon,
  EmailIcon,
  MessageIcon,
  DocumentIcon,
  SpotifyIcon,
  MuiHeadsetIcon,
  MuiDashboardIcon,
  MuiSettingsRemoteIcon,
  MuiSettingsIcon,
  SlackFolderIcon,
} from "../icons";
import { grey } from "@material-ui/core/colors";

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    margin: 0,
    padding: 0,
    width: "100%",
    color: "white",
    position: "relative",
  },
  primaryContent: {
    color: "white",
  },
  secondaryContent: {
    color: grey[500],
  },
  secondaryAction: {
    right: 0,
  },
  listItemIcon: {
    display: "flex",
    justifyContent: "center",
    textAlign: "center",
    minWidth: "32px",
  },
  containerRoot: {
    padding: 0,
    margin: 0,
    background: DARK_BG_COLOR,
  },
}));

export default function UserAccount(props) {
  const classes = useStyles();
  const stateData = props.stateData;

  const [anchorEl, setAnchorEl] = useState(null);
  const [openMenu, setOpenMenu] = useState(false);
  const [slackAnchorEl, setSlackAnchorEl] = useState(null);
  const [openSlackMenu, setOpenSlackMenu] = useState(false);

  function documentationClickHandler() {
    const command = {
      action: "musictime.launchReadme",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function dashboardClickHandler() {
    const command = {
      action: "musictime.displayDashboard",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function submitIssueClickHandler() {
    const command = {
      action: "musictime.submitAnIssue",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function switchSpotifyHandler() {
    const command = {
      action: "musictime.switchSpotifyAccount",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
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
  }

  function handleAudioOptionsClick(event) {
    setOpenMenu(!openMenu);
    if (event) {
      setAnchorEl(event.currentTarget);
      event.stopPropagation();
    }
  }

  function handleAudioOptionsClose() {
    setOpenMenu(false);
  }

  function editWorkspacesClick(event) {
    setSlackAnchorEl(event.currentTarget);
    setOpenSlackMenu(true);
  }

  const handleSlackWorksapcesClose = () => {
    setOpenSlackMenu(false);
  };

  return (
    <div className={classes.root} id="user-account-container">
      <Accordion defaultExpanded={false} className={classes.containerRoot} square={true}>
        <AccordionSummary
          classes={{ root: classes.root, content: classes.root }}
          expandIcon={<ExpandMoreIcon style={{ color: "white" }} />}
          IconButtonProps={{ edge: false }}
          aria-controls="panel1c-content"
          id="panel1c-header"
          onClick={props.expandUserAccountCallback}
        >
          <List className={classes.root}>
            <ListItem key="account_manage_item" disableGutters={true} dense={true}>
              <ListItemIcon className={classes.listItemIcon}>
                {!stateData.registered ? null : stateData.authType === "github" ? (
                  <MuiGitHubIcon />
                ) : stateData.authType === "google" ? (
                  <GoogleIcon />
                ) : (
                  <EmailIcon />
                )}
              </ListItemIcon>
              <ListItemText
                key="account_manage"
                primary="Account"
                secondary={!stateData.registered ? "Manage your account" : stateData.email}
                classes={{ primary: classes.primaryContent }}
              />
              <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
                <Tooltip title="Playback control">
                  <IconButton onClick={handleAudioOptionsClick}>
                    <MuiSettingsRemoteIcon />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </AccordionSummary>
        <Divider style={{ background: grey[700] }} />
        <AccordionDetails className={classes.root}>
          <List disablePadding={true} dense={true} className={classes.root}>
            {props.stateData.spotifyUser ? (
              <ListItem key="spotify-account-li" disableGutters={true} dense={true}>
                <ListItemIcon className={classes.listItemIcon}>
                  <SpotifyIcon />
                </ListItemIcon>
                <ListItemText
                  id="spotify-account-li-text"
                  primary={props.stateData.spotifyUser?.product === "premium" ? `Spotify Premium` : `Spotify Open`}
                  secondary={`(${props.stateData.spotifyUser.email})`}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Switch your Spotify account">
                    <IconButton onClick={switchSpotifyHandler}>
                      <MuiHeadsetIcon />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ) : (
              <ListItem key="spotify-connect" disableGutters={true} dense={true} button onClick={connectSpotifyHandler}>
                <ListItemIcon>
                  <SpotifyIcon />
                </ListItemIcon>
                <ListItemText id="spotify-connect-li" primary="Connect Spotify" />
              </ListItem>
            )}

            <ListItem key="slack-settings-li" disableGutters={true} dense={true}>
              <ListItemIcon className={classes.listItemIcon}>
                <SlackFolderIcon />
              </ListItemIcon>
              <ListItemText id="slack-settings-li-text" primary="Slack workspaces" />
              <ListItemSecondaryAction>
                <Tooltip title="Add or remove slack workspaces">
                  <IconButton onClick={editWorkspacesClick}>
                    <MuiSettingsIcon />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>

            <ListItem key="dashboard-li" disableGutters={true} dense={true} button onClick={dashboardClickHandler}>
              <ListItemIcon className={classes.listItemIcon}>
                <MuiDashboardIcon />
              </ListItemIcon>
              <ListItemText id="report-dashboard-li" primary="Dashboard" />
            </ListItem>

            <ListItem key="documentation" disableGutters={true} dense={true} button onClick={documentationClickHandler}>
              <ListItemIcon className={classes.listItemIcon}>
                <DocumentIcon />
              </ListItemIcon>
              <ListItemText id="documentation-li" primary="Documentation" />
            </ListItem>

            <ListItem key="submit-issue" disableGutters={true} dense={true} button onClick={submitIssueClickHandler}>
              <ListItemIcon className={classes.listItemIcon}>
                <MessageIcon />
              </ListItemIcon>
              <ListItemText id="submit-issue-li" primary="Submit an issue" />
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>

      <AudioControl
        vscode={props.vscode}
        stateData={props.stateData}
        anchorEl={anchorEl}
        openMenu={openMenu}
        handleCloseCallback={handleAudioOptionsClose}
      />

      <SlackWorkspaces
        vscode={props.vscode}
        stateData={props.stateData}
        anchorEl={slackAnchorEl}
        openMenu={openSlackMenu}
        handleCloseCallback={handleSlackWorksapcesClose}
      />
    </div>
  );
}
