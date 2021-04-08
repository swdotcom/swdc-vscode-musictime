import React, { useState } from "react";
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import PropTypes from "prop-types";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import { PlaylistIcon, TrackIcon } from "../icons";
import IconButton from "@material-ui/core/IconButton";
import deepPurple from "@material-ui/core/colors/deepPurple";
import grey from "@material-ui/core/colors/grey";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import Fade from "@material-ui/core/Fade";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import { BeakerIcon, MuiAlbumIcon, MuiShareIcon, MuiCloseIcon } from "../icons";
import { DARK_BG_COLOR, MAX_MENU_HEIGHT } from "../../utils/view_constants";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
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
      fontWeight: 300,
      fontSize: 12
    },
    playlistButton: {
      justifyContent: "flex-start",
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
      marginRight: 10
    },
    menuHeaderSecondary: {
      color: grey[500],
      fontWeight: 300,
      fontSize: 12
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
      padding: 0
    }
  })
);

export default function PlaylistItemNode(props) {
  const classes = useStyles();
  const [show, setShow] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const { item } = props;

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
  }

  function showAlbum() {
    const command = {
      action: "musictime.showAlbum",
      command: "command_execute",
      arguments: [item],
    };
    props.vscode.postMessage(command);
  }

  function getTrackRecommendations() {
    const command = {
      action: "musictime.getTrackRecommendations",
      command: "command_execute",
      arguments: [item],
    };
    props.vscode.postMessage(command);
  }

  function shareTrack() {
    const command = {
      action: "musictime.shareTrack",
      command: "command_execute",
      arguments: [item],
    };
    props.vscode.postMessage(command);
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
    event.preventDefault();
  }

  function handleClose(event) {
    setAnchorEl(null);
    event.preventDefault();
  }

  return (
    <Grid container direction="row" justify="space-between" onMouseOver={showMenu} onMouseOut={hideMenu} key={item.id}>
      {item.type === "track" ? (
        <Grid item xs={10}>
          <List disablePadding={true} dense
            style={{width: "100%", flexGrow: 1, marginLeft: 10, marginRight: 10, marginBottom: 0, marginTop: 0, padding: 0}}>
            <ListItem key={`track-${item.name}`} disableGutters={true} dense={true} button onClick={playTrack} style={{margin: 0, padding: 0}}>
              <TrackIcon />
              <ListItemText
                style={{marginRight: 4}}
                primary={
                  <Typography noWrap className={classes.playlistPrimaryText}>
                    {item.name}
                  </Typography>
                }
                secondary={item.albumName ?
                  (<Typography noWrap className={classes.playlistSecondaryText}>
                    {item?.albumName}
                  </Typography>)
                  : null
                }
              />
            </ListItem>
          </List>
        </Grid>
      ) : (
        <Button
          classes={{ root: (item.type === "track") ? classes.trackButton : classes.playlistButton }}
          onClick={playTrack} startIcon={<PlaylistIcon />}>
          <Typography className={classes.playlistName}>{item.name}</Typography>
        </Button>
      )}
      {item.type === "track" && (
        <Grid item xs={1} className={classes.trackItemGridItem}>
          <Fade in={show}>
            <IconButton
              hidden={true}
              size="small"
              style={{ color: deepPurple[300], float: "right" }}
              onMouseOver={showMenu}
              onClick={handleClick}
              aria-label="Track menu"
            >
              <MoreVertIcon />
            </IconButton>
          </Fade>
          <Menu
            id="long-menu"
            anchorEl={anchorEl}
            keepMounted
            open={open}
            PaperProps={{
              style: {
                maxHeight: MAX_MENU_HEIGHT,
                backgroundColor: DARK_BG_COLOR,
              },
            }}
          >
            <MenuItem key="menu_title" style={{padding: 0, margin: 0}}>
              <List disablePadding={true} dense={true}
                style={{marginLeft: 10, marginRight: 10, marginBottom: 0, marginTop: 0}}>
                <ListItem key={`track-menu-${item.name}`} disableGutters={true} dense={true}>
                  <ListItemText
                    primary={
                      <Typography noWrap className={classes.menuHeaderPrimary}>
                        {item.name}
                      </Typography>
                    }
                    secondary={
                      <Typography noWrap className={classes.menuHeaderSecondary}>
                        {item?.albumName}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction onClick={handleClose}>
                    <MuiCloseIcon />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </MenuItem>
            <List component="nav" disablePadding={true} dense={true}
              aria-labelledby="track-selections">
              <ListItem key="show-album" button onClick={showAlbum} disableGutters={true} dense={true}>
                <ListItemIcon className={classes.listItemIcon}>
                  <MuiAlbumIcon />
                </ListItemIcon>
                <ListItemText primary="Show album" style={{margin: 0, padding: 0}}/>
              </ListItem>
              <ListItem key="get-recs" button onClick={getTrackRecommendations} disableGutters={true} dense={true}>
                <ListItemIcon className={classes.listItemIcon}>
                  <BeakerIcon />
                </ListItemIcon>
                <ListItemText primary="Get recommendations" style={{margin: 0, padding: 0}}/>
              </ListItem>
              <ListItem key="share-track" button onClick={shareTrack} disableGutters={true} dense={true}>
                <ListItemIcon className={classes.listItemIcon}>
                  <MuiShareIcon />
                </ListItemIcon>
                <ListItemText primary="Share track" style={{margin: 0, padding: 0}}/>
              </ListItem>
            </List>
          </Menu>
        </Grid>
      )}
    </Grid>
  );
}

PlaylistItemNode.propTypes = {
  item: PropTypes.any.isRequired,
  vscode: PropTypes.any.isRequired,
};
