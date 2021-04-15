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
  MuiRepeatIcon,
  MuiShuffleIcon,
  MuiRepeatOneIcon,
  MuiStopIcon,
  MuiVolumeUpIcon,
  MuiVolumeOffIcon,
  MuiDevicesIcon,
  MuiAddCircleIcon,
} from "../icons";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import { grey, deepPurple } from "@material-ui/core/colors";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import Divider from "@material-ui/core/Divider";
import { DARK_BG_COLOR, DARK_BG_TEXT_COLOR, DARK_BG_TEXT_SECONDARY_COLOR, MAX_MENU_HEIGHT } from "../../utils/view_constants";
import Tooltip from "@material-ui/core/Tooltip";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Button from "@material-ui/core/Button";
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
  menuHeaderPrimary: {
    color: deepPurple[200],
    marginRight: 10,
  },
  menuHeaderSecondary: {
    color: grey[500],
    fontWeight: 300,
    fontSize: 12,
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
}));

function getTrackName(currentTrack) {
  return isTrackAvailable(currentTrack) ? currentTrack?.name || "Select a track to play" : "Select a track to play";
}

function getTrackDescription(currentTrack) {
  let description = "";
  if (isTrackAvailable(currentTrack)) {
    description += currentTrack?.artist && "";
    if (currentTrack.album) {
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

function isRepeatingPlaylist(spotifyContext) {
  return !!(spotifyContext && spotifyContext.repeat_state === "context");
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
  const repeatingPlaylist = isRepeatingPlaylist(spotifyContext);
  const shuffling = isShuffling(spotifyContext);
  const paused = isPaused(currentTrack);
  const playing = isPlaying(currentTrack);
  const muted = isMuted(currentTrack);

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
    props.handleAudioOptionsCloseCallback();
  }

  // audio control functions
  function unMuteClick() {
    const command = {
      action: "musictime.unMute",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleAudioOptionsCloseCallback();
  }

  function muteClick() {
    const command = {
      action: "musictime.mute",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleAudioOptionsCloseCallback();
  }

  function repeatPlaylistClick() {
    const command = {
      action: "musictime.repeatPlaylist",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleAudioOptionsCloseCallback();
    spotifyContext.repeat_state = "context";
  }

  function repeatOneClick() {
    const command = {
      action: "musictime.repeatTrack",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleAudioOptionsCloseCallback();
    spotifyContext.repeat_state = "track";
  }

  function disableRepeatClick() {
    const command = {
      action: "musictime.repeatOff",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleAudioOptionsCloseCallback();
    spotifyContext.repeat_state = "none";
  }

  function playClick() {
    const command = {
      action: "musictime.play",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleAudioOptionsCloseCallback();
  }

  function pauseClick() {
    const command = {
      action: "musictime.pause",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleAudioOptionsCloseCallback();
  }

  function previousClick() {
    const command = {
      action: "musictime.previous",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleAudioOptionsCloseCallback();
  }

  function nextClick() {
    const command = {
      action: "musictime.next",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleAudioOptionsCloseCallback();
  }

  function disableShuffleClick() {
    const command = {
      action: "musictime.shuffleOff",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleAudioOptionsCloseCallback();
    spotifyContext.shuffle_state = false;
  }

  function enableShuffleClick() {
    const command = {
      action: "musictime.shuffleOn",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleAudioOptionsCloseCallback();
    spotifyContext.shuffle_state = true;
  }

  function connectDeviceClick() {
    const command = {
      action: "musictime.deviceSelector",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
    props.handleAudioOptionsCloseCallback();
  }

  return (
    <Menu
      id="main_audio_options_menu"
      anchorEl={props.anchorEl}
      keepMounted
      open={openMenu}
      PaperProps={{
        style: {
          width: 280,
          maxHeight: MAX_MENU_HEIGHT,
          backgroundColor: DARK_BG_COLOR,
          paddingRight: 6,
          paddingLeft: 0,
          color: DARK_BG_TEXT_COLOR,
        },
      }}
    >
      <MenuItem key="audio_options_menu_item" style={{ padding: 0, margin: 0 }}>
        <List disablePadding={true} dense={true} style={{ marginLeft: 10, marginRight: 10, marginBottom: 0, marginTop: 0 }}>
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
        <IconButton aria-label="Close" onClick={handleClose} style={{ position: "absolute", right: 2, top: 2 }}>
          <MuiCloseIcon />
        </IconButton>
      </MenuItem>
      <Grid container>
        <Grid item xs={12}>
          <div className={classes.buttonGroupItems}>
            {enableControls && (
              <ButtonGroup variant="text" size="small">
                <Tooltip title="Previous">
                  <Button onClick={previousClick}>
                    <MuiSkipPreviousIcon color="primary" />
                  </Button>
                </Tooltip>
                {paused && (
                  <Tooltip title="Play">
                    <Button onClick={playClick}>
                      <MuiPlayArrowIcon color="primary" />
                    </Button>
                  </Tooltip>
                )}
                {playing && (
                  <Tooltip title="Pause">
                    <Button onClick={pauseClick}>
                      <MuiStopIcon color="primary" />
                    </Button>
                  </Tooltip>
                )}
                <Tooltip title="Next">
                  <Button onClick={nextClick}>
                    <MuiSkipNextIcon color="primary" />
                  </Button>
                </Tooltip>
                <Tooltip title={shuffling ? "Disable shuffle" : "Enable shuffle"}>
                  <Button onClick={shuffling ? disableShuffleClick : enableShuffleClick}>
                    <MuiShuffleIcon color={shuffling ? "secondary" : "primary"} />
                  </Button>
                </Tooltip>
                {repeatingTrack ? (
                  <Tooltip title="Disable repeat">
                    <Button onClick={disableRepeatClick}>
                      <MuiRepeatOneIcon color="secondary" />
                    </Button>
                  </Tooltip>
                ) : repeatingPlaylist ? (
                  <Tooltip title="Enable repeat one">
                    <Button onClick={repeatOneClick}>
                      <MuiRepeatIcon color="secondary" />
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip title="Enable playlist repeat">
                    <Button onClick={repeatPlaylistClick}>
                      <MuiRepeatIcon color="primary" />
                    </Button>
                  </Tooltip>
                )}
                {muted ? (
                  <Tooltip title="Unmute">
                    <Button onClick={unMuteClick}>
                      <MuiVolumeOffIcon />
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip title="Mute">
                    <Button onClick={muteClick}>
                      <MuiVolumeUpIcon />
                    </Button>
                  </Tooltip>
                )}
              </ButtonGroup>
            )}
          </div>
        </Grid>
        <Divider />
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
      </Grid>
    </Menu>
  );
}
