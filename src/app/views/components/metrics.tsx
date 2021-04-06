import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import MetricItemNode from "./metric_item_node"
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    marginLeft: -4,
    overflowX: "hidden",
    background: "transparent"
  }
}));

export default function Metrics(props) {
  const classes = useStyles();

  return (
    <Card className={classes.root}>
      <CardHeader title="Metrics"/>
      <Grid container>
			  <Grid item xs={12}>
        {props.stateData.userMusicMetrics && props.stateData.userMusicMetrics.length
          ? (
            props.stateData.userMusicMetrics.map((item, index) => {
            return (<MetricItemNode vscode={props.vscode} item={item} key={item.id}/>)
            }))
          : !props.stateData.userMusicMetrics
            ? (<Typography>Loading metrics...</Typography>)
            : (<Typography>No metrics available</Typography>)}
        </Grid>
      </Grid>
    </Card>
  );
}
