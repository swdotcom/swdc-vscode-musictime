import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import ListItemText from "@material-ui/core/ListItemText";
import { BeakerIcon, MuiShareIcon, SearchIcon, PawIcon, MuiPlayCircleOutlineIcon, MuiSubscriptionsIcon } from "../icons";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    marginLeft: -4,
    overflowX: "hidden",
    background: "transparent"
  },
  cardHeader: {
    margin: 0,
    padding: 2
  },
  cardHeaderIcon: {
    marginTop: 10,
    marginRight: 10
  },
	secondaryAction: {
    position: "absolute",
    right: 0,
    padding: 0,
    margin: 0
  }
}));

export default function ColdStart(props) {
	const classes = useStyles();

  return (
    <Card className={classes.root} elevation={0}>
      <CardHeader title="Music Time Features" className={classes.cardHeader}/>
      <Grid container>
        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem disableGutters={true} dense={true}>
              <ListItemText primary="Mood & Genre recomendations" secondary="Explore songs by mood or genre" />
              <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
                <BeakerIcon/>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Grid>
        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem disableGutters={true} dense={true}>
              <ListItemText primary="Share music" secondary="Share your top songs" />
              <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
                <MuiShareIcon/>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Grid>
        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem disableGutters={true} dense={true}>
              <ListItemText primary="Search" secondary="Search for a song or recommendations" />
              <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
                <SearchIcon/>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Grid>
        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem disableGutters={true} dense={true}>
              <ListItemText primary="Integrated player controls" secondary="Play your liked songs, playlists, recommendations, or jump right into an album" />
              <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
                <MuiPlayCircleOutlineIcon/>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Grid>
        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem disableGutters={true} dense={true}>
              <ListItemText primary="Global Top 40" secondary="Discover new music from developers around the world in our Software Top 40 playlist" />
              <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
                <MuiSubscriptionsIcon/>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Grid>
        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem disableGutters={true} dense={true}>
              <ListItemText primary="Music+Code" secondary="Explore your most productive songs, artists, and genres by productivity score" />
              <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
                <PawIcon/>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Grid>
      </Grid>
    </Card>
  );
}
