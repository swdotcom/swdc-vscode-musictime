import React, { useState } from "react";
import PropTypes from "prop-types";
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
  const [showUserMetrics, setShowUserMetrics] = useState(props.stateData.userMetricsSelected);
  const metrics = props.stateData.userMetricsSelected ? props.stateData.userMusicMetrics: props.stateData.globalMusicMetrics;
  const [songMetrics, setSongMetrics] = useState(metrics);
  const [liveAudioFeatures, setLiveAudioFeatures] = useState(props.stateData.averageMusicMetrics);

  function handleMetricsToggle(value) {
    if (value === 'you') {
      setSongMetrics(props.stateData.userMusicMetrics);
      setShowUserMetrics(true);
      updateUserMetricsSelection(false);
    } else {
      setSongMetrics(props.stateData.globalMusicMetrics);
      setShowUserMetrics(false);
      updateUserMetricsSelection(false);
    }
  }

  if (!origAudioFeatures) {
    origAudioFeatures = { ...props.stateData.averageMusicMetrics };
  }

  // function showRanking() {
  //   setTabView(0);
  // }

  // function showDashboard() {
  //   setTabView(1);
  // }

  function resetAudioFeaturesHandler() {
    setLiveAudioFeatures(origAudioFeatures);
    setTabView(3);
    setTimeout(() => {
      setTabView(1);
    }, 2000);
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
                      color={showUserMetrics ? "primary" : "default"}
                      variant={showUserMetrics ? "contained" : "outlined"}
                      onClick={()=>handleMetricsToggle('you')}>
                      You
                    </Button>,
                    <Button
                      key="global_metrics"
                      value="global"
                      color={showUserMetrics ? "default" : "primary"}
                      variant={showUserMetrics ? "outlined" : "contained"}
                      onClick={()=>handleMetricsToggle('global')}>
                      Global
                    </Button>,
                  ]}
                </ButtonGroup>
              </Box>
              {/* <Tooltip title="Your productivity ranking">
                <IconButton onClick={showRanking}>
                  <MuiEmojiEventsIcon color={tabView === 0 ? "primary" : "disabled"} />
                </IconButton>
              </Tooltip> */}
              {/* <Tooltip title="Your audio feature averages">
                <IconButton onClick={showDashboard}>
                  <MuiTuneIcon color={tabView === 1 ? "primary" : "disabled"} />
                </IconButton>
              </Tooltip> */}
            </div>
          }
        />
      )}

      {props.stateData.codeTimeInstalled ? (
        <div style={{ marginBottom: 100 }}>
          {tabView === 0 ? (
            <>
              <Typography className={classes.descriptionText}>
                As you listen to music while you code, Music Time ranks your top songs by comparing your coding metrics with your listening history.
              </Typography>
              {songMetrics?.length ? (
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
              )}
            </>
          ) : tabView === 1 ? (
            <MetricAudioDashboard
              vscode={props.vscode}
              stateData={props.stateData}
              audioFeatures={liveAudioFeatures}
              resetAudioFeatures={resetAudioFeaturesHandler}
            />
          ) : (
            <Typography className={classes.resetFeaturesText}>Resetting your audio metric averages...</Typography>
          )}
        </div>
      ) : (
        <MetricsSetup vscode={props.vscode} stateData={props.stateData} />
      )}
    </Card>
  );
}
