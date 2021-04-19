import React from "react";
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import TreeItem from "@material-ui/lab/TreeItem";
import PlaylistItemNode from "./playlist_item_node";
import Typography from "@material-ui/core/Typography";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
      margin: 0,
      padding: 0,
    },
    loadingIcon: {
      display: "flex",
      justifyContent: "center",
      textAlign: "center",
    },
  })
);

export default function PlaylistItem(props) {
  const classes = useStyles();

  return (
    <TreeItem nodeId={props.playlistItem.id} className={classes.root} label={<PlaylistItemNode vscode={props.vscode} item={props.playlistItem} />}>
      {props.playlistTracks && props.playlistTracks.length ? (
        props.playlistTracks.map((item, index) => {
          if (item.track) {
            // it's a software top 40 track item
            return <PlaylistItemNode vscode={props.vscode} item={item.track} key={`track_${item.track.id}_${item.playlist_id}`} />;
          } else {
            return <PlaylistItemNode vscode={props.vscode} item={item} key={`playlist_${item.id}`} />;
          }
        })
      ) : !props.playlistTracks ? (
        <Typography>Loading tracks...</Typography>
      ) : (
        <TreeItem nodeId={`${props.playlistItem.id}_track_placeholder`} label="No tracks available" />
      )}
    </TreeItem>
  );
}
