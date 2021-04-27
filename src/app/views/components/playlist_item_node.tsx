import React, { useState } from "react";
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import PropTypes from "prop-types";
import Typography from "@material-ui/core/Typography";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import Grid from "@material-ui/core/Grid";
import { PlaylistIcon, TrackIcon, MuiFavoriteIcon, MuiFavoriteBorderIcon } from "../icons";
import IconButton from "@material-ui/core/IconButton";
import deepPurple from "@material-ui/core/colors/deepPurple";
import grey from "@material-ui/core/colors/grey";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import Fade from "@material-ui/core/Fade";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import Tooltip from "@material-ui/core/Tooltip";
import Divider from "@material-ui/core/Divider";
import {
  BeakerIcon,
  MuiAlbumIcon,
  MuiShareIcon,
  MuiCloseIcon,
  MuiRemoveCircleIcon,
  MuiAddCircleIcon,
  MuiRepeatIcon,
  MuiRepeatOneIcon,
} from "../icons";
import { DARK_BG_COLOR, MAX_MENU_HEIGHT, RECOMMENDATION_PLAYLIST_ID } from "../../utils/view_constants";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1,
      width: "100%",
      margin: 0,
      padding: 0,
    },
    startIcon: {
      margin: 0,
      padding: 0,
      "&:hover": {
        background: "transparent",
      },
    },
    trackButton: {
      justifyContent: "flex-start",
      margin: 0,
      paddingLeft: 4,
      paddingTop: 0,
      paddingBottom: 1,
      fontWeight: 500,
    },
    playlistPrimaryText: {
      justifyContent: "flex-start",
      margin: 0,
      padding: 0,
      fontWeight: 500,
      wrap: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    playlistSecondaryText: {
      justifyContent: "flex-start",
      margin: 0,
      padding: 0,
      wrap: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      color: grey[500],
      fontWeight: 400,
      fontSize: 12,
    },
    playlistButton: {
      justifyContent: "flex-start",
      background: "transparent",
      margin: 0,
      padding: 0,
      fontWeight: 500,
    },
    playlistName: {
      marginRight: 16,
      wrap: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    trackName: {
      marginRight: 0,
      wrap: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    menuHeaderPrimary: {
      color: deepPurple[200],
      marginRight: 10,
    },
    menuHeaderSecondary: {
      color: grey[300],
      fontWeight: 400,
      fontSize: 12,
    },
    trackItemGridItem: {
      width: "100%",
      flexGrow: 1,
    },
    listItemIcon: {
      display: "flex",
      justifyContent: "center",
      textAlign: "center",
      margin: 0,
      padding: 0,
      minWidth: "36px",
    },
    listItemText: {
      color: grey[200],
    },
  })
);

function isRepeatingTrack(spotifyContext) {
  return !!(spotifyContext && spotifyContext.repeat_state === "track");
}

