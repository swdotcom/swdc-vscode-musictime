import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import PlaylistItemNode from "./playlist_item_node"
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

export default function Recommendations(props) {
  const classes = useStyles();

  return (
    <Card className={classes.root}>
      <CardHeader title="Recommendations"/>
      <Grid container>
			  <Grid item xs={12}>
        {props.stateData.recommendationTracks && props.stateData.recommendationTracks.length
          ? (
            props.stateData.recommendationTracks.map((item, index) => {
            return (<PlaylistItemNode vscode={props.vscode} item={item} key={item.id}/>)
            }))
          : !props.stateData.recommendationTracks
            ? (<Typography>Loading tracks...</Typography>)
            : (<Typography>No tracks available</Typography>)}
        </Grid>
      </Grid>
    </Card>
  );
}
