import React from "react";
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import ListItem from "@material-ui/core/ListItem";
import PropTypes from "prop-types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    labelText: {
      wrap: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    primaryListText: {
      fontWeight: 700,
      color: "white",
    },
    mainSecondaryListText: {
      fontWeight: 500,
      wrap: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    statItem: {
      display: "flex",
      justifyContent: "right",
      textAlign: "right"
    },
  })
);

export default function MetricItemTooltip(props) {
  const classes = useStyles();

  return (
    <List disablePadding={true} dense={true}>
      <ListItem key={`metric-item-tooltip-grid-item-container`} disableGutters={true} dense={true}>
        <ListItemText
          primary="Active Code Time"
          secondary={Math.max((props.item.active_codetime_seconds / 60), 1).toFixed(0) + "m"}
          classes={{ primary: classes.primaryListText, secondary: classes.mainSecondaryListText }}
          style={{ paddingRight: 50 }}
        />
        <ListItemSecondaryAction className={classes.statItem}>
          <ListItemText primary="Plays" secondary={props.item.song_plays}
          classes={{ primary: classes.primaryListText, secondary: classes.mainSecondaryListText }} />
        </ListItemSecondaryAction>
      </ListItem>
    </List>
  );
}

MetricItemTooltip.propTypes = {
  item: PropTypes.any.isRequired,
  vscode: PropTypes.any.isRequired,
};
