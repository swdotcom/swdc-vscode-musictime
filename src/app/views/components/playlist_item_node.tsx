import React, { useState } from "react";
import PropTypes from 'prop-types';
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import { PlaylistIcon, TrackIcon } from "../icons";
import IconButton from "@material-ui/core/IconButton";
import Box from "@material-ui/core/Box";
import deepPurple from "@material-ui/core/colors/deepPurple";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import Fade from "@material-ui/core/Fade";

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
		}
  })
);

export default function PlaylistItemNode(props) {
  const classes = useStyles();
	const [show, setShow] = useState(false);

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

  return (
		<Grid container direction="row" justify="space-between"
			onMouseOver={showMenu}
			onMouseOut={hideMenu}
			key={item.id}>
			<Grid item xs={(item.type === "playlist") ? 11 : 10}
				className={(item.type === "playlist") ? classes.playlistName : classes.trackName}>
				<Button classes={{ root: classes.textButton }} startIcon={(item.type === "playlist") ? <PlaylistIcon /> : <TrackIcon />}>
					<Box textOverflow="ellipsis" overflow="hidden">{ item.name }</Box>
				</Button>
			</Grid>
			<Grid item xs={1} style={{marginRight: 5}}>
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

PlaylistItemNode.propTypes = {
	item: PropTypes.any.isRequired
};
