import React, { useState, useEffect } from "react";
import Grid from "@material-ui/core/Grid";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import { makeStyles } from "@material-ui/core/styles";
import {
  MuiCloseIcon,
  MuiSkipPreviousIcon,
  MuiPlayArrowIcon,
  MuiSkipNextIcon,
  MuiShuffleIcon,
  MuiRepeatOneIcon,
  MuiStopIcon,
  MuiVolumeUpIcon,
  MuiVolumeOffIcon,
  MuiDevicesIcon,
  MuiAddCircleIcon,
  MuiFavoriteIcon,
  MuiFavoriteBorderIcon,
  MuiRefreshIcon,
} from "../icons";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import { grey, deepPurple } from "@material-ui/core/colors";
import Box from "@material-ui/core/Box";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import Divider from "@material-ui/core/Divider";
import { DARK_BG_COLOR, DARK_BG_TEXT_COLOR, DARK_BG_TEXT_SECONDARY_COLOR, MAX_MENU_HEIGHT } from "../../utils/view_constants";
import Tooltip from "@material-ui/core/Tooltip";
import CardHeader from "@material-ui/core/CardHeader";

const useStyles = makeStyles((theme) => ({
  buttonGroupItems: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    "& > *": {
      margin: theme.spacing(1),
    },
  },
  listContainer: {
    marginLeft: 10,
    marginRight: 10,
    marginBottom: 0,
    marginTop: 0,
    position: "relative",
  },
  listItemIcon: {
    minWidth: "28px",
  },
  menuHeaderPrimary: {
    wrap: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: deepPurple[200],
    marginRight: 10,
  },
  menuHeaderSecondary: {
    wrap: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: grey[500],
    fontWeight: 300,
    fontSize: 12,
    marginRight: 10,
  },
  cardHeaderAction: {
    color: theme.palette.secondary.main,
  },
  cardHeaderTitle: {
    color: DARK_BG_TEXT_COLOR,
  },
  cardHeaderSubheader: {
    color: DARK_BG_TEXT_SECONDARY_COLOR,
  },
  playerControl: {
    width: "fit-content",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
    "& svg": {
      margin: theme.spacing(1.5),
    },
    "& hr": {
      margin: theme.spacing(0, 0.5),
    },
  },
  margin: {
    margin: 0,
    padding: 0,
  },
}));

function getTrackName(currentTrack) {
  return isTrackAvailable(currentTrack) ? currentTrack?.name || "Select a track to play" : "Select a track to play";
}

function getTrackDescription(currentTrack) {
  let description = "";
  if (currentTrack && isTrackAvailable(currentTrack)) {
    if (currentTrack.artist && typeof currentTrack.artist === "string") {
      description += currentTrack.artist;
    }
    if (currentTrack.album && typeof currentTrack.album === "string") {
      if (description.length) {
        description += " - ";
      }
      description += currentTrack.album;
    }
  }
  return description;
}

function isRepeatingTrack(spotifyContext) {
  return !!(spotifyContext && spotifyContext.repeat_state === "track");
}

function isShuffling(spotifyContext) {
  return !!(spotifyContext && spotifyContext.shuffle_state === true);
}

function isTrackAvailable(currentTrack) {
  return !!(currentTrack && currentTrack.id);
}

function isPaused(currentTrack) {
  return !!(currentTrack && currentTrack.state === "paused");
}

function isPlaying(currentTrack) {
  return !!(currentTrack && currentTrack.state === "playing");
}

function isMuted(currentTrack) {
  return !!(isTrackAvailable(currentTrack) && currentTrack.volume === 0);
}

function isLiked(currentTrack) {
  return !!(isTrackAvailable(currentTrack) && currentTrack.liked);
}

