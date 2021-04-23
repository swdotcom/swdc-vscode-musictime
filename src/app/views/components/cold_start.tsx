import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import { BeakerIcon, MuiSearchIcon, PawIcon, MuiPlayCircleOutlineIcon, MuiSubscriptionsIcon, PlaylistIcon } from "../icons";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import ListItemIcon from "@material-ui/core/ListItemIcon";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    overflowX: "hidden",
    background: "transparent",
  },
  cardHeader: {
    margin: 0,
    padding: 2,
  },
  cardHeaderIcon: {
    marginTop: 10,
    marginRight: 10,
  },
  listItemIcon: {
    display: "flex",
    justifyContent: "center",
    textAlign: "center",
    marginRight: 0,
    marginLeft: 0,
  },
}));

export default function ColdStart(props) {
  const classes = useStyles();

  return (
    <Card className={classes.root} elevation={0}>
      <CardHeader title="Music Time Features" className={classes.cardHeader} />

      <Grid container>
        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem key="play-info-item" disableGutters={true} dense={true}>
              <ListItemIcon className={classes.listItemIcon}>
                <MuiPlayCircleOutlineIcon />
              </ListItemIcon>
              <ListItemText primary="Control your music" secondary="Play, pause, and skip from the VS Code status bar" />
            </ListItem>
          </List>
        </Grid>

        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem key="play-info-item" disableGutters={true} dense={true}>
              <ListItemIcon className={classes.listItemIcon}>
                <PlaylistIcon />
              </ListItemIcon>
              <ListItemText primary="Browse your playlists" secondary="Browse all your music without leaving VS Code" />
            </ListItem>
          </List>
        </Grid>

        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem key="mood-info-item" disableGutters={true} dense={true}>
              <ListItemIcon className={classes.listItemIcon}>
                <BeakerIcon />
              </ListItemIcon>
              <ListItemText primary="Discover new music" secondary="Get song recommendations based on mood and genre" />
            </ListItem>
          </List>
        </Grid>

        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem key="search-info-item" disableGutters={true} dense={true}>
              <ListItemIcon className={classes.listItemIcon}>
                <MuiSearchIcon />
              </ListItemIcon>
              <ListItemText primary="Search for songs" secondary="Search and add songs to playlists right from VS Code" />
            </ListItem>
          </List>
        </Grid>

        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem key="global-info-item" disableGutters={true} dense={true}>
              <ListItemIcon className={classes.listItemIcon}>
                <MuiSubscriptionsIcon />
              </ListItemIcon>
              <ListItemText primary="Listen to the Global Top 40" secondary="Listen to the top music from developers around the world" />
            </ListItem>
          </List>
        </Grid>

        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem key="productivity-info-item" disableGutters={true} dense={true}>
              <ListItemIcon className={classes.listItemIcon}>
                <PawIcon />
              </ListItemIcon>
              <ListItemText primary="Explore your data" secondary="See your top songs and artists based on your coding activity" />
            </ListItem>
          </List>
        </Grid>
      </Grid>
    </Card>
  );
}
