import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import Slider from "@material-ui/core/Slider";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Divider from "@material-ui/core/Divider";
import Checkbox from "@material-ui/core/Checkbox";
import { BeakerIcon, MuiRefreshIcon } from "../icons";
import { grey } from "@material-ui/core/colors";
import FormGroup from "@material-ui/core/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import FormControl from "@material-ui/core/FormControl";
import ScatterChart from "./metric_feature_scatter_chart";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    margin: 0,
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
    fontWeight: 500,
  },
  cardSubHeaderText: {
    fontWeight: 400,
    color: grey[500],
    fontSize: 12,
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
  },
}));

const featuresInfo = [
  {
    key: "acousticness",
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: "danceability",
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: "energy",
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: "instrumentalness",
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: "liveness",
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: "loudness",
    min: -200,
    max: 200,
    step: 10,
  },
  {
    key: "speechiness",
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: "tempo",
    min: 0,
    max: 200,
    step: 10,
  },
  {
    key: "valence",
    min: 0,
    max: 1,
    step: 0.1,
  },
];

let features: any = {};

export default function MetricAudioDashboard(props) {
  const classes = useStyles();
  const featureNames = featuresInfo.map((n) => n.key);
  const [checked, setChecked] = useState(featureNames);

  if (props.audioFeatures && Object.keys(props.audioFeatures).length) {
    Object.keys(props.audioFeatures).forEach((key) => {
      updateFeature(key, props.audioFeatures[key]);
    });
  }

  const handleSliderChange = (e, newValue, key) => {
    updateFeature(key, newValue);

    // update the state data
    props.audioFeatures[key] = newValue;
  };

  function updateFeature(key, value) {
    const featureInfo: any = featuresInfo?.find((n) => n.key === key);
    if (!featureInfo) {
      return;
    }
    if (featureInfo.max / 2 > value) {
      // use the min
      features[`max_${key}`] = featureInfo.max / 2;
      features[`target_${key}`] = value;
      delete features[`min_${key}`];
    } else {
      // use the max
      features[`min_${key}`] = featureInfo.max / 2;
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
    const selectedFeatureData = {};
    for (const feature of checked) {
      if (features[`min_${feature}`]) {
        selectedFeatureData[`min_${feature}`] = features[`min_${feature}`];
      }
      if (features[`max_${feature}`]) {
        selectedFeatureData[`max_${feature}`] = features[`max_${feature}`];
      }
      if (features[`target_${feature}`]) {
        selectedFeatureData[`target_${feature}`] = features[`target_${feature}`];
      }
    }

    const command = {
      action: "musictime.getAudioFeatureRecommendations",
      command: "command_execute",
      arguments: [selectedFeatureData],
    };
    props.vscode.postMessage(command);
  }

  const handleToggle = (value) => () => {
    const currentIndex = checked.indexOf(value);
    const newChecked = [...checked];

    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setChecked(newChecked);
  };

  function refreshFeatureData() {
    props.resetAudioFeatures();
  }

  return (
    <Card className={classes.root} elevation={0}>
      <CardHeader
        classes={{
          root: classes.cardHeaderRoot,
          content: classes.cardHeaderContent,
        }}
        action={
          <div className={classes.headerActionButtons}>
            <Tooltip title="Reset">
              <IconButton aria-label="recommendations" onClick={refreshFeatureData}>
                <MuiRefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Generate recommendations">
              <IconButton aria-label="recommendations" onClick={generateRecommendations}>
                <BeakerIcon />
              </IconButton>
            </Tooltip>
          </div>
        }
        title={
          <Typography noWrap gutterBottom={false} className={classes.cardHeaderText}>
            Your audio features
          </Typography>
        }
        subheader={
          <Typography noWrap gutterBottom={false} className={classes.cardSubHeaderText}>
            Generate recommendations
          </Typography>
        }
      />
      <Divider />
      <Grid container spacing={1}>
        <Grid item key="audio-container-grid-item" xs={12} zeroMinWidth={true}>
          {props.audioFeatures &&
            Object.keys(props.audioFeatures).length &&
            Object.keys(props.audioFeatures).map((key, index) => {
              const featureInfo: any = featuresInfo?.find((n) => n.key === key);
              const defaultVal = parseFloat(props.audioFeatures[key].toFixed(2));
              return (
                <Grid item xs={12} key={`audio-grid-item-${key}`}>
                  <Grid container>
                    <Grid item key={`audio-grid-form-item-${key}`} xs={7}>
                      <FormControl component="fieldset">
                        <FormGroup aria-label="position" row>
                          <FormControlLabel
                            key={`audio-form-control-${key}`}
                            style={{ marginLeft: 4 }}
                            value="end"
                            control={
                              <Checkbox
                                color="primary"
                                key={`audio-form-control-checkbox-${key}`}
                                edge="start"
                                onClick={handleToggle(key)}
                                checked={checked.indexOf(key) !== -1}
                                tabIndex={-1}
                                disableRipple
                                inputProps={{ "aria-labelledby": key }}
                              />
                            }
                            label={key}
                            labelPlacement="end"
                          />
                        </FormGroup>
                      </FormControl>
                    </Grid>
                    <Grid item key={`audio-grid-slider-item-${key}`} xs={4} style={{ marginTop: 6, marginRight: 0 }}>
                      <Slider
                        key={`slider-${key}`}
                        name={key}
                        data-id={key}
                        data-tag={key}
                        onChange={(event, value) => handleSliderChange(event, value, key)}
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
            })}
        </Grid>
        <Grid>
          <ScatterChart vscode={props.vscode} stateData={props.stateData} />
        </Grid>
      </Grid>
    </Card>
  );
}