export default function PlaylistItemNode(props) {
  const classes = useStyles();
  const [show, setShow] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const { item, spotifyPlayerContext } = props;

  const repeatingTrack = isRepeatingTrack(spotifyPlayerContext);

  let timeout = undefined;

  function showMenu() {
    if (item.type === "playlist") {
      return;
    }
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    setShow(true);
  }

  function playTrack() {
    const command = {
      action: "musictime.playTrack",
      command: "command_execute",
      arguments: [item],
    };
    props.vscode.postMessage(command);
    handleClose();
  }

  function showAlbum() {
    const command = {
      action: "musictime.showAlbum",
      command: "command_execute",
      arguments: [item],
    };
    props.vscode.postMessage(command);
    handleClose();
  }

  function getTrackRecommendations() {
    const command = {
      action: "musictime.getTrackRecommendations",
      command: "command_execute",
      arguments: [item],
    };
    props.vscode.postMessage(command);
    handleClose();
  }

  function shareTrack() {
    const command = {
      action: "musictime.shareTrack",
      command: "command_execute",
      arguments: [item],
    };
    props.vscode.postMessage(command);
    handleClose();
  }

  function removeTrack(event) {
    const command = {
      action: "musictime.removeTrack",
      command: "command_execute",
      arguments: [item],
    };
    props.vscode.postMessage(command);
    handleClose();
  }

  function likeTrackHandler(event) {
    const command = {
      action: !item.liked ? "musictime.like" : "musictime.unlike",
      command: "command_execute",
      arguments: [item],
    };
    props.vscode.postMessage(command);
    handleClose();
  }

  function repeatTrackClick(event) {
    const command = {
      action: "musictime.repeatTrack",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    handleClose();
  }

  function disableRepeatClick() {
    const command = {
      action: "musictime.repeatOff",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    handleClose();
  }

  function addToPlaylist(event) {
    const command = {
      action: "musictime.addToPlaylist",
      command: "command_execute",
      arguments: [item],
    };
    props.vscode.postMessage(command);
    handleClose();
  }

  function hideMenu() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    timeout = setTimeout(() => {
      setShow(false);
    }, 250);
  }

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose(event = null) {
    setAnchorEl(null);
  }

  return (
    <Grid container direction="row" justify="space-between" onMouseOver={showMenu} onMouseOut={hideMenu} key={item.id} className={classes.root}>
      {item.type === "track" ? (
        <Grid item xs={9}>
          <List
            disablePadding={true}
            dense
            style={{ width: "100%", flexGrow: 1, marginLeft: 0, marginRight: 10, paddingLeft: 0, marginBottom: 0, marginTop: 0, padding: 0 }}
          >
            <ListItem
              key={`track_${item.name}_${item.playlist_id}_li`}
              disableGutters={true}
              dense={true}
              button
              onClick={playTrack}
              style={{ margin: 0, padding: 0 }}
            >
              <ListItemIcon className={classes.listItemIcon}>
                <TrackIcon />
              </ListItemIcon>
              <ListItemText
                style={{ marginRight: 4 }}
                primary={
                  <Typography noWrap className={classes.playlistPrimaryText}>
                    {item.name}
                  </Typography>
                }
                secondary={
                  <Typography noWrap className={classes.playlistSecondaryText}>
                    {item.description}
                  </Typography>
                }
              />
            </ListItem>
          </List>
        </Grid>
      ) : (
        <Grid item xs={9}>
          <List disablePadding={true} dense style={{ width: "100%", flexGrow: 1, margin: 0, padding: 0 }}>
            <ListItem key={`playlist_${item.name}_li`} disableGutters={true} dense={true} style={{ margin: 0, padding: 0 }}>
              <ListItemIcon className={classes.listItemIcon}>
                <PlaylistIcon />
              </ListItemIcon>
              <ListItemText
                className={classes.playlistName}
                primary={
                  <Typography noWrap className={classes.playlistPrimaryText}>
                    {item.name}
                  </Typography>
                }
              />
            </ListItem>
          </List>
        </Grid>
      )}
      {item.type === "track" && (
        <Grid item xs={3} className={classes.trackItemGridItem}>
          <Fade in={show}>
            <Grid container alignItems="center" style={{ padding: 1, height: "100%", textAlign: "center" }}>
              <Grid item xs>
                <Tooltip title={item.liked ? "Remove from liked playlist" : "Add to your liked playlist"}>
                  <IconButton hidden={true} size="small" style={{ color: deepPurple[300] }} onClick={likeTrackHandler} aria-label="Like button">
                    {item.liked ? <MuiFavoriteIcon /> : <MuiFavoriteBorderIcon />}
                  </IconButton>
                </Tooltip>
              </Grid>
              <Grid item xs>
                <IconButton
                  hidden={true}
                  size="small"
                  style={{ color: deepPurple[300] }}
                  onMouseOver={showMenu}
                  onClick={handleClick}
                  aria-label="Track menu"
                >
                  <MoreVertIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Fade>
          <Menu
            id="main-menu"
            anchorEl={anchorEl}
            keepMounted
            open={open}
            PaperProps={{
              style: {
                maxHeight: MAX_MENU_HEIGHT,
                backgroundColor: DARK_BG_COLOR,
                padding: 2,
              },
            }}
          >
            <MenuItem key="menu_title">
              <List disablePadding={true} dense={true}>
                <ListItem key={`track_menu_${item.name}_${item.playlist_id}_li`} disableGutters={true} dense={true}>
                  <ListItemText
                    primary={
                      <Typography noWrap className={classes.menuHeaderPrimary}>
                        {item.name}
                      </Typography>
                    }
                    secondary={
                      <Typography noWrap className={classes.menuHeaderSecondary}>
                        {item?.description}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction onClick={handleClose}>
                    <MuiCloseIcon />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </MenuItem>

            <Divider />

            <List component="nav" disablePadding={true} dense={true} aria-labelledby="track-selections">
              <ListItem key="show-album" button onClick={showAlbum} disableGutters={true} dense={true}>
                <ListItemIcon className={classes.listItemIcon}>
                  <MuiAlbumIcon />
                </ListItemIcon>
                <ListItemText primary="Show album" className={classes.listItemText} />
              </ListItem>
              <ListItem key="get-recs" button onClick={getTrackRecommendations} disableGutters={true} dense={true}>
                <ListItemIcon className={classes.listItemIcon}>
                  <BeakerIcon />
                </ListItemIcon>
                <ListItemText primary="Get recommendations" className={classes.listItemText} />
              </ListItem>
              {repeatingTrack ? (
                <ListItem key="repeat-track" button onClick={repeatTrackClick} disableGutters={true} dense={true}>
                  <ListItemIcon className={classes.listItemIcon}>
                    <MuiRepeatIcon />
                  </ListItemIcon>
                  <ListItemText primary="Disable repeat" className={classes.listItemText} />
                </ListItem>
              ) : (
                <ListItem key="repeat-track" button onClick={disableRepeatClick} disableGutters={true} dense={true}>
                  <ListItemIcon className={classes.listItemIcon}>
                    <MuiRepeatOneIcon />
                  </ListItemIcon>
                  <ListItemText primary="Repeat track" className={classes.listItemText} />
                </ListItem>
              )}

              <ListItem key="share-track" button onClick={shareTrack} disableGutters={true} dense={true}>
                <ListItemIcon className={classes.listItemIcon}>
                  <MuiShareIcon />
                </ListItemIcon>
                <ListItemText primary="Share track" className={classes.listItemText} />
              </ListItem>

              <ListItem
                key="remove-track"
                button
                onClick={removeTrack}
                disableGutters={true}
                dense={true}
                disabled={!!(item.playlist_id === RECOMMENDATION_PLAYLIST_ID)}
              >
                <ListItemIcon className={classes.listItemIcon}>
                  <MuiRemoveCircleIcon />
                </ListItemIcon>
                <ListItemText
                  primary={item.liked ? "Remove from your liked playlist" : "Remove from this playlist"}
                  className={classes.listItemText}
                />
              </ListItem>
              <ListItem key="add-to-playlist" button onClick={addToPlaylist} disableGutters={true} dense={true}>
                <ListItemIcon className={classes.listItemIcon}>
                  <MuiAddCircleIcon />
                </ListItemIcon>
                <ListItemText primary="Add to playlist" className={classes.listItemText} />
              </ListItem>
            </List>
          </Menu>
        </Grid>
      )}
    </Grid>
  );
}

PlaylistItemNode.propTypes = {
  spotifyPlayerContext: PropTypes.any.isRequired,
  item: PropTypes.any.isRequired,
  vscode: PropTypes.any.isRequired,
};
