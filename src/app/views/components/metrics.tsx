import React, { useState } from "react";
import PropTypes from "prop-types";
import { makeStyles, withStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import MetricItemNode from "./metric_item_node";
import Typography from "@material-ui/core/Typography";
import MetricsSetup from "./metrics_setup";
import { grey, orange, deepPurple } from "@material-ui/core/colors";
import FormGroup from '@material-ui/core/FormGroup';
import Switch from '@material-ui/core/Switch';
import Grid from '@material-ui/core/Grid';
import Box from "@material-ui/core/Box";
import Link from "@material-ui/core/Link";
import Paper from "@material-ui/core/Paper";
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
    cardHeaderIcon: {
      marginTop: 10,
      marginRight: 10,
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

const AntSwitch = withStyles((theme) => ({
  root: {
    width: 28,
    height: 16,
    padding: 0,
    display: 'flex',
  },
  switchBase: {
    padding: 2,
    color: theme.palette.grey[500],
    '&$checked': {
      transform: 'translateX(12px)',
      color: theme.palette.common.white,
      '& + $track': {
        opacity: 1,
        backgroundColor: theme.palette.primary.main,
        borderColor: theme.palette.primary.main,
      },
    },
  },
  thumb: {
    width: 12,
    height: 12,
    boxShadow: 'none',
  },
  track: {
    border: `1px solid ${theme.palette.grey[500]}`,
    borderRadius: 16 / 2,
    opacity: 1,
    backgroundColor: theme.palette.common.white,
  },
  checked: {},
}))(Switch);

export default function Metrics(props) {
  const classes = useStyles();
  const [tabView, setTabView] = useState(0);
  const [state, setState] = useState({
    userChecked: true,
  });
  const [songMetrics, setSongMetrics] = useState(props.stateData.userMusicMetrics);
  const [liveAudioFeatures, setLiveAudioFeatures] = useState(props.stateData.averageMusicMetrics);

  const handleChange = (event) => {
    if (!event.target.checked) {
      setSongMetrics(props.stateData.globalMusicMetrics);
    } else {
      setSongMetrics(props.stateData.userMusicMetrics);
    }

    setState({ ...state, [event.target.name]: event.target.checked });
  };

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
              <FormGroup>
                <Typography component="div">
                  <Grid component="label" container alignItems="center" spacing={1}>
                    <Grid item xs={5} style={{marginRight: 2}}>Global</Grid>
                    <Grid item xs={4}>
                      <AntSwitch checked={state.userChecked} onChange={handleChange} name="userChecked" />
                    </Grid>
                    <Grid item xs={2} style={{color: deepPurple[300] }}>You</Grid>
                  </Grid>
                </Typography>
              </FormGroup>
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
