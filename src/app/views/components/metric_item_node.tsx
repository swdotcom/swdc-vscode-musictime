import React from "react";
import { makeStyles, Theme, createStyles, withStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import PropTypes from "prop-types";
import Grid from "@material-ui/core/Grid";
import blue from "@material-ui/core/colors/blue";
import { SpotifyIcon } from "../icons";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
		labelText: {
			wrap: "nowrap",
			overflow: "hidden"
		},
		primaryListText: {
			fontWeight: 300
		},
		secondaryListText: {
			fontWeight: 600
		},
		mainSecondaryListText: {
			fontWeight: 600,
			color: blue[500],
		},
		gridContainer: {
			margin: 0,
			adding: 0
		},
		statItem: {
			display: "flex",
			justifyContent: "center",
			textAlign: "center"
		}
  })
);

const HtmlTooltip = withStyles((theme) => ({
  tooltip: {
		backgroundColor: '#f5f5f9',
    color: 'rgba(0, 0, 0, 0.87)',
		maxWidth: 200,
    fontSize: theme.typography.pxToRem(12),
  },
}))(Tooltip);

export default function MetricItemNode(props) {
	const classes = useStyles();


	// maybe use justify="space-between"
  return (
		<Grid container direction="row" wrap="nowrap" className={classes.gridContainer}>
			<Grid item xs={7}>
				<HtmlTooltip
					placement="bottom"
					title={
						<React.Fragment>
							<Typography color="inherit">Plays: {props.item.plays}</Typography>
							Mood: Danceability
						</React.Fragment>
					}>
					<List disablePadding={true} dense={true}>
						<ListItem disableGutters={true} dense={true}>
							<SpotifyIcon />
							<ListItemText style={{whiteSpace: "nowrap"}}
								primary={props.item.primary_artist_name} secondary={props.item.song_name}
								classes={{primary: classes.labelText, secondary: classes.labelText}}/>
						</ListItem>
					</List>
				</HtmlTooltip>
			</Grid>
			<Grid item xs={5}>
				<Grid container direction="row" wrap="nowrap" className={classes.gridContainer}>
					<Grid item xs>
						<List disablePadding={true} dense={true}>
							<ListItem disableGutters={true} dense={true} className={classes.statItem}>
								<ListItemText primary="productivity" secondary={props.item.productivity_score}
									classes={{primary: classes.primaryListText, secondary: classes.secondaryListText}}/>
							</ListItem>
						</List>
					</Grid>
					<Grid item xs>
						<List disablePadding={true} dense={true}>
							<ListItem disableGutters={true} dense={true} className={classes.statItem}>
								<ListItemText primary="rank" secondary={props.item.song_rank}
									classes={{primary: classes.primaryListText, secondary: classes.mainSecondaryListText}}/>
							</ListItem>
						</List>
					</Grid>
				</Grid>
			</Grid>
		</Grid>
  );
}

MetricItemNode.propTypes = {
	item: PropTypes.any.isRequired,
	vscode: PropTypes.any.isRequired
};
