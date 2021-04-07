import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import PlaylistItem from "./playlist_item";
import TreeView from "@material-ui/lab/TreeView";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import ArrowRightIcon from "@material-ui/icons/ArrowRight";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Tooltip from "@material-ui/core/Tooltip";
import Divider from "@material-ui/core/Divider";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import { indigo } from "@material-ui/core/colors";
import { SearchIcon } from "../icons";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    overflowX: "hidden",
    background: "transparent",
  },
  cardHeader: {
    margin: 0,
    padding: 2,
  },
  cardHeaderText: {
    color: indigo[300],
    fontWeight: 500,
  },
  cardHeaderIcon: {
    marginTop: 10,
    marginRight: 10,
  },
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
          arguments: [playlist_id],
        };
        props.vscode.postMessage(command);
      }
    }
  }

  function searchSongs() {
    const command = {
      action: "musictime.searchTracks",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  return (
    <Card className={classes.root}>
      <CardHeader
        className={classes.cardHeader}
        title={
          <Typography noWrap gutterBottom={false} className={classes.cardHeaderText}>
            Playlists
          </Typography>
        }
        action={
          <Tooltip title="Search Spotify">
            <IconButton aria-label="settings" className={classes.cardHeaderIcon} onClick={searchSongs}>
              <SearchIcon />
            </IconButton>
          </Tooltip>
        }
      />
      {props.stateData.spotifyPlaylists && (
        <TreeView
          onNodeToggle={onTreeNodeToggle}
          aria-label="gmail"
          defaultExpanded={props.stateData.selectedPlaylistId ? [props.stateData.selectedPlaylistId] : []}
          className={classes.root}
          disableSelection={true}
          defaultCollapseIcon={<ArrowDropDownIcon />}
          defaultExpandIcon={<ArrowRightIcon />}
        >
          <PlaylistItem
            vscode={props.vscode}
            playlistItem={props.stateData.likedSongsPlaylist}
            key={props.stateData.likedSongsPlaylist.id}
            playlistTracks={props.stateData.playlistTracks[props.stateData.likedSongsPlaylist.id]}
          />

          <Divider />

          {props.stateData.spotifyPlaylists.map((item, index) => {
            return <PlaylistItem vscode={props.vscode} playlistItem={item} key={index} playlistTracks={props.stateData.playlistTracks[item.id]} />;
          })}
        </TreeView>
      )}
    </Card>
  );
}
