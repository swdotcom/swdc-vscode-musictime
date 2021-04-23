import React from "react";
import { makeStyles, createStyles, withStyles, Theme } from "@material-ui/core/styles";
import LinearProgress from "@material-ui/core/LinearProgress";
import Paper from "@material-ui/core/Paper";
import CardContent from "@material-ui/core/CardContent";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import Tooltip from "@material-ui/core/Tooltip";
import IconButton from "@material-ui/core/IconButton";
import { MuiRefreshIcon } from "../icons";
import { deepPurple, grey, blue } from "@material-ui/core/colors";

const useStyles = makeStyles((theme) => ({
  root: {
    margin: 0,
    borderRadius: 0,
    background: "linear-gradient(#7e57c2, #311b92)",
  },
  setup: {
    width: "100%",
    backgroundColor: "transparent",
  },
  setupHeader: {
    color: "#FFF",
    display: "flex",
  },
  setupButtonContent: {
    textAlign: "center",
  },
  setupButton: {
    backgroundColor: "#ffffff",
    color: deepPurple[600],
    maxWidth: 200,
  },
  subInfo: {
    marginRight: 4,
    fontSize: 12,
    color: grey[200],
    display: "inline",
  },
  link: {
    display: "inline",
    fontSize: 14,
    color: "#ffffff",
    background: "transparent",
    textDecoration: "none",
    "&:hover": {
      fontSize: 14,
      color: "rgb(255, 255, 255, 0.8)",
      textDecoration: "none",
    },
  },
}));

const BorderLinearProgress = withStyles((theme: Theme) =>
  createStyles({
    root: {
      height: 5,
      borderRadius: 4,
    },
    colorPrimary: {
      backgroundColor: blue[200],
    },
    bar: {
      borderRadius: 4,
      backgroundColor: deepPurple[200],
    },
  })
)(LinearProgress);

export default function Setup(props) {
  const classes = useStyles();
  const stateData = props.stateData;

  const progress = !stateData.registered ? 35 : 70;

  function setupClickHandler() {
    const command = {
      action: !stateData.registered ? "musictime.signUpAccount" : "musictime.connectSpotify",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function loginClickHandler() {
    const command = {
      action: "musictime.logInAccount",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function refreshHandler() {
    const command = {
      action: "musictime.refreshMusicTimeView",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  return (
    <Grid container className={classes.root}>
      <Grid item xs={12}>
        <Paper className={classes.setup} elevation={0}>
          <CardContent className={classes.setupHeader}>
            <Typography>Getting Started with Music Time</Typography>
            <Box style={{ position: "absolute", right: 16, top: 0 }}>
              <Tooltip title="Already registered or logged in? Refresh">
                <IconButton edge="end" onClick={refreshHandler}>
                  <MuiRefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </CardContent>
          <CardContent>
            <BorderLinearProgress variant="determinate" value={progress} />
          </CardContent>
          <CardContent className={classes.setupButtonContent}>
            <Button variant="contained" onClick={setupClickHandler} className={classes.setupButton}>
              {!stateData.registered ? "Register your account" : "Connect Spotify"}
            </Button>
          </CardContent>
          {!stateData.registered && (
            <CardContent>
              <Typography className={classes.subInfo}>Already have a software account?</Typography>
              <Link href="#" onClick={loginClickHandler} className={classes.link}>
                Log in
              </Link>
            </CardContent>
          )}
          {stateData.registered && (
            <CardContent>
              <Typography className={classes.subInfo}>Already connected Spotify?</Typography>
              <Link href="#" onClick={refreshHandler} className={classes.link}>
                Refresh
              </Link>
            </CardContent>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}
