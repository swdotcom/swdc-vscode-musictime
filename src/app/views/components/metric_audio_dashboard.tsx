import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import Slider from "@material-ui/core/Slider";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Divider from "@material-ui/core/Divider";
import { MuiMusicNoteIcon } from "../icons";
import { indigo } from "@material-ui/core/colors";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    overflow: "hidden",
    background: "transparent",
  },
  headerText: {
    display: "flex",
    justifyContent: "center",
    textAlign: "center",
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

export default function MetricAudioDashboard(props) {
  const classes = useStyles();

  function sliderText(value) {
    return value.toFixed(2);
  }

  function generateRecommendations() {
    const command = {
      action: "musictime.generateFeatureRecommendations",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  return (
    <Card className={classes.root} elevation={0}>
      <CardHeader
        classes={{
          root: classes.cardHeaderRoot,
          content: classes.cardHeaderContent,
        }}
        action={
          <Tooltip title="Generate recommendations">
            <IconButton aria-label="recommendations" onClick={generateRecommendations}>
              <MuiMusicNoteIcon />
            </IconButton>
          </Tooltip>
        }
        title={
          <Typography noWrap gutterBottom={false} className={classes.cardHeaderText}>
            Your audio features
          </Typography>
        }
        subheader="Generate recommendations"
      />
      <Divider />
      <Grid container>
        {props.stateData.averageMusicMetrics && props.stateData.averageMusicMetrics.valence && (
          Object.keys(props.stateData.averageMusicMetrics).map((key, index) => {
            const featureInfo: any = featuresInfo.find(n => n.key === key);
            const defaultVal = parseFloat(props.stateData.averageMusicMetrics[key].toFixed(2));
            return (
              <Grid item xs={12}>
                <Grid container>
                  <Grid item xs={6}>
                    <Typography style={{fontWeight: 400}}>{key}</Typography>
                  </Grid>
                  <Grid item xs={5}>
                    <Slider
                      defaultValue={defaultVal}
                      getAriaValueText={sliderText}
                      min={featureInfo.min}
                      max={featureInfo.max}
                      step={featureInfo.step}
                      valueLabelDisplay="auto"
                      marks
                    />
                  </Grid>
                </Grid>
              </Grid>
            );
          })
        )}
      </Grid>
    </Card>
  );
}
