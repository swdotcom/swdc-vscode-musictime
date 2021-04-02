import React from "react";
import Account from "./components/account";
import { createMuiTheme, ThemeProvider } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";
import blue from "@material-ui/core/colors/blue";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import grey from "@material-ui/core/colors/grey";
import Setup from "./components/setup";
import ColdStart from "./components/cold_start";
import Playlists from "./components/playlists";

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
}));

export default function SideBar(props) {
  const classes = useStyles();

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
            '"Segoe UI"',
            "Roboto",
            "Oxygen",
            "Ubuntu",
            "Cantarell",
            "Fira Sans",
            "Droid Sans",
            '"Helvetica Neue"',
            "sans-serif",
          ].join(","),
          fontSize: 12,
          fontWeightLight: 400,
          fontWeightRegular: 500,
          fontWeightMedium: 600,
        },
        palette: {
          type: prefersDarkMode ? "dark" : "light",
          primary: blue,
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
              fontWeight: 600,
              fontSize: 14,
            },
            secondary: {
              color: grey[500],
            },
          },
          MuiListItemSecondaryAction: {
            root: {
              right: 0
            }
          }
        },
      }),
    [prefersDarkMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Grid container>
        {(!props.stateData.registered || (!props.stateData.spotifyUser)) && (
          <Grid item xs={12} className={classes.gridItemSetup}>
            <Setup stateData={props.stateData} vscode={props.vscode} />
          </Grid>
        )}

        {props.stateData.registered && (<Grid item xs={12} className={classes.gridItem}>
          <Account vscode={props.vscode} stateData={props.stateData} />
        </Grid>)}

        {!props.stateData.spotifyUser && (<Grid item xs={12} className={classes.gridItem}>
          <ColdStart vscode={props.vscode} stateData={props.stateData}/>
        </Grid>)}

        {props.stateData.spotifyUser && (<Grid item xs={12} className={classes.gridItem}>
          <Playlists vscode={props.vscode} stateData={props.stateData}/>
        </Grid>)}

      </Grid>
    </ThemeProvider>
  );
}
