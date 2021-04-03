import React, { useState } from "react";
import Grid from "@material-ui/core/Grid";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import { makeStyles } from "@material-ui/core/styles";
import { GoogleIcon, GithubIcon, EmailIcon } from "../icons";
import { MessageIcon, DocumentIcon, SpotifyIcon, MuiSyncIcon } from "../icons";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Collapse from "@material-ui/core/Collapse";
import grey from "@material-ui/core/colors/grey";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
  },
  textButton: {
    width: "100%",
    justifyContent: "flex-start",
    padding: theme.spacing(0.25, 0.5),
    fontWeight: 500,
  },
  secondaryAction: {
    right: 0,
  },
  gridItem: {
    marginLeft: -10
  },
  collapseList: {
    flexGrow: 1,
    width: "100%",
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
    float: "right"
  },
  listItemIcon: {
    minWidth: 26
  },
  label: {
    fontWeight: 'inherit',
    color: 'inherit',
  },
  labelRoot: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 0),
  },
  labelIcon: {
    marginRight: theme.spacing(1),
  },
  labelText: {
    fontWeight: 'inherit',
    flexGrow: 1,
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
  }

  function submitIssueClickHandler() {
    const command = {
      action: "musictime.submitAnIssue",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function switchSpotifyHandler() {

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

  function accountClickHandler() {
    setAccountOpen(!accountOpen);
  }

  return (
    <Grid container>
      <Grid item xs={12}>
        <List disablePadding={true} dense={true}>
          <ListItem disableGutters={true} dense={true}>
            <ListItemText primary="Account" secondary={!stateData.registered ? "Manage your account" : stateData.email} />
            <ListItemSecondaryAction classes={{ root: classes.secondaryAction }} onClick={accountClickHandler}>
              <IconButton
                size="small"
                edge="end"
                aria-label="View account info">
                {!stateData.registered ? null : stateData.authType === "github" ? (
                  <GithubIcon fontSize="large"/>
                ) : stateData.authType === "google" ? (
                  <GoogleIcon fontSize="large"/>
                ) : (
                  <EmailIcon fontSize="large"/>
                )}
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Grid>
      <Collapse in={accountOpen} timeout="auto" unmountOnExit>
        <List className={classes.collapseList} disablePadding={true} dense={true}>
          {!props.stateData.spotifyUser && (
            <ListItem disableGutters={true} dense={true} button onClick={connectSpotifyHandler}>
              <ListItemIcon className={classes.listItemIcon}>
                <SpotifyIcon fontSize="large"/>
              </ListItemIcon>
              <ListItemText id="spotify-connect-li" primary="Connect Spotify"
                classes={{primary: classes.primaryListText}}/>
            </ListItem>
          )}
          {props.stateData.spotifyUser && (
            <Grid container
              justify="space-between"
              alignItems="center">
              <Grid item xs={10}>
                <div className={classes.labelRoot}>
                  <SpotifyIcon fontSize="large"/>
                  <Typography>
                    {props.stateData.spotifyUser.email}
                  </Typography>
                </div>
              </Grid>
              <Grid item xs={2} className={classes.secondaryListText}>
                {(props.stateData.spotifyUser?.product === "premium" ? "Premium" : "Open")}
              </Grid>
            </Grid>
          )}

          {props.stateData.spotifyUser && (
            <ListItem disableGutters={true} dense={true} button onClick={switchSpotifyHandler}>
              <ListItemIcon className={classes.listItemIcon}>
                <MuiSyncIcon/>
              </ListItemIcon>
              <ListItemText id="spotify-switch-li" primary="Switch spotify account"
                classes={{primary: classes.primaryListText}}/>
            </ListItem>
          )}

          <ListItem disableGutters={true} dense={true} button onClick={documentationClickHandler}>
            <ListItemIcon className={classes.listItemIcon}>
              <DocumentIcon fontSize="large"/>
            </ListItemIcon>
            <ListItemText id="documentation-li" primary="Documentation"
              classes={{primary: classes.primaryListText}}/>
          </ListItem>

          <ListItem disableGutters={true} dense={true} button onClick={submitIssueClickHandler}>
            <ListItemIcon className={classes.listItemIcon}>
              <MessageIcon fontSize="large"/>
            </ListItemIcon>
            <ListItemText id="submit-issue-li" primary="Submit an issue"
              classes={{primary: classes.primaryListText}}/>
          </ListItem>

        </List>
      </Collapse>
    </Grid>
  );
}
