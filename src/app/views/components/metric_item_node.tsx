import React from "react";
import { makeStyles, Theme, createStyles, withStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import PropTypes from "prop-types";
import Grid from "@material-ui/core/Grid";
import { grey } from "@material-ui/core/colors";
import { SpotifyIcon } from "../icons";
import Tooltip from "@material-ui/core/Tooltip";
import MetricItemTooltip from "./metric_item_tooltip";
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
      color: "#FFF",
    },
    statItem: {
      display: "flex",
      justifyContent: "right",
      textAlign: "right",
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
    <Grid key="metric_node_grid" container direction="row" wrap="nowrap" className={classes.root}>
      <Grid key="metric_node_item" item xs={7}>
        <HtmlTooltip placement="bottom" title={<MetricItemTooltip vscode={props.vscode} item={props.item} />}>
          <List disablePadding={true} dense={true}>
            <ListItem key={props.item.song_name} button disableGutters={true} dense={true} onClick={playTrack}>
              <SpotifyIcon />
              <ListItemText
                style={{ whiteSpace: "nowrap" }}
                primary={props.item.song_name}
                secondary={props.item.primary_artist_name}
                classes={{ primary: classes.labelText, secondary: classes.labelText }}
              />
            </ListItem>
          </List>
        </HtmlTooltip>
      </Grid>
      <Grid item key={`metric-grid-item-rank-${props.item.song_rank}`} xs={5}>
        <List disablePadding={true} dense={true}>
          <ListItem key={props.item.song_rank} disableGutters={true} dense={true} className={classes.statItem}>
            <ListItemText
              primary="rank"
              secondary={props.item.song_rank}
              classes={{ primary: classes.primaryListText, secondary: classes.mainSecondaryListText }}
            />
          </ListItem>
        </List>
      </Grid>
    </Grid>
  );
}

MetricItemNode.propTypes = {
  item: PropTypes.any.isRequired,
  vscode: PropTypes.any.isRequired,
  stateData: PropTypes.any.isRequired,
};
