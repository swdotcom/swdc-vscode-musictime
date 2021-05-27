import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import PlaylistItemNode from "./playlist_item_node";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import { BeakerIcon, MuiSearchIcon, FilterIcon, MuiRefreshIcon } from "../icons";
import Tooltip from "@material-ui/core/Tooltip";
import { orange } from "@material-ui/core/colors";
import Paper from "@material-ui/core/Paper";
import Link from "@material-ui/core/Link";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    overflowX: "hidden",
    background: "transparent",
    margin: 0,
  },
  cardHeader: {
    margin: 0,
    padding: 2,
  },
  cardHeaderRoot: {
    margin: 0,
    overflow: "hidden",
  },
  cardHeaderContent: {
    overflow: "hidden",
  },
  cardHeaderText: {
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
  paperContent: {
    background: "transparent",
    justifyContent: "center",
    textAlign: "center",
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

  function refreshClick() {
    const command = {
      action: "musictime.updateSelectedTabView",
      command: "command_execute",
      arguments: ["recommendations"],
    };
    props.vscode.postMessage(command);
  }

  return (
    <Card className={classes.root} elevation={0}>
      <CardHeader
        className={classes.cardHeader}
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
            <Typography>Loading recommendations...</Typography>
          ) : (
            <Paper className={classes.paperContent} elevation={0}>
              <Typography className={classes.setupDescription}>No tracks available. You can try again or check back later.</Typography>
              <Link href="#" onClick={refreshClick} className={classes.link}>
                Refresh
              </Link>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Card>
  );
}
