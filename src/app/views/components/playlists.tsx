import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import PlaylistItem from "./playlist_item";
import TreeView from "@material-ui/lab/TreeView";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import ArrowRightIcon from "@material-ui/icons/ArrowRight";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    flexGrow: 1,
    marginLeft: -8,
    overflowX: "hidden"
  },
}));

let playlistTracks = {};

export default function Playlists(props) {
  const classes = useStyles();

  playlistTracks = props.stateData.playlistTracks;

  async function onTreeNodeToggle(event, nodeIds: string[]) {
    if (nodeIds?.length) {
      // get the 1st one. the list is built up
      const playlist_id = nodeIds[0];

      if (!playlistTracks[playlist_id]) {
        const command = {
          action: "musictime.fetchPlaylistTracks",
          command: "command_execute",
          arguments: [playlist_id]
        };
        props.vscode.postMessage(command);
      }
    }
  }

  return (
    <TreeView
      onNodeToggle={onTreeNodeToggle}
      aria-label="gmail"
      defaultExpanded={props.stateData.selectedPlaylistId ? [props.stateData.selectedPlaylistId] : []}
      className={classes.root}
      defaultCollapseIcon={<ArrowDropDownIcon />}
      defaultExpandIcon={<ArrowRightIcon />}
    >
      {props.stateData.spotifyPlaylists ? (
        props.stateData.spotifyPlaylists.map((item, index) => {
          return (<PlaylistItem vscode={props.vscode} playlistItem={item} key={index} playlistTracks={props.stateData.playlistTracks[item.id]}/>)
        })) : (null)}
    </TreeView>
  );
}