export default function AudioControl(props) {
  const classes = useStyles();

  const [openMenu, setOpenMenu] = useState(false);

  useEffect(() => {
    if (openMenu !== props.openMenu) {
      setOpenMenu(props.openMenu);
    }
  });

  const spotifyContext = props.stateData.spotifyPlayerContext;
  const currentTrack = props.stateData.currentlyRunningTrack;

  /**
   * primaryText,
   * secondaryText,
   * isActive
   */
  const deviceMenuInfo = props.stateData.deviceMenuInfo;

  const runningTrackName = getTrackName(currentTrack);
  const runningTrackStatus = getTrackDescription(currentTrack);
  const enableControls = isTrackAvailable(currentTrack);
  const repeatingTrack = isRepeatingTrack(spotifyContext);
  const shuffling = isShuffling(spotifyContext);
  const paused = isPaused(currentTrack);
  const playing = isPlaying(currentTrack);
  const muted = isMuted(currentTrack);
  const liked = isLiked(currentTrack);

  /**
   * paused song
   * spotifyPlayerContext
   * {"timestamp":0,"device":{"id":"","is_active":"","is_restricted":false,
   * "name":"","type":"","volume_percent":0},"progress_ms":"","is_playing":false,
   * "currently_playing_type":"","actions":null,"item":null,"shuffle_state":false,
   * "repeat_state":"","context":null}
   *
   * currentlyRunningTrack:
   * {"artist":"Yves V","album":"Echo","genre":"","disc_number":1,"duration":180560,"played_count":0,
   * "track_number":1,"id":"57Zcl7oKKr29qHp38dzzWi","name":"Echo","state":"paused",
   * "volume":100,"popularity":67,
   * "artwork_url":"https://i.scdn.co/image/ab67616d0000b2730b74292f2a1f6825f10f3c4f",
   * "spotify_url":"spotify:track:57Zcl7oKKr29qHp38dzzWi","progress_ms":27898,
   * "uri":"spotify:track:57Zcl7oKKr29qHp38dzzWi"}
   */

  function handleClose(event = null) {
    props.handleCloseCallback();
  }

  // audio control functions
  function unMuteClick() {
    const command = {
      action: "musictime.unMute",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleCloseCallback();
  }

  function muteClick() {
    const command = {
      action: "musictime.mute",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleCloseCallback();
  }

  function repeatOneClick() {
    const command = {
      action: "musictime.repeatTrack",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleCloseCallback();
    spotifyContext.repeat_state = "track";
  }

  function disableRepeatClick() {
    const command = {
      action: "musictime.repeatOff",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleCloseCallback();
    spotifyContext.repeat_state = "none";
  }

  function playClick() {
    const command = {
      action: "musictime.play",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleCloseCallback();
  }

  function pauseClick() {
    const command = {
      action: "musictime.pause",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleCloseCallback();
  }

  function previousClick() {
    const command = {
      action: "musictime.previous",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleCloseCallback();
  }

  function nextClick() {
    const command = {
      action: "musictime.next",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleCloseCallback();
  }

  function disableShuffleClick() {
    const command = {
      action: "musictime.shuffleOff",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleCloseCallback();
    spotifyContext.shuffle_state = false;
  }

  function enableShuffleClick() {
    const command = {
      action: "musictime.shuffleOn",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleCloseCallback();
    spotifyContext.shuffle_state = true;
  }

  function connectDeviceClick() {
    const command = {
      action: "musictime.deviceSelector",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleCloseCallback();
  }

  function updateLikedClick() {
    const command = {
      action: !liked ? "musictime.like" : "musictime.unlike",
      command: "command_execute",
      arguments: [currentTrack],
    };
    props.vscode.postMessage(command);
    props.handleCloseCallback();
  }

  function refreshSongInfoClick() {
    const command = {
      action: "musictime.songTitleRefresh",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  return (
    <Menu
      id="main_audio_options_menu"
      anchorEl={props.anchorEl}
      keepMounted
      open={openMenu}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      PaperProps={{
        style: {
          padding: 1,
          minWidth: 280,
          maxHeight: MAX_MENU_HEIGHT,
          backgroundColor: DARK_BG_COLOR,
          color: DARK_BG_TEXT_COLOR,
        },
      }}
    >
      <MenuItem key="audio_options_menu_item" style={{ padding: 0, margin: 0 }}>
        <List disablePadding={true} dense={true} className={classes.listContainer}>
          <ListItem key={`audo-options-info-li`} disableGutters={true} dense={true}>
            <ListItemText
              primary={
                <Typography noWrap className={classes.menuHeaderPrimary}>
                  {runningTrackName}
                </Typography>
              }
              secondary={
                <Typography noWrap className={classes.menuHeaderSecondary}>
                  {runningTrackStatus}
                </Typography>
              }
            />
          </ListItem>
        </List>
        <Box style={{ position: "absolute", right: 4, top: -6 }}>
          <Tooltip title="Refresh song information">
            <IconButton edge="end" onClick={refreshSongInfoClick}>
              <MuiRefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={liked ? "Unlike" : "Like"}>
            <IconButton edge="end" onClick={updateLikedClick}>
              {liked ? <MuiFavoriteIcon fontSize="small" /> : <MuiFavoriteBorderIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <IconButton aria-label="Close" onClick={handleClose} edge="end">
            <MuiCloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </MenuItem>
      <Divider />
      <Grid container>
        <Grid item xs={12}>
          <CardHeader
            classes={{
              title: classes.cardHeaderTitle,
              subheader: classes.cardHeaderSubheader,
            }}
            avatar={<MuiDevicesIcon />}
            action={
              <Tooltip title={!deviceMenuInfo.isActive ? "Connect" : "Change Device"}>
                <IconButton onClick={connectDeviceClick}>
                  <MuiAddCircleIcon />
                </IconButton>
              </Tooltip>
            }
            title={deviceMenuInfo.primaryText}
            subheader={deviceMenuInfo.secondaryText || null}
          />
        </Grid>

        <Grid item xs={12}>
          <div className={classes.buttonGroupItems}>
            {enableControls && (
              <Grid container alignItems="center" className={classes.playerControl}>
                <Tooltip title="Previous">
                  <IconButton onClick={previousClick} className={classes.margin} size="small">
                    <MuiSkipPreviousIcon color="primary" fontSize="small" />
                  </IconButton>
                </Tooltip>
                {paused && (
                  <Tooltip title="Play">
                    <IconButton onClick={playClick} className={classes.margin} size="small">
                      <MuiPlayArrowIcon color="primary" fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {playing && (
                  <Tooltip title="Pause">
                    <IconButton onClick={pauseClick} className={classes.margin} size="small">
                      <MuiStopIcon color="primary" fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Next">
                  <IconButton onClick={nextClick} className={classes.margin} size="small">
                    <MuiSkipNextIcon color="primary" fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Divider orientation="vertical" flexItem />

                <Tooltip title={shuffling ? "Disable shuffle" : "Enable shuffle"}>
                  <IconButton onClick={shuffling ? disableShuffleClick : enableShuffleClick} className={classes.margin} size="small">
                    <MuiShuffleIcon color={shuffling ? "action" : "primary"} fontSize="small" />
                  </IconButton>
                </Tooltip>
                {repeatingTrack ? (
                  <Tooltip title="Disable repeat">
                    <IconButton onClick={disableRepeatClick} className={classes.margin} size="small">
                      <MuiRepeatOneIcon color="action" fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Enable repeat one">
                    <IconButton onClick={repeatOneClick} className={classes.margin} size="small">
                      <MuiRepeatOneIcon color="primary" fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {muted ? (
                  <Tooltip title="Unmute">
                    <IconButton onClick={unMuteClick} className={classes.margin} size="small">
                      <MuiVolumeOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Mute">
                    <IconButton onClick={muteClick} className={classes.margin} size="small">
                      <MuiVolumeUpIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Grid>
            )}
          </div>
        </Grid>
      </Grid>
    </Menu>
  );
}
