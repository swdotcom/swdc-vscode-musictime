import React, { useEffect, useState } from "react";
import Account from "./components/account";
import { createMuiTheme, ThemeProvider } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Setup from "./components/setup";
import ColdStart from "./components/cold_start";
import Playlists from "./components/playlists";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import BottomNavigation from "@material-ui/core/BottomNavigation";
import BottomNavigationAction from "@material-ui/core/BottomNavigationAction";
import {
  TOP_APP_BAR_MIN_HEIGHT,
  BOTTOM_BAR_HEIGHT,
  DARK_BG_COLOR
} from "../utils/view_constants";
import { PlaylistIcon, BeakerIcon, TrackIcon } from "./icons";
import grey from "@material-ui/core/colors/grey";
import deepPurple from "@material-ui/core/colors/deepPurple";

const useStyles = makeStyles((theme) => ({
  gridItem: {
    marginLeft: 10,
    marginRight: 10
  },
  gridItemSetup: {
    marginTop: 1,
    marginButtom: 10,
    background: "linear-gradient(#6879F5, #976AF7)"
  },
  playlistGridItem: {
    marginLeft: 10,
    marginRight: 10
  },
  bottomNav: {
    background: "transparent",
    flexGrow: 1,
    width: "100%",
    margin: 0
  },
  topAppBar: {
    background: DARK_BG_COLOR,
    top: 0,
    padding: 0,
    margin: 0,
    minHeight: `${TOP_APP_BAR_MIN_HEIGHT}px`
  },
  bottomAppBar: {
    height: `${BOTTOM_BAR_HEIGHT}px`,
    background: DARK_BG_COLOR,
    top: "auto",
    bottom: 0,
    padding: 0,
    margin: 0
  },
}));

const getHeight = () => window.innerHeight
  || document.documentElement.clientHeight
  || document.body.clientHeight;

function useCurrentHeight() {
  // save current window width in the state object
  let [height, setHeight] = useState(getHeight());

  // in this case useEffect will execute only once because
  // it does not have any dependencies.
  useEffect(() => {
    const resizeListener = () => {
      // change width from the state object
      setHeight(getHeight())
    };
    // set resize listener
    window.addEventListener("resize", resizeListener);

    // clean up function
    return () => {
      // remove resize listener
      window.removeEventListener("resize", resizeListener);
    }
  }, [])

  return height;
}

export default function SideBar(props) {
  const classes = useStyles();

  const [value, setValue] = React.useState("playlists");

  const currentColorKind = props.stateData.currentColorKind;
  const prefersDarkMode = !!(currentColorKind === 2);

  const theme = React.useMemo(
    () =>
      createMuiTheme({
        typography: {
          fontFamily: [
            "Inter",
            "-apple-system",
            "BlinkMacSystemFont",
            "Segoe UI",
            "Roboto",
            "Oxygen",
            "Ubuntu",
            "Cantarell",
            "Fira Sans",
            "Droid Sans",
            "Helvetica Neue",
            "sans-serif",
          ].join(","),
          fontSize: 12,
          fontWeightLight: 400,
          fontWeightRegular: 500,
          fontWeightMedium: 600,
        },
        palette: {
          type: prefersDarkMode ? "dark" : "light",
          primary: deepPurple,
        },
        overrides: {
          MuiGrid: {
            root: {
              flexGrow: 1,
              width: "100%",
              margin: 0,
              padding: 0,
              backgroundColor: "transparent",
            }
          },
          MuiButton: {
            root: {
              minHeight: 0,
              minWidth: 0,
              width: "100%",
              textTransform: "none",
              whiteSpace: "nowrap",
              fontSize: 12,
            },
            contained: {
              padding: 5,
            },
            label: {
              padding: 1,
              margin: 1,
            },
          },
          MuiCard: {
            root: {
              padding: 4,
              margin: 2,
              width: "100%",
            },
          },
          MuiCardContent: {
            root: {
              width: "100%",
              paddingTop: 8,
              paddingBottom: 8,
              paddingLeft: 16,
              paddingRight: 16,
              "&:last-child": {
                paddingBottom: 24,
              }
            },
          },
          MuiDivider: {
            root: {
              width: "100%",
              marginTop: 4,
              marginBottom: 4,
            },
          },
          MuiList: {
            root: {
              width: "100%"
            }
          },
          MuiListItemText: {
            root: {
              marginTop: 0,
            },
            primary: {
              fontWeight: 500,
              fontSize: 12,
            },
            secondary: {
              color: grey[500],
            },
          },
          MuiListItemSecondaryAction: {
            root: {
              right: 0
            }
          },
          MuiBottomNavigationAction: {
            label: {
              color: grey[100],
              fontWeight: 600
            }
          }
        },
      }),
    [prefersDarkMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <React.Fragment>
      <CssBaseline />
      <AppBar position="fixed" className={classes.topAppBar} id="top-app-bar">
        <Grid container>
          {(!props.stateData.registered || (!props.stateData.spotifyUser)) && (
            <Grid item xs={12} className={classes.gridItemSetup}>
              <Setup stateData={props.stateData} vscode={props.vscode} />
            </Grid>
          )}
          {props.stateData.registered && (<Grid item xs={12} className={classes.gridItem}>
            <Account vscode={props.vscode} stateData={props.stateData} />
          </Grid>)}
        </Grid>
      </AppBar>
      <Grid container
        style={{
          position: "absolute",
          overflowX: "hidden",
          top: TOP_APP_BAR_MIN_HEIGHT,
          bottom: BOTTOM_BAR_HEIGHT}}>

        {!props.stateData.spotifyUser && (<Grid item xs={12} className={classes.gridItem}>
          <ColdStart vscode={props.vscode} stateData={props.stateData}/>
        </Grid>)}

        {props.stateData.spotifyUser && (
        <Grid item xs={12} className={classes.playlistGridItem}>
          <Playlists vscode={props.vscode} stateData={props.stateData}/>
        </Grid>)}

        {/* {props.stateData.spotifyUser && (<Divider />)} */}

        {/* {props.stateData.spotifyUser && (<Grid item xs={12} className={classes.gridItem}>
          <MediaControl vscode={props.vscode} stateData={props.stateData}/>
        </Grid>)} */}

      </Grid>

      <AppBar position="fixed" className={classes.bottomAppBar}>

        <Toolbar variant="dense" disableGutters={true} style={{background: "transparent"}}>
          <BottomNavigation
            value={value}
            onChange={(event, newValue) => {
              setValue(newValue);
            }}
            className={classes.bottomNav}>
            <BottomNavigationAction label="Playlists" value="playlists" icon={<PlaylistIcon fontSize="large"/>} />
            <BottomNavigationAction label="Recommendations" value="recommendations" icon={<BeakerIcon fontSize="large"/>} />
            <BottomNavigationAction label="Track" value="track" icon={<TrackIcon fontSize="large"/>} />
          </BottomNavigation>
        </Toolbar>
      </AppBar>
      </React.Fragment>
    </ThemeProvider>
  );
}
