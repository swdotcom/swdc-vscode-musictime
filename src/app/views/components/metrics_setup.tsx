import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import PropTypes from "prop-types";
import CardContent from "@material-ui/core/CardContent";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import MetricsColdStart from "./metrics_cold_start";
import Grid from "@material-ui/core/Grid";
import { orange, grey, deepPurple } from "@material-ui/core/colors";
import Link from "@material-ui/core/Link";
import { DARK_BG_COLOR } from "../../utils/view_constants";

const useStyles = makeStyles((theme) => ({
  root: {
    overflowX: "hidden",
    background: "transparent",
    width: "100%",
    flexGrow: 1,
  },
  cardRoot: {
    background: DARK_BG_COLOR,
    fontSize: 11,
  },
  setupHeader: {
    color: "#ffffff",
    display: "inline",
    fontStyle: "bold",
  },
  setupDescription: {
    color: grey[500],
    fontWeight: 400,
    display: "inline",
  },
  setupDescriptionHighlight: {
    paddingLeft: 6,
    display: "inline",
    color: "#ffffff",
  },
  setupButtonContent: {
    textAlign: "center",
  },
  setupButton: {
    backgroundColor: deepPurple[500],
    color: "#ffffff",
    maxWidth: 200,
    "&:hover": {
      background: deepPurple[400],
    },
  },
  link: {
    paddingLeft: 3,
    color: "#ffffff",
    background: "transparent",
    textDecoration: "none",
    display: "inline",
    "&:hover": {
      color: orange[500],
      textDecoration: "none",
    },
  },
}));

export default function MetricsSetup(props) {
  const classes = useStyles();

  function setupClickHandler() {
    const command = {
      action: "musictime.installCodeTime",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function refreshClick() {
    const command = {
      action: "musictime.refreshMusicTimeView",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  return (
    <Grid container className={classes.root}>
      <Grid item key={`metrics-setup-cold-start-container`} xs={12}>
        <MetricsColdStart vscode={props.vscode} stateData={props.stateData} />
      </Grid>
      <Grid item key={`metrics-setup-getting-started`} xs={12} style={{ padding: 4 }}>
        <Card className={classes.cardRoot}>
          <CardContent>
            <Typography className={classes.setupHeader}>What's your best music for coding?</Typography>
          </CardContent>
          <CardContent>
            <Typography className={classes.setupDescription}>
              See your most productive songs and artists on your coding activity while listening to music.
            </Typography>
          </CardContent>
          <CardContent className={classes.setupButtonContent}>
            <Button variant="contained" onClick={setupClickHandler} className={classes.setupButton}>
              Install Code Time
            </Button>
          </CardContent>
          <CardContent>
            <Typography className={classes.setupDescription}>Trust and data privacy matters.</Typography>
            <Typography className={classes.setupDescriptionHighlight}>Your data is always private</Typography>
          </CardContent>
          <CardContent>
            <Typography className={classes.setupDescription}>Already installed?</Typography>
            <Link href="#" onClick={refreshClick} className={classes.link}>
              Refresh
            </Link>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

MetricsSetup.propTypes = {
  vscode: PropTypes.any.isRequired,
  stateData: PropTypes.any.isRequired,
};
