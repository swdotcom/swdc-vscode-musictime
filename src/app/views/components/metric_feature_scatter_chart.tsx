import React, { useState } from "react";
import { makeStyles, withStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Card from "@material-ui/core/Card";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import InputBase from "@material-ui/core/InputBase";
import { Chart, ScatterSeries, ArgumentAxis, ValueAxis, Tooltip } from "@devexpress/dx-react-chart-material-ui";
import { Animation } from "@devexpress/dx-react-chart";

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
    fontSize: 16,
    padding: 2,
    minWidth: 120,
    transition: theme.transitions.create(["border-color", "box-shadow"]),
    "&:focus": {
      borderRadius: 4,
      boxShadow: "0 0 0 0.2rem rgba(0,123,255,.25)",
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
      <Grid container spacing={1} style={{ textAlign: "center", justifyContent: "center" }}>
        <Grid item xs={12} style={{ textAlign: "center", justifyContent: "center" }}>
          <Select
            labelId="demo-customized-select-label"
            id="demo-customized-select"
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
        <Grid item key="scatter-chart-grid-item" xs={12} zeroMinWidth={true} style={{ marginBottom: 50 }}>
          <Chart data={chartData}>
            <ArgumentAxis showLabels={false} showTicks={false} />
            <ValueAxis />
            <ScatterSeries valueField="value" argumentField="name" />
            <Animation />
            <Tooltip />
          </Chart>
        </Grid>
      </Grid>
    </Card>
  );
}
