import React, { useState }  from "react";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import MetricItemNode from "./metric_item_node"
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import MetricsSetup from "./metrics_setup";
import { MuiTuneIcon } from "../icons";
import { indigo } from "@material-ui/core/colors";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    margin: 0,
    padding: 0,
    overflowX: "hidden",
    background: "transparent"
  },
  cardHeader: {
    margin: 0,
    padding: 2
  },
  cardHeaderText: {
    color: indigo[300],
    fontWeight: 500,
  },
  cardHeaderIcon: {
    marginTop: 10,
    marginRight: 10
  }
}));

export default function Metrics(props) {
  const classes = useStyles();

  let [controlsOpen, setControlsOpen] = useState(false);

  function toggleControls() {
    setControlsOpen(!controlsOpen);
  }

  return (
    <Card className={classes.root}>
      {props.stateData.codeTimeInstalled && (<CardHeader className={classes.cardHeader}
        title={
          <Typography noWrap gutterBottom={false} className={classes.cardHeaderText}>
            Code + Music
          </Typography>
        }
        action={
          <IconButton aria-label="settings" className={classes.cardHeaderIcon}
            onClick={toggleControls}>
            <MuiTuneIcon />
          </IconButton>
        }/>)}

      <Grid container className={classes.root}>
        {props.stateData.codeTimeInstalled
          ? (<Grid item xs={12} style={{margin: 0, padding: 0}}>
            {props.stateData.userMusicMetrics && props.stateData.userMusicMetrics.length
              ? (
                props.stateData.userMusicMetrics.map((item, index) => {
                return (<MetricItemNode  vscode={props.vscode} stateData={props.stateData} item={item} key={item.id}/>)
                }))
              : !props.stateData.userMusicMetrics
                ? (<Typography>Loading metrics...</Typography>)
                : (<Typography>No metrics available</Typography>)}
            </Grid>)
          : (<Grid item xs={12}>
              <MetricsSetup  vscode={props.vscode} stateData={props.stateData}/>
            </Grid>)}

      </Grid>
    </Card>
  );
}
