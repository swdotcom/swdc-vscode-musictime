import React, { useEffect, useState } from "react";
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import TreeView from "@material-ui/lab/TreeView";
import TreeItem, { TreeItemProps } from "@material-ui/lab/TreeItem";
import Button from "@material-ui/core/Button";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import ArrowRightIcon from "@material-ui/icons/ArrowRight";
import Grid from "@material-ui/core/Grid";
import { SvgIconProps } from "@material-ui/core/SvgIcon";
import { SpotifyIcon, PlaylistIcon } from "../icons";
import IconButton from "@material-ui/core/IconButton";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import DeleteIcon from "@material-ui/icons/Delete";
import deepPurple from "@material-ui/core/colors/deepPurple";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import Fade from "@material-ui/core/Fade";

let vscode = null;

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
      flexGrow: 1,
      margin: 0,
      padding: 0
    },
    gridItem: {
      marginLeft: -10
    },
    textButton: {
      width: "100%",
      justifyContent: "flex-start",
      padding: theme.spacing(0.25, 0.5),
      fontWeight: 500,
    },
    playlistName: {
      marginLeft: -10
    }
  })
);

export default function PlaylistItem(props) {
	vscode = props.vscode;
  const classes = useStyles();
	const [show, setShow] = useState(false);

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
		}, 500);
	}

  return (
		<Grid container direction="row" justify="space-between"
			onMouseOver={showMenu}
			onMouseOut={hideMenu}
					key={props.playlistItem.id}>
			<Grid item xs={10} className={classes.playlistName}>
				<Button classes={{ root: classes.textButton }} startIcon={<PlaylistIcon />}>
					<Box textOverflow="ellipsis" overflow="hidden">{ props.playlistItem.name }</Box>
				</Button>
			</Grid>
			<Grid item xs={2}>
				<Fade in={show}>
					<IconButton
						hidden={true}
						size="small"
						style={{ color: deepPurple[300] }}
						onMouseOver={showMenu}
						aria-label="Playlist menu">
						<MoreVertIcon/>
					</IconButton>
				</Fade>
			</Grid>
		</Grid>
  );
}
