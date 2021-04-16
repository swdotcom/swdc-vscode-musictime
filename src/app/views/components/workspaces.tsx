import React from "react";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import TreeView from "@material-ui/lab/TreeView";
import TreeItem, { TreeItemProps } from "@material-ui/lab/TreeItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import ArrowRightIcon from "@material-ui/icons/ArrowRight";
import { SvgIconProps } from "@material-ui/core/SvgIcon";
import IconButton from "@material-ui/core/IconButton";
import { SlackWorkspaceIcon, SlackFolderIcon, MuiRemoveCircleTwoToneIcon, MuiControlPointTwoToneIcon } from "../icons";

let vscode = null;

type StyledTreeItemProps = TreeItemProps & {
  labelIcon?: React.ElementType<SvgIconProps>;
  labelText: string;
  isWorkspace?: boolean;
  isLeaf?: boolean;
  authId?: string;
};

function removeWorkspaceClickHandler(authId: string) {
  const command = {
    action: "codetime.disconnectSlackWorkspace",
    command: "command_execute",
    arguments: [authId],
  };
  vscode.postMessage(command);
}

function StyledTreeItem(props: StyledTreeItemProps) {
  const { labelText, labelIcon: LabelIcon, isWorkspace, isLeaf, authId, ...other } = props;

  return (
    <TreeItem
      icon={isLeaf && LabelIcon && <LabelIcon />}
      label={
        <Grid container style={{ padding: 0 }}>
          <Grid item xs={11}>
            {isLeaf ? (
              <Typography style={{ marginTop: 0 }}>{labelText}</Typography>
            ) : (
              <Grid container style={{ padding: 0, marginTop: 8, marginLeft: -11 }}>
                <Grid item xs={1}>
                  <LabelIcon />
                </Grid>
                <Grid item xs={11}>
                  {labelText}
                </Grid>
              </Grid>
            )}
          </Grid>
          <Grid item xs={1}>
            {isWorkspace ? (
              <ListItemSecondaryAction>
                <IconButton aria-label="Disconnect workspace" onClick={() => removeWorkspaceClickHandler(authId)}>
                  <MuiRemoveCircleTwoToneIcon />
                </IconButton>
              </ListItemSecondaryAction>
            ) : (
              <div></div>
            )}
          </Grid>
        </Grid>
      }
      {...other}
    />
  );
}

const useStyles = makeStyles(
  createStyles({
    root: {
      width: "100%",
      flexGrow: 1,
    },
  })
);

export default function Workspaces(props) {
  const classes = useStyles();

  vscode = props.vscode;
  const workspaces = props.stateData?.slackWorkspaces ?? [];

  function addWorkspaceClickHandler() {
    const command = {
      action: "musictime.connectSlackWorkspace",
      command: "command_execute",
    };
    vscode.postMessage(command);
  }

  return (
    <TreeView className={classes.root} disableSelection={true} defaultCollapseIcon={<ArrowDropDownIcon />} defaultExpandIcon={<ArrowRightIcon />}>
      <StyledTreeItem nodeId="workspaces" labelText="Workspaces" key="workspaces" labelIcon={SlackFolderIcon}>
        {workspaces.map((value, index) => {
          return (
            <StyledTreeItem
              nodeId={value.team_domain}
              key={value.team_domain}
              labelText={value.team_domain}
              labelIcon={SlackWorkspaceIcon}
              isWorkspace={true}
              isLeaf={true}
              authId={value.authId}
            />
          );
        })}
        <StyledTreeItem
          onClick={addWorkspaceClickHandler}
          nodeId="add_workspace"
          key="add_workspace"
          labelText="Add workspace"
          isLeaf={true}
          labelIcon={MuiControlPointTwoToneIcon}
        />
      </StyledTreeItem>
    </TreeView>
  );
}
