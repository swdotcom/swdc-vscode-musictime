import React, { useState, useEffect } from "react";
import List from "@material-ui/core/List";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import IconButton from "@material-ui/core/IconButton";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import { makeStyles } from "@material-ui/core/styles";
import { MuiCloseIcon, SlackWorkspaceIcon, MuiAddCircleIcon, MuiRemoveCircleIcon } from "../icons";
import Typography from "@material-ui/core/Typography";
import { grey } from "@material-ui/core/colors";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import Divider from "@material-ui/core/Divider";
import Tooltip from "@material-ui/core/Tooltip";
import { DARK_BG_COLOR, DARK_BG_TEXT_COLOR, DARK_BG_TEXT_SECONDARY_COLOR, MAX_MENU_HEIGHT } from "../../utils/view_constants";

const useStyles = makeStyles((theme) => ({
  root: {
    margin: 0,
    padding: 0,
  },
  listContainer: {
    marginLeft: 10,
    marginRight: 10,
    marginBottom: 0,
    marginTop: 0,
  },
  listItemIcon: {
    display: "flex",
    justifyContent: "center",
    textAlign: "center",
    minWidth: "32px",
  },
  primaryContent: {
    color: "white",
  },
  menuHeaderSecondary: {
    color: grey[500],
    fontWeight: 300,
    fontSize: 12,
  },
  secondaryAction: {
    right: 0,
  },
  cardHeaderAction: {
    color: theme.palette.secondary.main,
  },
  cardHeaderTitle: {
    color: DARK_BG_TEXT_COLOR,
  },
  cardHeaderSubheader: {
    color: DARK_BG_TEXT_SECONDARY_COLOR,
  },
}));

export default function SlackWorkspaces(props) {
  const classes = useStyles();
  const [openMenu, setOpenMenu] = useState(false);

  useEffect(() => {
    if (openMenu !== props.openMenu) {
      setOpenMenu(props.openMenu);
    }
  });

  function addSlackWorkspaceClick() {
    const command = {
      action: "musictime.connectSlackWorkspace",
      command: "command_execute",
    };
    props.vscode.postMessage(command);
  }

  function disconnectSlackWorkspaceClick(workspace) {
    const command = {
      action: "musictime.disconnectSlack",
      command: "command_execute",
      arguments: [workspace],
    };
    props.vscode.postMessage(command);
  }

  function handleClose(event = null) {
    props.handleCloseCallback();
  }

  return (
    <Menu
      id="slack_workspaces_menu"
      anchorEl={props.anchorEl}
      keepMounted
      open={openMenu}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      PaperProps={{
        style: {
          padding: 1,
          minWidth: 280,
          maxHeight: MAX_MENU_HEIGHT,
          backgroundColor: DARK_BG_COLOR,
          color: DARK_BG_TEXT_COLOR,
        },
      }}
    >
      <MenuItem key="slack-workspaces-menu_item" className={classes.root}>
        <List disablePadding={true} dense={true} className={classes.listContainer}>
          <ListItem key={`slack-workspaces-menu-li`} disableGutters={true} dense={true}>
            <ListItemText
              primary={
                <Typography noWrap className={classes.primaryContent}>
                  Slack workspaces
                </Typography>
              }
            />
          </ListItem>
        </List>
        <IconButton aria-label="Close" onClick={handleClose} style={{ position: "absolute", right: 2, top: 2 }}>
          <MuiCloseIcon />
        </IconButton>
      </MenuItem>

      <Divider style={{ background: grey[700] }} />

      <List disablePadding={true} dense={true} className={classes.root}>
        {props.stateData.slackWorkspaces.map((workspace, index) => {
          return (
            <ListItem key={`slack_workspace_li_${index}`} disableGutters={true} dense={true}>
              <ListItemIcon className={classes.listItemIcon}>
                <SlackWorkspaceIcon />
              </ListItemIcon>
              <ListItemText
                key={`slack_workspace_li_text_${index}`}
                primary={workspace.team_domain}
                secondary={workspace.team_name || null}
                classes={{ primary: classes.primaryContent }}
              />
              <ListItemSecondaryAction classes={{ root: classes.secondaryAction }}>
                <Tooltip title="Disconnect">
                  <IconButton onClick={(event) => disconnectSlackWorkspaceClick(workspace)}>
                    <MuiRemoveCircleIcon />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          );
        })}
        <ListItem key="add_workspace_li" disableGutters={true} dense={true} button onClick={addSlackWorkspaceClick}>
          <Tooltip title="Connect">
            <ListItemIcon className={classes.listItemIcon}>
              <MuiAddCircleIcon />
            </ListItemIcon>
          </Tooltip>
          <ListItemText key="add_workspace_li_text" primary="Add workspace" classes={{ primary: classes.primaryContent }} />
        </ListItem>
      </List>
    </Menu>
  );
}
