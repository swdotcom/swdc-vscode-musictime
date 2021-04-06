import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import PlaylistItemNode from "./playlist_item_node"
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import { BeakerIcon, SearchIcon, FilterIcon } from "../icons";
import CircularProgress from "@material-ui/core/CircularProgress";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    marginLeft: -4,
    overflowX: "hidden",
    background: "transparent"
  },
  cardHeader: {
    margin: 0,
    padding: 2
  },
  cardHeaderIcon: {
    marginTop: 10,
    marginRight: 10
  },
  loadingIcon: {
    marginTop: 80,
    display: "flex",
    justifyContent: "center",
    textAlign: "center"
  },
  headerActionButtons: {
    marginTop: 10,
    marginRight: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    "& > *": {
      margin: theme.spacing(1),
    }
  }
}));

export default function Recommendations(props) {
  const classes = useStyles();

  function moodSelectionClick() {
    const command = {
      action: "musictime.songMoodSelector",
      command: "command_execute"
    };
    props.vscode.postMessage(command);
  }

  function searchClick() {
    const command = {
      action: "musictime.searchTracks",
      command: "command_execute"
    };
    props.vscode.postMessage(command);
  }

  function genreSelectionClick() {
    const command = {
      action: "musictime.songGenreSelector",
      command: "command_execute"
    };
    props.vscode.postMessage(command);
  }

  return (
    <Card className={classes.root}>
      <CardHeader
        title={(props.stateData.recommendationInfo) ? props.stateData.recommendationInfo.label : "Recommendations"}
        className={classes.cardHeader}
        action={
          <div className={classes.headerActionButtons}>
          <ButtonGroup variant="text" color="primary" aria-label="text primary button group">
            <Button onClick={searchClick}><SearchIcon /></Button>
            <Button onClick={moodSelectionClick}><BeakerIcon /></Button>
            <Button onClick={genreSelectionClick}><FilterIcon /></Button>
          </ButtonGroup>
          </div>
        }/>
      <Grid container>
			  <Grid item xs={12}>
        {props.stateData.recommendationInfo && props.stateData.recommendationInfo.tracks?.length
          ? (
            props.stateData.recommendationInfo.tracks.map((item, index) => {
            return (<PlaylistItemNode vscode={props.vscode} item={item} key={item.id}/>)
            }))
          : !props.stateData.recommendationInfo
            ? (<div className={classes.loadingIcon}><CircularProgress disableShrink /></div>)
            : (<Typography>No tracks available</Typography>)}
        </Grid>
      </Grid>
    </Card>
  );
}
