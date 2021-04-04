import React from "react";
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import TreeItem from "@material-ui/lab/TreeItem";
import PlaylistItemNode from "./playlist_item_node";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: "100%"
    }
  })
);

export default function PlaylistItem(props) {
  const classes = useStyles();

  return (
		<TreeItem
      nodeId={props.playlistItem.id}
      className={classes.root}
      label={<PlaylistItemNode vscode={props.vscode} item={props.playlistItem}/>}>
			{props.playlistTracks && props.playlistTracks.length
        ? (
          props.playlistTracks.map((item, index) => {
          return (<PlaylistItemNode vscode={props.vscode} item={item} key={item.id}/>)
          }))
        : !props.playlistTracks
          ? (<TreeItem nodeId={`${props.playlistItem.id}_track_placeholder`} label="Loading tracks..."/>)
          : (<TreeItem nodeId={`${props.playlistItem.id}_track_placeholder`} label="No track available"/>)}
		</TreeItem>
  );
}
