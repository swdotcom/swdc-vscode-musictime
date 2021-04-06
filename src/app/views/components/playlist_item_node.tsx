import React, { useState } from "react";
import { makeStyles, Theme, createStyles, withStyles } from "@material-ui/core/styles";
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
import Tooltip from "@material-ui/core/Tooltip";
import { BeakerIcon, MuiAlbumIcon, MuiShareIcon, MuiCloseIcon } from "../icons";
import { DARK_BG_COLOR, MAX_MENU_HEIGHT } from "../../utils/view_constants";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    textButton: {
      justifyContent: "flex-start",
			margin: 0,
			paddingLeft: 4,
			paddingTop: 0,
			paddingBottom: 1,
      fontWeight: 500
    },
    playlistName: {
			marginRight: 16,
			wrap: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis"
    },
		trackName: {
			marginRight: 0,
			wrap: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis"
		},
		menuItem: {
			marginLeft: 5,
			marginBottom: 0,
			marginTop: 0,
			padding: 0
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
		},
		trackItemGridItem: {
			width: "100%",
			flexGrow: 1
		}
  })
);

const HtmlTooltip = withStyles((theme) => ({
  tooltip: {
		backgroundColor: DARK_BG_COLOR,
    color: grey[500],
		maxWidth: 200,
		padding: 8
  },
}))(Tooltip);

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
			arguments: [item]
    };
    props.vscode.postMessage(command);
	}

	function showAlbum() {
		const command = {
      action: "musictime.showAlbum",
      command: "command_execute",
			arguments: [item]
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
		<Grid container direction="row" justify="space-between"
			onMouseOver={showMenu}
			onMouseOut={hideMenu}
			key={item.id}>
			{(item.type === "track")
				? (<Grid item xs={11}>
					<HtmlTooltip
					  placement="bottom"
						title={
							<React.Fragment>
								<Typography color="inherit">{item.name}</Typography>
								{item.albumName}
							</React.Fragment>
						}>
						<Button classes={{ root: classes.textButton }}
							onClick={playTrack}
							startIcon={<TrackIcon/>}>
							<Typography className={classes.trackName}>{ item.name }</Typography>
						</Button>
					</HtmlTooltip>
				</Grid>)
				: (<Button classes={{ root: classes.textButton }}
					onClick={playTrack}
					startIcon={<PlaylistIcon />}>
					<Typography className={classes.playlistName}>{ item.name }</Typography>
				</Button>)}
			{(item.type === "track") && (
			<Grid item xs={1} className={classes.trackItemGridItem}>
				<Fade in={show}>
					<IconButton
						hidden={true}
						size="small"
						style={{ color: deepPurple[300], float: "right" }}
						onMouseOver={showMenu}
						onClick={handleClick}
						aria-label="Track menu">
						<MoreVertIcon/>
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
				</Menu>
			</Grid>
			)}
		</Grid>
  );
}

PlaylistItemNode.propTypes = {
	item: PropTypes.any.isRequired,
	vscode: PropTypes.any.isRequired
};
