import React from "react";
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import PropTypes from "prop-types";
import Grid from "@material-ui/core/Grid";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
		primaryListText: {
			fontWeight: 300
		},
		secondaryListText: {
			fontWeight: 600
		},
		statItem: {
			display: "flex",
			justifyContent: "center",
			textAlign: "center"
		}
  })
);

export default function MetricItemTooltip(props) {
	const classes = useStyles();


	// maybe use justify="space-between"
  return (
		<Grid container direction="row">
			<Grid item xs={12}>
				<Grid container direction="row">
					<Grid item xs>
						<List>
							<ListItem className={classes.statItem}>
								<ListItemText primary="plays" secondary={props.item.plays}
									classes={{primary: classes.primaryListText, secondary: classes.secondaryListText}}/>
							</ListItem>
						</List>
					</Grid>
					<Grid item xs>
						<List>
							<ListItem className={classes.statItem}>
								<ListItemText primary="productiity" secondary={props.item.productivity_score}
									classes={{primary: classes.primaryListText, secondary: classes.secondaryListText}}/>
							</ListItem>
						</List>
					</Grid>
				</Grid>
			</Grid>
		</Grid>
  );
}

MetricItemTooltip.propTypes = {
	item: PropTypes.any.isRequired,
	vscode: PropTypes.any.isRequired
};
