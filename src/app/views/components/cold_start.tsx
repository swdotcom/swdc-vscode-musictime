import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import IconButton from "@material-ui/core/IconButton";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import ListItemText from "@material-ui/core/ListItemText";
import QueueIcon from "@material-ui/icons/Queue";
import { BeakerIcon, ShareIcon, SearchIcon, PawIcon } from "../icons";
import deepPurple from "@material-ui/core/colors/deepPurple";

const useStyles = makeStyles((theme) => ({
	secondaryAction: {
    right: 0,
  },
}));

export default function ColdStart(props) {
	const classes = useStyles();

  return (
    <Grid container>
      <Grid item xs={12}>
				<List disablePadding={true} dense={true}>
          <ListItem disableGutters={true} dense={true}>
            <ListItemText primary="Mood & Genre recomendations" secondary="Explore songs by mood or genre" />
            <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
              <IconButton
                size="small"
                edge="end"
                aria-label="Explore songs by mood or genre">
                <BeakerIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
			</Grid>
			<Grid item xs={12}>
				<List disablePadding={true} dense={true}>
          <ListItem disableGutters={true} dense={true}>
            <ListItemText primary="Share music" secondary="Share your top songs" />
            <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
              <IconButton
                size="small"
                edge="end"
                aria-label="Share your top songs">
                <ShareIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
			</Grid>
			<Grid item xs={12}>
				<List disablePadding={true} dense={true}>
          <ListItem disableGutters={true} dense={true}>
            <ListItemText primary="Search" secondary="Search for a song or recommendations" />
            <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
              <IconButton
                size="small"
                edge="end"
                aria-label="Search for a song or recommendations">
                <SearchIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
			</Grid>
      <Grid item xs={12}>
				<List disablePadding={true} dense={true}>
          <ListItem disableGutters={true} dense={true}>
            <ListItemText primary="Play an Album" secondary="Jump right into an album" />
            <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
              <IconButton
                size="small"
                edge="end"
                aria-label="Jump right into an album">
                <SearchIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
			</Grid>
      <Grid item xs={12}>
				<List disablePadding={true} dense={true}>
          <ListItem disableGutters={true} dense={true}>
            <ListItemText primary="Music metrics" secondary="Explore your most productive songs, artists, and genres by productivity score" />
            <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
              <IconButton
                size="small"
                edge="end"
                aria-label="Explore your most productive songs, artists, and genres by productivity score">
                <PawIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
			</Grid>
      <Grid item xs={12}>
				<List disablePadding={true} dense={true}>
          <ListItem disableGutters={true} dense={true}>
            <ListItemText primary="Queue songs" secondary="Queue songs into a daily or permanent playlist" />
            <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
              <IconButton
                size="small"
                edge="end"
                aria-label="Queue songs into a daily or permanent playlist">
                <QueueIcon style={{ color: deepPurple[300] }}/>
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
			</Grid>
    </Grid>
  );
}
