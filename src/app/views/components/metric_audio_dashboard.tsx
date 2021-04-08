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
import { BeakerIcon } from "../icons";
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

let features: any = {};

export default function MetricAudioDashboard(props) {
  const classes = useStyles();

  const metrics = props.stateData.averageMusicMetrics;
  if (metrics && metrics.valence) {
    Object.keys(metrics).forEach(key => {
      updateFeature(key, metrics[key]);
    });
  }

  const handleChange = (e, newValue) => {
    const dataId = e.target.attributes.getNamedItem("data-id");
    if (dataId) {
      const key = dataId.value;

      updateFeature(key, newValue);
    }
  };

  function updateFeature(key, value) {
    const featureInfo: any = featuresInfo.find(n => n.key === key);
    if (!featureInfo) {
      return;
    }
    if (featureInfo.max/2 > value) {
      // use the min
      features[`max_${key}`] = featureInfo.max/2;
      features[`target_${key}`] = value;
      delete features[`min_${key}`];
    } else {
      // use the max
      features[`min_${key}`] = featureInfo.max/2;
      features[`target_${key}`] = value;
      delete features[`max_${key}`];
    }
  }

  function sliderText(value) {
    return value.toFixed(2);
  }

  function generateRecommendations() {
    // gather the features
    // features = { max_loudness: -10, target_loudness: -50 };
    const command = {
      action: "musictime.getAudioFeatureRecommendations",
      command: "command_execute",
      arguments: [features]
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
              <BeakerIcon />
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
              <Grid item xs={12} key={`grid-${key}`}>
                <Grid container>
                  <Grid item xs={6}>
                    <Typography style={{fontWeight: 400}}>{key}</Typography>
                  </Grid>
                  <Grid item xs={5}>
                    <Slider
                      key={`slider-${key}`}
                      data-id={key}
                      onChange={handleChange}
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
