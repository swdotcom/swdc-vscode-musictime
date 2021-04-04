import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import PlaylistItem from "./playlist_item";
import TreeView from "@material-ui/lab/TreeView";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import ArrowRightIcon from "@material-ui/icons/ArrowRight";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Divider from "@material-ui/core/Divider";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    flexGrow: 1,
    marginLeft: -4,
    overflowX: "hidden",
    background: "transparent"
  },
  cardHeader: {
    padding: 0,
    marginBottom: 4
  }
}));

let playlistTracks = {};

export default function Playlists(props) {
  const classes = useStyles();

  playlistTracks = props.stateData.playlistTracks;
  playlistTracks[props.stateData.likedSongsPlaylist.id] = props.stateData.likedSongsTracks;

  async function onTreeNodeToggle(event, nodeIds: string[]) {
    if (nodeIds?.length) {
      // get the 1st one. the list is built up
      const playlist_id = nodeIds[0];

      const val = playlistTracks[playlist_id];

      if (!val) {
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
    <Card className={classes.root}>
      <CardHeader title="Recommendations" className={classes.cardHeader}/>

      <TreeView
        onNodeToggle={onTreeNodeToggle}
        aria-label="gmail"
        defaultExpanded={props.stateData.selectedPlaylistId ? [props.stateData.selectedPlaylistId] : []}
        className={classes.root}
        disableSelection={true}
        defaultCollapseIcon={<ArrowDropDownIcon />}
        defaultExpandIcon={<ArrowRightIcon />}>

        <PlaylistItem vscode={props.vscode}
              playlistItem={props.stateData.likedSongsPlaylist}
              key={props.stateData.likedSongsPlaylist.id}
              playlistTracks={props.stateData.playlistTracks[props.stateData.likedSongsPlaylist.id]}/>

        <Divider />

        {props.stateData.spotifyPlaylists ? (
          props.stateData.spotifyPlaylists.map((item, index) => {
            return (<PlaylistItem vscode={props.vscode}
              playlistItem={item}
              key={index}
              playlistTracks={props.stateData.playlistTracks[item.id]}/>)
          })) : (null)}
      </TreeView>
    </Card>
  );
}
