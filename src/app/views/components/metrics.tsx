import React, { useState }  from "react";
import clsx from "clsx";
import PropTypes from "prop-types";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import MetricItemNode from "./metric_item_node"
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import MetricsSetup from "./metrics_setup";
import { MuiTuneIcon, MuiEmojiEventsIcon } from "../icons";
import { indigo } from "@material-ui/core/colors";
import Tooltip from "@material-ui/core/Tooltip";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import MetricAudioDashboard from "./metric_audio_dashboard";
import { fade } from "@material-ui/core/styles/colorManipulator";

const useStyles = makeStyles((theme) => {
  const selectedBg = fade(theme.palette.text.primary, theme.palette.action.hoverOpacity);
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
      padding: theme.spacing(1)
    },
    cardHeaderText: {
      color: indigo[300],
      fontWeight: 500,
    },
    cardHeaderIcon: {
      marginTop: 10,
      marginRight: 10
    },
    headerActionButtons: {
      marginTop: 10,
      marginRight: 10
    },
    selected: {
      backgroundColor: selectedBg
    }
  }
});

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
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

export default function Metrics(props) {
  const classes = useStyles();
  const [tabView, setTabView] = useState(0);

  function showRanking() {
    setTabView(0);
  }

  function showDashboard() {
    setTabView(1);
  }

  const rankingButtonClass = clsx({
    [classes.selected]: tabView === 0
  });

  const dashboardButtonClass = clsx({
    [classes.selected]: tabView === 1
  });

  return (
    <Card className={classes.root} elevation={0}>
      {props.stateData.codeTimeInstalled && (
        <CardHeader className={classes.cardHeader}
          title={
            <Typography noWrap gutterBottom={false} className={classes.cardHeaderText}>
              Code + Music
            </Typography>
          }
          action={
            <div className={classes.headerActionButtons}>
              <ButtonGroup variant="text">
                <Tooltip title="Ranking">
                  <Button onClick={showRanking} className={rankingButtonClass}>
                    <MuiEmojiEventsIcon/>
                  </Button>
                </Tooltip>
                <Tooltip title="Dashboard" className={dashboardButtonClass}>
                  <Button onClick={showDashboard}><MuiTuneIcon/></Button>
                </Tooltip>
              </ButtonGroup>
            </div>
          }/>)}

      {props.stateData.codeTimeInstalled ? (
        <div>
          {tabView === 0 ? (
            <Grid container>
              <Grid item xs={12}>
              {props.stateData.userMusicMetrics && props.stateData.userMusicMetrics.length
                ? (
                  props.stateData.userMusicMetrics.map((item, index) => {
                  return (<MetricItemNode vscode={props.vscode} stateData={props.stateData} item={item} key={item.id}/>)
                  }))
                : !props.stateData.userMusicMetrics
                  ? (<Typography>Loading metrics...</Typography>)
                  : (<Typography>No metrics available</Typography>)}
              </Grid>
            </Grid>)
            : (<Grid container>
                <Grid item xs={12}>
                  <MetricAudioDashboard vscode={props.vscode} stateData={props.stateData} />
                </Grid>
              </Grid>)}
          </div>)
        : (
          <Grid container>
            <Grid item xs={12}>
              <MetricsSetup  vscode={props.vscode} stateData={props.stateData}/>
            </Grid>
          </Grid>)}
    </Card>
  );
}
