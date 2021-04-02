import React, { useState } from "react";
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import CardHeader from "@material-ui/core/CardHeader";
import PropTypes from "prop-types";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import { PlaylistIcon, TrackIcon } from "../icons";
import IconButton from "@material-ui/core/IconButton";
import Box from "@material-ui/core/Box";
import deepPurple from "@material-ui/core/colors/deepPurple";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import Fade from "@material-ui/core/Fade";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import { BeakerIcon, MuiAlbumIcon, MuiShareIcon, MuiCloseIcon } from "../icons";

const ITEM_HEIGHT = 48;

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    textButton: {
      width: "100%",
      justifyContent: "flex-start",
      padding: theme.spacing(0.25, 0.5),
      fontWeight: 500,
    },
    playlistName: {
      marginLeft: -10
    },
		trackName: {
			margin: 0
		},
		menuItem: {
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

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
		event.preventDefault();
  };

  const handleClose = (event) => {
    setAnchorEl(null);
		event.preventDefault();
  };

  return (
		<Grid container direction="row" justify="space-between"
			onMouseOver={showMenu}
			onMouseOut={hideMenu}
			key={item.id}>
			<Grid item xs={10}
				className={(item.type === "playlist") ? classes.playlistName : classes.trackName}>
				<Button classes={{ root: classes.textButton }} startIcon={(item.type === "playlist") ? <PlaylistIcon /> : <TrackIcon />}>
					<Box textOverflow="ellipsis" overflow="hidden">{ item.name }</Box>
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
					onClose={handleClose}
					PaperProps={{
						style: {
							maxHeight: ITEM_HEIGHT * 4.5,
						},
					}}>
						<MenuItem key="menu_title" onClick={handleClose}>
							<CardHeader
								action={<MuiCloseIcon />}
								title={item.name}
								subheader={item?.albumName}/>
						</MenuItem>
						<MenuItem key="album" onClick={handleClose} disableGutters dense className={classes.menuItem}>
							<Button classes={{ root: classes.textButton }} startIcon={<MuiAlbumIcon />}>
								Show album
							</Button>
						</MenuItem>
						<MenuItem key="recommendations" onClick={handleClose} disableGutters dense className={classes.menuItem}>
							<Button classes={{ root: classes.textButton }} startIcon={<BeakerIcon />}>
								Get recommendations
							</Button>
						</MenuItem>
						<MenuItem key="share" onClick={handleClose} disableGutters dense className={classes.menuItem}>
							<Button classes={{ root: classes.textButton }} startIcon={<MuiShareIcon />}>
								Share track
							</Button>
						</MenuItem>
				</Menu>)}

			</Grid>
		</Grid>
  );
}

PlaylistItemNode.propTypes = {
	item: PropTypes.any.isRequired
};
