import React, { useState } from "react";
import { makeStyles, withStyles } from "@material-ui/core/styles";
import { grey } from "@material-ui/core/colors";
import Grid from "@material-ui/core/Grid";
import Card from "@material-ui/core/Card";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Typography from "@material-ui/core/Typography";
import InputBase from "@material-ui/core/InputBase";
import { Chart, ScatterSeries, ArgumentAxis, ValueAxis, Tooltip } from "@devexpress/dx-react-chart-material-ui";
import { EventTracker, Animation } from "@devexpress/dx-react-chart";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    flexGrow: 1,
    overflowX: "hidden",
    background: "transparent",
    margin: 0,
  },
  cardHeader: {
    margin: 0,
    padding: 2,
  },
  cardHeaderRoot: {
    margin: 0,
    overflow: "hidden",
  },
  cardHeaderContent: {
    overflow: "hidden",
  },
  cardHeaderText: {
    fontWeight: 500,
  },
  cardHeaderIcon: {
    marginTop: 10,
    marginRight: 10,
  },
}));

const SelectInputStyle = withStyles((theme) => ({
  root: {
    "label + &": {
      marginTop: theme.spacing(1),
    },
  },
  input: {
    borderRadius: 2,
    position: "relative",
    padding: 2,
    transition: theme.transitions.create(["border-color", "box-shadow"]),
    "&:focus": {
      borderRadius: 2,
    },
  },
}))(InputBase);

export default function MetricFeatureScatterChart(props) {
  const classes = useStyles();

  const feature_keys: string[] = props.stateData.musicScatterData?.feature_keys || [];
  const initial_data: any[] = feature_keys.length ? props.stateData.musicScatterData[feature_keys[0].toLowerCase()] : [];

  const [chartData, setChartData] = useState(initial_data);
  const [selectLabel, setSelectLabel] = useState(feature_keys.length ? feature_keys[0] : null);

  const handleChange = (event) => {
    setSelectLabel(event.target.value);
    setChartData(props.stateData.musicScatterData[event.target.value.toLowerCase()]);
  };

  return (
    <Card className={classes.root} elevation={0}>
      <Grid container spacing={1}>
        <Grid item xs={12}>
          <Grid container direction="row" justify="flex-start" alignItems="flex-start">
            <Grid item xs={3}>
              <Typography style={{ color: grey[500], fontWeight: 600 }}>Feature:</Typography>
            </Grid>
            <Grid item xs={9}>
              <Select
                labelId="audio-feature-selection"
                id="audio-feature-selection"
                value={selectLabel}
                onChange={handleChange}
                input={<SelectInputStyle />}
              >
                {feature_keys.map((key, index) => {
                  return (
                    <MenuItem value={key} key={`feature-chart-key-${key}`}>
                      {key}
                    </MenuItem>
                  );
                })}
              </Select>
            </Grid>
          </Grid>
        </Grid>
        <Grid item key="scatter-chart-grid-item" xs={12} style={{ padding: 2 }}>
          <Chart data={chartData}>
            <ArgumentAxis showLabels={false} showTicks={false} />
            <ValueAxis />
            <ScatterSeries valueField="value" argumentField="name" color="#b39ddb" />
            <Animation />
            <EventTracker />
            <Tooltip />
          </Chart>
        </Grid>
      </Grid>
    </Card>
  );
}
