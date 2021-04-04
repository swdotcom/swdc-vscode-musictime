import React, { useState } from "react";
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
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
    textButton: {
      width: "100%",
      justifyContent: "flex-start",
      padding: theme.spacing(0.25, 0.5),
      fontWeight: 500,
			marginLeft: 4
    },
    playlistName: {
      marginLeft: -10,
			overflow: "hidden"
    },
		trackName: {
			margin: 0,
			overflow: "hidden"
		},
		menuItem: {
			margin: 0,
			padding: 0,
		},
		menuItemText: {
			color: "white",
			fontWeight: 300,
			fontSize: 12
		},
		menuList: {
			overflow: "hidden"
		},
		menuHeaderPrimary: {
			color: deepPurple[200]
		},
		menuHeaderSecondary: {
			color: grey[500],
			fontWeight: 300,
			fontSize: 12
		},
		menuHeaderAction: {
			right: -4,
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
		if (item.type === "playlist") return;
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		setShow(true);
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

	function showAlbum() {
		const command = {
      action: "musictime.showAlbum",
      command: "command_execute",
			arguments: [item]
    };
    props.vscode.postMessage(command);
	}

  return (
		<Grid container direction="row" justify="space-between"
			onMouseOver={showMenu}
			onMouseOut={hideMenu}
			key={item.id}>
			<Grid item xs={10}
				className={(item.type === "playlist") ? classes.playlistName : classes.trackName}>
				<Button classes={{ root: classes.textButton }}
					startIcon={(item.type === "playlist") ? <PlaylistIcon /> : <TrackIcon/>}>
					<Typography noWrap >{ item.name }</Typography>
				</Button>
			</Grid>
			<Grid item xs={2}>
				<Fade in={show}>
					<IconButton
						hidden={true}
						size="small"
						style={{ color: deepPurple[300] }}
						onMouseOver={showMenu}
						onClick={handleClick}
						aria-label={(item.type === "playlist") ? "Playlist menu" : "Track menu"}>
						<MoreVertIcon/>
					</IconButton>
				</Fade>
				{(item.type === "track") && (<Menu
					id="long-menu"
					anchorEl={anchorEl}
					keepMounted
					open={open}
					PaperProps={{
						style: {
							maxHeight: MAX_MENU_HEIGHT,
							backgroundColor: DARK_BG_COLOR
						},
					}}>
						<MenuItem key="menu_title">
							<List disablePadding={true} dense={true}>
          			<ListItem disableGutters={true} dense={true} className={classes.menuList}>
            			<ListItemText
										primary={<Typography noWrap className={classes.menuHeaderPrimary}>{ item.name }</Typography>}
										secondary={<Typography noWrap className={classes.menuHeaderSecondary}>{ item?.albumName }</Typography>}/>
									<ListItemSecondaryAction classes={{ root: classes.menuHeaderAction }} onClick={handleClose}>
										<MuiCloseIcon/>
									</ListItemSecondaryAction>
								</ListItem>
							</List>
						</MenuItem>
						<MenuItem key="album" onClick={handleClose} disableGutters dense className={classes.menuItem}>
							<Button classes={{ root: classes.textButton }} startIcon={<MuiAlbumIcon />} onClick={showAlbum}>
								<Typography className={classes.menuItemText}>Show album</Typography>
							</Button>
						</MenuItem>
						<MenuItem key="recommendations" onClick={handleClose} disableGutters dense className={classes.menuItem}>
							<Button classes={{ root: classes.textButton }} startIcon={<BeakerIcon />}>
								<Typography className={classes.menuItemText}>Get recommendations</Typography>
							</Button>
						</MenuItem>
						<MenuItem key="share" onClick={handleClose} disableGutters dense className={classes.menuItem}>
							<Button classes={{ root: classes.textButton }} startIcon={<MuiShareIcon />}>
								<Typography className={classes.menuItemText}>Share track</Typography>
							</Button>
						</MenuItem>
				</Menu>)}

			</Grid>
		</Grid>
  );
}

PlaylistItemNode.propTypes = {
	item: PropTypes.any.isRequired,
	vscode: PropTypes.any.isRequired
};
