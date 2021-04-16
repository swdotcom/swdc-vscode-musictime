import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import PlaylistItemNode from "./playlist_item_node";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import { BeakerIcon, MuiSearchIcon, FilterIcon, MuiRefreshIcon } from "../icons";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tooltip from "@material-ui/core/Tooltip";
import { indigo } from "@material-ui/core/colors";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    overflowX: "hidden",
    background: "transparent",
    margin: 0,
  },
  cardHeaderRoot: {
    margin: 0,
    overflow: "hidden",
  },
  cardHeaderContent: {
    overflow: "hidden",
  },
  cardHeaderText: {
    color: indigo[300],
    fontWeight: 500,
  },
  cardHeaderIcon: {
    marginTop: 10,
    marginRight: 10,
  },
  loadingIcon: {
    marginTop: 80,
    display: "flex",
    justifyContent: "center",
    textAlign: "center",
  },
  headerActionButtons: {
    marginTop: 10,
    marginRight: 10,
  },
}));

export default function Recommendations(props) {
  const classes = useStyles();

  function moodSelectionClick() {
    const command = {
      action: "musictime.songMoodSelector",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function searchClick() {
    const command = {
      action: "musictime.searchTracks",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function genreSelectionClick() {
    const command = {
      action: "musictime.songGenreSelector",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function refreshRecommendationsClick() {
    const command = {
      action: "musictime.refreshRecommendations",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  return (
    <Card className={classes.root} elevation={0}>
      <CardHeader
        classes={{
          root: classes.cardHeaderRoot,
          content: classes.cardHeaderContent,
        }}
        title={
          <Typography noWrap gutterBottom={false} className={classes.cardHeaderText}>
            {props.stateData.recommendationInfo ? props.stateData.recommendationInfo.label : "Recommendations"}
          </Typography>
        }
        action={
          <div className={classes.headerActionButtons}>
            <Tooltip title="Search Spotify">
              <IconButton onClick={searchClick}>
                <MuiSearchIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Select a mood">
              <IconButton onClick={moodSelectionClick}>
                <BeakerIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Select a genre">
              <IconButton onClick={genreSelectionClick}>
                <FilterIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh recommendations">
              <IconButton onClick={refreshRecommendationsClick}>
                <MuiRefreshIcon />
              </IconButton>
            </Tooltip>
          </div>
        }
      />
      <Grid container>
        <Grid item xs={12}>
          {props.stateData.recommendationInfo && props.stateData.recommendationInfo.tracks?.length ? (
            props.stateData.recommendationInfo.tracks.map((item, index) => {
              return <PlaylistItemNode vscode={props.vscode} item={item} key={item.id} />;
            })
          ) : !props.stateData.recommendationInfo ? (
            <div className={classes.loadingIcon}>
              <CircularProgress disableShrink />
            </div>
          ) : (
            <Typography>No tracks available</Typography>
          )}
        </Grid>
      </Grid>
    </Card>
  );
}
