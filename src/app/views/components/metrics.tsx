import React, { useState } from "react";
import PropTypes from "prop-types";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import MetricItemNode from "./metric_item_node";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import MetricsSetup from "./metrics_setup";
import { MuiTuneIcon, MuiEmojiEventsIcon } from "../icons";
import { indigo, grey } from "@material-ui/core/colors";
import Tooltip from "@material-ui/core/Tooltip";
import IconButton from "@material-ui/core/IconButton";
import Box from "@material-ui/core/Box";
import MetricAudioDashboard from "./metric_audio_dashboard";

const useStyles = makeStyles((theme) => {
  return {
    root: {
      width: "100%",
      height: "100%",
      flexGrow: 1,
      padding: 0,
      margin: 0,
      background: "transparent",
    },
    cardHeader: {
      margin: 0,
      padding: 2,
    },
    cardHeaderText: {
      color: indigo[300],
      fontWeight: 500,
    },
    resetFeaturesText: {
      fontWeight: 300,
      color: grey[500],
      fontSize: 12,
    },
    cardHeaderIcon: {
      marginTop: 10,
      marginRight: 10,
    },
    headerActionButtons: {
      marginTop: 10,
      marginRight: 10,
    },
  };
});

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div role="tabpanel" hidden={value !== index} id={`simple-tabpanel-${index}`} aria-labelledby={`simple-tab-${index}`} {...other}>
      {value === index && (
        <Box p={3}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.any.isRequired,
  value: PropTypes.any.isRequired,
};

let origAudioFeatures = undefined;

export default function Metrics(props) {
  const classes = useStyles();
  const [tabView, setTabView] = useState(0);

  if (!origAudioFeatures) {
    origAudioFeatures = { ...props.stateData.averageMusicMetrics };
  }
  const [liveAudioFeatures, setLiveAudioFeatures] = useState(props.stateData.averageMusicMetrics);

  function showRanking() {
    setTabView(0);
  }

  function showDashboard() {
    setTabView(1);
  }

  function resetAudioFeaturesHandler() {
    setLiveAudioFeatures(origAudioFeatures);
    setTabView(3);
    setTimeout(() => {
      setTabView(1);
    }, 2000);
  }

  return (
    <Card className={classes.root} elevation={0}>
      {props.stateData.codeTimeInstalled && (
        <CardHeader
          className={classes.cardHeader}
          title={
            <Typography noWrap gutterBottom={false} className={classes.cardHeaderText}>
              Metrics
            </Typography>
          }
          action={
            <div className={classes.headerActionButtons}>
              <Tooltip title="Your productivity ranking">
                <IconButton onClick={showRanking}>
                  <MuiEmojiEventsIcon color={tabView === 0 ? "primary" : "disabled"} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Your audio feature averages">
                <IconButton onClick={showDashboard}>
                  <MuiTuneIcon color={tabView === 1 ? "primary" : "disabled"} />
                </IconButton>
              </Tooltip>
            </div>
          }
        />
      )}

      {props.stateData.codeTimeInstalled ? (
        <div>
          {tabView === 0 ? (
            <Grid container>
              <Grid item key={`metrics-grid-time-metrics-container`} xs={12}>
                {props.stateData.userMusicMetrics && props.stateData.userMusicMetrics.length ? (
                  props.stateData.userMusicMetrics.map((item, index) => {
                    return <MetricItemNode key={`metric-item-node-idx-${index}`} vscode={props.vscode} stateData={props.stateData} item={item} />;
                  })
                ) : !liveAudioFeatures ? (
                  <Typography>Loading metrics...</Typography>
                ) : (
                  <Typography>No metrics available</Typography>
                )}
              </Grid>
            </Grid>
          ) : tabView === 1 ? (
            <Grid container>
              <Grid item key={`metrics-grid-time-metric-dashboard-container`} xs={12}>
                <MetricAudioDashboard
                  vscode={props.vscode}
                  stateData={props.stateData}
                  audioFeatures={liveAudioFeatures}
                  resetAudioFeatures={resetAudioFeaturesHandler}
                />
              </Grid>
            </Grid>
          ) : (
            <Grid container>
              <Grid item key={`metrics-grid-time-metrics-reset-audio`} xs={12}>
                <Typography className={classes.resetFeaturesText}>Resetting your audio metric averages...</Typography>
              </Grid>
            </Grid>
          )}
        </div>
      ) : (
        <Grid container>
          <Grid item key={`metrics-grid-time-metric-setup-container`} xs={12}>
            <MetricsSetup vscode={props.vscode} stateData={props.stateData} />
          </Grid>
        </Grid>
      )}
    </Card>
  );
}
