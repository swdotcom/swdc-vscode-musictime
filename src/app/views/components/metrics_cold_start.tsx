import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import ListItemText from "@material-ui/core/ListItemText";
import { BeakerIcon } from "../icons";
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

export default function MetricsColdStart(props) {
	const classes = useStyles();

  return (
    <Card className={classes.root}>
      <CardHeader title="Music + Coding Features" className={classes.cardHeader}/>
      <Grid container>
        <Grid item xs={12}>
          <List disablePadding={true} dense={true}>
            <ListItem disableGutters={true} dense={true}>
              <ListItemText primary="Productivity ranking"
								secondary="Music Time works with Code Time to combine your music and coding data to find your most productive music" />
              <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
                <BeakerIcon/>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Grid>
      </Grid>
    </Card>
  );
}
