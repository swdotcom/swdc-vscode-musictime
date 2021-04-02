import React from "react";
import TreeItem from "@material-ui/lab/TreeItem";
import PlaylistItemNode from "./playlist_item_node";

export default function PlaylistItem(props) {
  return (
		<TreeItem nodeId={props.playlistItem.id}
      label={<PlaylistItemNode item={props.playlistItem}/>}
		>
			{props.playlistTracks?.length ? (
        props.playlistTracks.map((item, index) => {
          return (<PlaylistItemNode item={item} key={item.id}/>)
        })) : (<TreeItem nodeId={`${props.playlistItem.id}_track_placeholder`} label="Tracks will appear here"/>)}
		</TreeItem>
  );
}
