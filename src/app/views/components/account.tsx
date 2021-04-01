import React, { useEffect, useState } from "react";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import { makeStyles } from "@material-ui/core/styles";
import AccountCircleIcon from "@material-ui/icons/AccountCircle";
import { GoogleIcon, GithubIcon, EmailIcon } from "../icons";
import { MessageIcon, DocumentIcon, SpotifyIcon } from "../icons";
import deepPurple from "@material-ui/core/colors/deepPurple";
import IconButton from "@material-ui/core/IconButton";
import MonetizationOnIcon from "@material-ui/icons/MonetizationOn";
import Typography from "@material-ui/core/Typography";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Collapse from "@material-ui/core/Collapse";
import SyncIcon from "@material-ui/icons/Sync";
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
    width: "100%",
  },
  collapseListItem: {
    marginLeft: 10,
  },
  secondaryListText: {
    color: grey[500],
    fontWeight: 400
  }
}));

export default function Account(props) {
  useEffect(() => {});
  const classes = useStyles();
  const stateData = props.stateData;

  const [spotifyAccountOpen, setSpotifyAccountOpen] = useState(false);

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

  function spotifyAccountClickHandler() {
    setSpotifyAccountOpen(!spotifyAccountOpen);
  }

  return (
    <Grid container>
      <Grid item xs={12}>
        <List disablePadding={true} dense={true}>
          <ListItem disableGutters={true} dense={true}>
            <ListItemText primary="Software Account" secondary={!stateData.registered ? "Manage your account" : stateData.email} />
            <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
              <div aria-label="Authentication type">
                {!stateData.registered ? null : stateData.authType === "github" ? (
                  <GithubIcon />
                ) : stateData.authType === "google" ? (
                  <GoogleIcon />
                ) : (
                  <EmailIcon />
                )}
              </div>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Grid>
      <Grid container direction="row" justify="space-between" alignItems="flex-start">
        <Grid item xs={11} className={classes.gridItem}>
          <Button onClick={connectSpotifyHandler} classes={{ root: classes.textButton }} startIcon={<SpotifyIcon />}>
            {props.stateData.spotifyUser ? props.stateData.spotifyUser.email : "Connect Spotify"}
          </Button>
        </Grid>
        {props.stateData.spotifyUser && (<Grid item xs={1} style={{ marginRight: 4 }}>
          <IconButton
                size="small"
                style={{ color: deepPurple[300] }}
                aria-label="Spotify Account"
                onClick={spotifyAccountClickHandler}>
            <AccountCircleIcon/>
          </IconButton>
        </Grid>)}

      </Grid>
      <Collapse in={spotifyAccountOpen} timeout="auto" unmountOnExit>
        <List className={classes.collapseList} disablePadding={true} dense={true}>
          <ListItem disableGutters={true} dense={true} className={classes.collapseListItem}>
            <ListItemIcon style={{ minWidth: "30px" }}>
              <MonetizationOnIcon style={{ color: deepPurple[300] }}/>
            </ListItemIcon>
            <ListItemText id="spotify-account-plan"
              primary={props.stateData.spotifyUser?.display_name}/>
            <ListItemSecondaryAction>
              <Typography className={classes.secondaryListText}>
                {(props.stateData.spotifyUser?.product === "premium" ? "Premium plan" : "Open plan")}
              </Typography>
            </ListItemSecondaryAction>
          </ListItem>
          <ListItem disableGutters={true} dense={true} button className={classes.collapseListItem}>
            <ListItemIcon style={{ minWidth: "30px" }}>
              <SyncIcon style={{ color: deepPurple[300] }}/>
            </ListItemIcon>
            <ListItemText id="spotify-account-switch" primary="Switch spotify account"/>
          </ListItem>
        </List>

      </Collapse>
      <Grid item xs={12} className={classes.gridItem}>
        <Button onClick={documentationClickHandler} classes={{ root: classes.textButton }} startIcon={<DocumentIcon />}>
          Documentation
        </Button>
      </Grid>
      <Grid item xs={12} className={classes.gridItem}>
        <Button onClick={submitIssueClickHandler} classes={{ root: classes.textButton }} startIcon={<MessageIcon />}>
          Submit an issue
        </Button>
      </Grid>
    </Grid>
  );
}
