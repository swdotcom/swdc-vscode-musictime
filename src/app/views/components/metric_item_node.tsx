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
			overflow: "hidden",
			textOverflow: "ellipsis"
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
		<Grid container direction="row" wrap="nowrap" className={classes.gridContainer} key={props.item.song_uri}>
			<Grid item xs={7} key={`${props.item.song_uri}_metrics_label`}>
				<HtmlTooltip
					placement="bottom"
					title={
						<React.Fragment key={`${props.item.song_uri}_metric_tooltip`}>
							<Typography color="inherit" key={`${props.item.song_uri}_plays_label`}>Plays: {props.item.plays}</Typography>
							<Typography key={`${props.item.song_uri}_productivity_label`}>Productiity: {props.item.productivity_score}</Typography>
						</React.Fragment>
					}>
					<List disablePadding={true} dense={true}>
						<ListItem key={`${props.item.song_uri}_metric_name`} disableGutters={true} dense={true}>
							<div style={(props.item.primary_artist_name) ? {marginTop: -6} : {marginTop: 10}}><SpotifyIcon/></div>
							<ListItemText style={{whiteSpace: "nowrap"}}
								primary={props.item.song_name} secondary={props.item.primary_artist_name}
								classes={{primary: classes.labelText, secondary: classes.labelText}}/>
						</ListItem>
					</List>
				</HtmlTooltip>
			</Grid>
			<Grid item xs={5}>
				<Grid container direction="row" wrap="nowrap" className={classes.gridContainer}>
					<Grid item xs key={`${props.item.song_uri}_keystrokes_stat`}>
						<List disablePadding={true} dense={true}>
							<ListItem key={`${props.item.song_uri}_metric_keystrokes`} disableGutters={true} dense={true} className={classes.statItem}>
								<ListItemText primary="keystrokes" secondary={props.item.keystrokes_formatted}
									classes={{primary: classes.primaryListText, secondary: classes.secondaryListText}}/>
							</ListItem>
						</List>
					</Grid>
					<Grid item xs key={`${props.item.song_uri}_rank_stat`}>
						<List disablePadding={true} dense={true}>
							<ListItem key={`${props.item.song_uri}_metric_rank`} disableGutters={true} dense={true} className={classes.statItem}>
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
