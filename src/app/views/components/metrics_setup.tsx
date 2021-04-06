import React from "react";
import { makeStyles, createStyles, withStyles, Theme } from "@material-ui/core/styles";
import LinearProgress from "@material-ui/core/LinearProgress";
import Card from "@material-ui/core/Card";
import PropTypes from "prop-types";
import CardContent from "@material-ui/core/CardContent";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import MetricsColdStart from "./metrics_cold_start";
import Grid from "@material-ui/core/Grid";
import { blue, grey } from "@material-ui/core/colors";

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    width: "100%",
    height: "100"
  },
  setup: {
    width: "100%",
    padding: 0,
    margin: 0,
    background: "linear-gradient(#64b5f6, #1565c0)"
  },
  setupHeader: {
    color: "#FFF",
    display: "flex",
    justifyContent: "center",
    textAlign: "center"
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
	  textAlign: "center"
  },
  subInfo: {
    marginRight: 4,
    fontSize: 12,
    color: grey[200],
	  display: "block"
  }
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

export default function MetricsSetup(props) {
  const classes = useStyles();
  const stateData = props.stateData;

  const progress = !stateData.registered ? 35 : 70;

  function setupClickHandler() {
    const command = {
      action: "musictime.installCodeTime",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  return (
    <Grid container className={classes.root}>
      <Grid item xs={12}>
        <Card className={classes.setup}>
          <CardContent className={classes.setupHeader}>
            <Typography>Getting Started with Code Time</Typography>
          </CardContent>
          <CardContent>
            <BorderLinearProgress variant="determinate" value={progress} />
          </CardContent>
          <CardContent className={classes.setupButtonContent}>
            <Button variant="contained" onClick={setupClickHandler} className={classes.setupButton}>
              Install Code Time
            </Button>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12}>
        <MetricsColdStart vscode={props.vscode} stateData={props.stateData}/>
      </Grid>
    </Grid>
  );
}

MetricsSetup.propTypes = {
	item: PropTypes.any.isRequired,
	vscode: PropTypes.any.isRequired,
	stateData: PropTypes.any.isRequired
};
