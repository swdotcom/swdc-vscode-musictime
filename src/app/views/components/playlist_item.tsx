import React from "react";
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import TreeItem from "@material-ui/lab/TreeItem";
import PlaylistItemNode from "./playlist_item_node";
import Typography from "@material-ui/core/Typography";
import Paper from "@material-ui/core/Paper";
import Link from "@material-ui/core/Link";
import { orange } from "@material-ui/core/colors";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
      margin: 0,
      padding: 0,
    },
    loading: {
      padding: theme.spacing(2),
    },
    loadingIcon: {
      display: "flex",
      justifyContent: "center",
      textAlign: "center",
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
  })
);

export default function PlaylistItem(props) {
  const classes = useStyles();

  function refreshClick() {
    const command = {
      action: "musictime.updateSelectedTabView",
      command: "command_execute",
      arguments: ["playlists"],
    };
    props.vscode.postMessage(command);
  }

  return (
    <TreeItem
      nodeId={props.playlistItem.id}
      className={classes.root}
      label={<PlaylistItemNode spotifyPlayerContext={props.spotifyPlayerContext} vscode={props.vscode} item={props.playlistItem} />}
    >
      {props.playlistTracks && props.playlistTracks.length ? (
        props.playlistTracks.map((item, index) => {
          if (item.track) {
            // it's a software top 40 track item
            return (
              <PlaylistItemNode
                spotifyPlayerContext={props.spotifyPlayerContext}
                vscode={props.vscode}
                item={item.track}
                key={`track_${item.track.id}_${item.playlist_id}`}
              />
            );
          } else {
            return (
              <PlaylistItemNode spotifyPlayerContext={props.spotifyPlayerContext} vscode={props.vscode} item={item} key={`playlist_${item.id}`} />
            );
          }
        })
      ) : !props.playlistTracks ? (
        <Typography className={classes.loading}>Loading tracks...</Typography>
      ) : (
        <Paper className={classes.paperContent} elevation={0}>
          <Typography className={classes.setupDescription}>No tracks available. You can try again or check back later.</Typography>
          <Link href="#" onClick={refreshClick} className={classes.link}>
            Refresh
          </Link>
        </Paper>
      )}
    </TreeItem>
  );
}
