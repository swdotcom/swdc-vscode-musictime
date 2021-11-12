import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import MetricItemNode from "./metric_item_node";
import Typography from "@material-ui/core/Typography";
import MetricsSetup from "./metrics_setup";
import { grey, orange } from "@material-ui/core/colors";
import Box from "@material-ui/core/Box";
import Link from "@material-ui/core/Link";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import IconButton from "@material-ui/core/IconButton";
import { MuiPlayCircleOutlineIcon } from "../icons";
import MetricAudioDashboard from "./metric_audio_dashboard";

const useStyles = makeStyles((theme) => {
  return {
    root: {
      width: "100%",
      height: "100%",
      flexGrow: 1,
      overflowX: "hidden",
      background: "transparent",
      marginBottom: 5,
    },
    cardHeader: {
      margin: 0,
      padding: 2,
    },
    cardHeaderText: {
      fontWeight: 500,
    },
    descriptionText: {
      color: "#919EAB",
      fontWeight: 400,
      fontSize: 11,
    },
    resetFeaturesText: {
      fontWeight: 300,
      color: grey[500],
      fontSize: 12,
    },
    headerActionButtons: {
      marginTop: 10,
      marginRight: 10,
      paddingRight: 4
    },
    paperContent: {
      background: "transparent",
      justifyContent: "center",
      textAlign: "center",
      paddingTop: 20
    },
    setupDescription: {
      display: "inline",
    },
    link: {
      paddingLeft: 3,
      background: "transparent",
      textDecoration: "none",
      display: "inline",
      "&:hover": {
        color: orange[500],
        textDecoration: "none",
      },
    },
  };
});

let origAudioFeatures = undefined;

export default function Metrics(props) {
  const classes = useStyles();
  const [metricsType, setMetricsType] = useState(props.stateData.metricsTypeSelected);

  let metrics = [];
  if (props.stateData.metricsTypeSelected === 'you') {
    metrics = props.stateData.userMusicMetrics;
  } else if (props.stateData.metricsTypeSelected === 'global') {
    metrics = props.stateData.globalMusicMetrics;
  } else {
    metrics = props.stateData.audioFeatures;
  }

  const [songMetrics, setSongMetrics] = useState(metrics);
  const [liveAudioFeatures, setLiveAudioFeatures] = useState(props.stateData.averageMusicMetrics);

  function handleMetricsToggle(value) {
    setMetricsType(value);
    updateUserMetricsSelection(value);
    if (value === 'you') {
      setSongMetrics(props.stateData.userMusicMetrics);
    } else if (value === 'global') {
      setSongMetrics(props.stateData.globalMusicMetrics);
    }
  }

  if (!origAudioFeatures) {
    origAudioFeatures = { ...props.stateData.averageMusicMetrics };
  }

  function resetAudioFeaturesHandler() {
    setLiveAudioFeatures(origAudioFeatures);
  }

  function refreshClick() {
    const command = {
      action: "musictime.updateSelectedTabView",
      command: "command_execute",
      arguments: ["metrics"],
    };
    props.vscode.postMessage(command);
  }

  function updateUserMetricsSelection(value) {
    const command = {
      action: "musictime.updateMetricSelection",
      command: "command_execute",
      arguments: [value],
    };
    props.vscode.postMessage(command);
  }

  function playPlaylist() {
    const command = {
      action: "musictime.playPlaylist",
      command: "command_execute",
      arguments: [songMetrics],
    };
    props.vscode.postMessage(command);
  }

  return (
    <Card className={classes.root} elevation={0}>
      {props.stateData.codeTimeInstalled && (
        <CardHeader
          className={classes.cardHeader}
          title={
            <div style={{ display: 'inline-flex' }}>
              <div>
                <IconButton onClick={playPlaylist} style={{minWidth: "28px"}}>
                  <MuiPlayCircleOutlineIcon />
                </IconButton>
              </div>
              <div style={{ alignSelf: 'center' }}>
                <Typography noWrap gutterBottom={false} className={classes.cardHeaderText}>
                Metrics
                </Typography>
              </div>
            </div>
          }
          action={
            <div className={classes.headerActionButtons}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                <ButtonGroup size="small" variant="outlined"
                  aria-label="You vs. global playlist metrics">
                  {[
                    <Button
                      key="you_metrics"
                      color={metricsType === 'you' ? "primary" : "default"}
                      variant={metricsType === 'you' ? "contained" : "outlined"}
                      onClick={()=>handleMetricsToggle('you')}>
                      You
                    </Button>,
                    <Button
                      key="global_metrics"
                      value="global"
                      color={metricsType === 'global' ? "primary" : "default"}
                      variant={metricsType === 'global' ? "contained" : "outlined"}
                      onClick={()=>handleMetricsToggle('global')}>
                      Global
                    </Button>,
                    <Button
                      key="audio_features"
                      value="features"
                      color={metricsType === 'features' ? "primary" : "default"}
                      variant={metricsType === 'features' ? "contained" : "outlined"}
                      onClick={()=>handleMetricsToggle('features')}>
                      Audio
                    </Button>
                  ]}
                </ButtonGroup>
              </Box>
            </div>
          }
        />
      )}

      {props.stateData.codeTimeInstalled ? (
        <div style={{ marginBottom: 100 }}>
          <Typography className={classes.descriptionText}>
            As you listen to music while you code, Music Time ranks your top songs by comparing your coding metrics with your listening history.
          </Typography>
          {metricsType === 'features' ? (
            <MetricAudioDashboard
              vscode={props.vscode}
              stateData={props.stateData}
              audioFeatures={liveAudioFeatures}
              resetAudioFeatures={resetAudioFeaturesHandler}
            />
          ) : (
            songMetrics?.length ? (
              songMetrics.map((item, index) => {
                return <MetricItemNode
                        key={`metric-item-node-idx-${index}`}
                        vscode={props.vscode}
                        stateData={props.stateData}
                        item={item} />;
              })
            ) : !songMetrics ? (
              <Typography>Loading metrics...</Typography>
            ) : (
              <Paper className={classes.paperContent} elevation={0}>
                <Typography className={classes.setupDescription}>No data available yet. You can try again or check back later.</Typography>
                <Link href="#" onClick={refreshClick} className={classes.link}>
                  Refresh
                </Link>
              </Paper>
            )
          )}
        </div>
      ) : (
        <MetricsSetup vscode={props.vscode} stateData={props.stateData} />
      )}
    </Card>
  );
}
