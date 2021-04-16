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
      fontWeight: 300,
    },
    secondaryListText: {
      fontWeight: 600,
    },
    statItem: {
      display: "flex",
      justifyContent: "center",
      textAlign: "center",
    },
  })
);

export default function MetricItemTooltip(props) {
  const classes = useStyles();

  return (
    <Grid container direction="row">
      <Grid item key={`metric-item-tooltip-grid-item-container`} xs={12}>
        <Grid container direction="row">
          <Grid item key={`metric-item-tooltip-grid-item-plays`} xs>
            <List dense>
              <ListItem key="plays-info" className={classes.statItem}>
                <ListItemText
                  primary="plays"
                  secondary={props.item.plays}
                  classes={{ primary: classes.primaryListText, secondary: classes.secondaryListText }}
                />
              </ListItem>
            </List>
          </Grid>
          <Grid item key={`metric-item-tooltip-grid-item-productivity`} xs>
            <List dense>
              <ListItem key="productivity-info" className={classes.statItem}>
                <ListItemText
                  primary="productivity"
                  secondary={props.item.productivity_score}
                  classes={{ primary: classes.primaryListText, secondary: classes.secondaryListText }}
                />
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
  vscode: PropTypes.any.isRequired,
};
