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
import { MuiSearchIcon, MuiSortByAlphaIcon } from "../icons";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    overflowX: "hidden",
    background: "transparent",
    marginBottom: 5,
  },
  cardHeader: {
    margin: 0,
    padding: 2,
  },
  cardHeaderText: {
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
    if (nodeIds.length) {
      const command = {
        action: "musictime.updateSelectedPlaylist",
        command: "command_execute",
        arguments: [nodeIds[0]],
      };
      props.vscode.postMessage(command);
    } else {
      const command = {
        action: "musictime.updateSelectedPlaylist",
        command: "command_execute",
      };
      props.vscode.postMessage(command);
    }

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

  function sortPlaylist() {
    const command = {
      action: "musictime.sortIcon",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function searchSongs() {
    const command = {
      action: "musictime.searchTracks",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  return (
    <Card className={classes.root} elevation={0}>
      <CardHeader
        className={classes.cardHeader}
        title={
          <Typography noWrap gutterBottom={false} className={classes.cardHeaderText}>
            Playlists
          </Typography>
        }
        action={
          <div className={classes.cardHeaderIcon}>
            <Tooltip title="Ranking">
              <IconButton onClick={sortPlaylist}>
                <MuiSortByAlphaIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Search Spotify">
              <IconButton onClick={searchSongs}>
                <MuiSearchIcon />
              </IconButton>
            </Tooltip>
          </div>
        }
      />
      {props.stateData.spotifyPlaylists && (
        <TreeView
          onNodeToggle={onTreeNodeToggle}
          aria-label="playlists"
          defaultExpanded={props.stateData.selectedPlaylistId ? [props.stateData.selectedPlaylistId] : []}
          className={classes.root}
          disableSelection={true}
          defaultCollapseIcon={<ArrowDropDownIcon />}
          defaultExpandIcon={<ArrowRightIcon />}
        >
          {props.stateData.softwareTop40Playlist && props.stateData.softwareTop40Playlist.tracks && (
            <PlaylistItem
              vscode={props.vscode}
              spotifyPlayerContext={props.stateData.spotifyPlayerContext}
              playlistItem={props.stateData.softwareTop40Playlist}
              key={props.stateData.softwareTop40Playlist.id}
              playlistTracks={props.stateData.softwareTop40Playlist.tracks.items}
            />
          )}

          <PlaylistItem
            vscode={props.vscode}
            spotifyPlayerContext={props.stateData.spotifyPlayerContext}
            playlistItem={props.stateData.likedSongsPlaylist}
            key={props.stateData.likedSongsPlaylist.id}
            playlistTracks={props.stateData.playlistTracks[props.stateData.likedSongsPlaylist.id]}
          />

          <Divider />

          {props.stateData.spotifyPlaylists.map((item, index) => {
            return (
              <PlaylistItem
                spotifyPlayerContext={props.stateData.spotifyPlayerContext}
                vscode={props.vscode}
                playlistItem={item}
                key={`playlist_${index}`}
                playlistTracks={props.stateData.playlistTracks[item.id]}
              />
            );
          })}
        </TreeView>
      )}
    </Card>
  );
}
