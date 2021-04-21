import React from "react";
import { makeStyles, Theme, createStyles, withStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import PropTypes from "prop-types";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import { grey } from "@material-ui/core/colors";
import { SpotifyIcon } from "../icons";
import Tooltip from "@material-ui/core/Tooltip";
import MetricItemTooltip from "./metric_item_tooltip";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import { DARK_BG_COLOR } from "../../utils/view_constants";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(1),
    },
    labelText: {
      wrap: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    primaryListText: {
      fontWeight: 400,
    },
    secondaryListText: {
      fontWeight: 600,
    },
    mainSecondaryListText: {
      fontWeight: 600,
    },
    statItem: {
      display: "flex",
      justifyContent: "right",
      textAlign: "right",
    },
    listItemIcon: {
      display: "flex",
      justifyContent: "center",
      textAlign: "center",
      marginRight: 0,
      marginLeft: 0,
    },
  })
);

const HtmlTooltip = withStyles((theme) => ({
  tooltip: {
    backgroundColor: DARK_BG_COLOR,
    color: grey[500],
    maxWidth: 200,
    padding: 8,
  },
}))(Tooltip);

export default function MetricItemNode(props) {
  const classes = useStyles();

  function playTrack() {
    const command = {
      action: "musictime.playTrack",
      command: "command_execute",
      arguments: [props.item],
    };
    props.vscode.postMessage(command);
  }

  return (
    <List disablePadding={true} dense={true}>
      <ListItem key={`metric_rank_item_${props.item.song_name}`} disableGutters={true} dense={true} button onClick={playTrack}>
        <ListItemIcon className={classes.listItemIcon}>
          <SpotifyIcon />
        </ListItemIcon>
        <HtmlTooltip placement="bottom" title={<MetricItemTooltip vscode={props.vscode} item={props.item} />}>
          <ListItemText
            primary={props.item.song_name}
            secondary={props.item.primary_artist_name}
            classes={{ primary: classes.primaryListText, secondary: classes.mainSecondaryListText }}
          />
        </HtmlTooltip>
        <ListItemSecondaryAction className={classes.statItem}>
          <ListItemText primary="rank" secondary={props.item.song_rank} classes={{ primary: classes.labelText, secondary: classes.labelText }} />
        </ListItemSecondaryAction>
      </ListItem>
    </List>
  );
}

MetricItemNode.propTypes = {
  item: PropTypes.any.isRequired,
  vscode: PropTypes.any.isRequired,
  stateData: PropTypes.any.isRequired,
};
