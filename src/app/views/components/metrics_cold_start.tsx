import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import { BeakerIcon, MuiEmojiEventsIcon } from "../icons";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Typography from "@material-ui/core/Typography";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    padding: 0,
    margin: 0,
    overflowX: "hidden",
    background: "transparent",
  },
  cardHeader: {
    margin: 0,
    padding: 2,
  },
  cardHeaderText: {
    color: "#FFF",
    fontWeight: 500,
  },
  listItemIcon: {
    display: "flex",
    justifyContent: "center",
    textAlign: "center",
    marginRight: 0,
    marginLeft: 0,
  },
}));

export default function MetricsColdStart(props) {
  const classes = useStyles();

  return (
    <Card className={classes.root} elevation={0}>
      <CardHeader
        className={classes.cardHeader}
        title={
          <Typography noWrap gutterBottom={false} className={classes.cardHeaderText}>
            Metrics
          </Typography>
        }
      />
      <Grid container>
        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem key="play-info-item" disableGutters={true} dense={true}>
              <ListItemIcon className={classes.listItemIcon}>
                <MuiEmojiEventsIcon />
              </ListItemIcon>
              <ListItemText
                primary="Productivity ranking"
                secondary="Music Time works with Code Time to combine your music and coding data to find your most productive music"
              />
            </ListItem>
          </List>
        </Grid>

        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem key="play-info-item" disableGutters={true} dense={true}>
              <ListItemIcon className={classes.listItemIcon}>
                <BeakerIcon />
              </ListItemIcon>
              <ListItemText
                primary="Your audio metrics"
                secondary="You can view how your audio features such as instrumentalness, energy, valence, and more are averaging"
              />
            </ListItem>
          </List>
        </Grid>
      </Grid>
    </Card>
  );
}
