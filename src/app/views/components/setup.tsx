import React from "react";
import { makeStyles, createStyles, withStyles, Theme } from "@material-ui/core/styles";
import LinearProgress from "@material-ui/core/LinearProgress";
import Paper from "@material-ui/core/Paper";
import CardContent from "@material-ui/core/CardContent";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import blue from "@material-ui/core/colors/blue";
import grey from "@material-ui/core/colors/grey";

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
    justifyContent: "center",
    textAlign: "center",
  },
  setupButtonContent: {
    textAlign: "center",
  },
  setupButton: {
    backgroundColor: "#ffffff",
    color: blue[500],
    maxWidth: 200,
  },
  linkContent: {
    textAlign: "center",
  },
  subInfo: {
    marginRight: 4,
    fontSize: 12,
    color: grey[200],
    display: "block",
  },
  link: {
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
      backgroundColor: "#ffffff",
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

  return (
    <Grid container className={classes.root}>
      <Grid item xs={12}>
        <Paper className={classes.setup} elevation={0}>
          <CardContent className={classes.setupHeader}>
            <Typography>Getting Started with Music Time</Typography>
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
            <CardContent className={classes.linkContent}>
              <Typography className={classes.subInfo} display="inline">
                Already have a software account?
              </Typography>
              <Link href="#" onClick={loginClickHandler} display="inline" className={classes.link}>
                Log in
              </Link>
            </CardContent>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}
