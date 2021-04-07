import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import { indigo } from "@material-ui/core/colors";
import Slider from "@material-ui/core/Slider";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    overflow: "hidden",
    background: "transparent",
  },
  cardHeaderRoot: {
    margin: 0,
    padding: 2,
    overflow: "hidden",
  },
  cardHeaderContent: {
    overflow: "hidden",
  },
  cardHeaderText: {
    color: indigo[300],
    fontWeight: 500,
  },
  cardHeaderIcon: {
    marginTop: 10,
    marginRight: 10,
  },
  loadingIcon: {
    marginTop: 80,
    display: "flex",
    justifyContent: "center",
    textAlign: "center",
  },
  headerActionButtons: {
    marginTop: 10,
    marginRight: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    "& > *": {
      margin: theme.spacing(1),
    },
  },
}));

const featuresInfo = [
  {
    key: "acousticness",
    min: 0,
    max: 1,
    step: .1
  },
  {
    key: "danceability",
    min: 0,
    max: 1,
    step: .1
  },
  {
    key: "energy",
    min: 0,
    max: 1,
    step: .1
  },
  {
    key: "instrumentalness",
    min: 0,
    max: 1,
    step: .1
  },
  {
    key: "liveness",
    min: 0,
    max: 1,
    step: .1
  },
  {
    key: "loudness",
    min: -200,
    max: 200,
    step: 10
  },
  {
    key: "speechiness",
    min: 0,
    max: 1,
    step: .1
  },
  {
    key: "tempo",
    min: 0,
    max: 200,
    step: 10
  },
  {
    key: "valence",
    min: 0,
    max: 1,
    step: .1
  },
];

export default function Recommendations(props) {
  const classes = useStyles();

  return (
    <Card className={classes.root}>
      <CardHeader
        classes={{
          root: classes.cardHeaderRoot,
          content: classes.cardHeaderContent,
        }}
      />
      <Grid container>
        <Grid item xs={12}>
          {props.stateData.averageMusicMetrics && props.stateData.averageMusicMetrics.valence ? (
            Object.keys(props.stateData.averageMusicMetrics).map((key) => {
              const featureInfo: any = featuresInfo.find(n => n.key === key);
              const marks = [
                {
                  value: featureInfo.min,
                  label: `${featureInfo.min}`,
                },
                {
                  value: featureInfo.max,
                  label: `${featureInfo.max}`
                }
              ];

              return (
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography style={{fontWeight: 400}}>{key}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Slider
                      defaultValue={props.stateData.averageMusicMetrics[key]}
                      min={featureInfo.min}
                      max={featureInfo.max}
                      step={featureInfo.step}
                      marks={marks}
                    />
                  </Grid>
                </Grid>
              );
            })
          ) : (
            <Typography>No features available</Typography>
          )}
        </Grid>
      </Grid>
    </Card>
  );
}
