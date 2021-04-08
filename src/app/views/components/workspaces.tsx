import React from "react";
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import TreeView from "@material-ui/lab/TreeView";
import TreeItem, { TreeItemProps } from "@material-ui/lab/TreeItem";
import Typography from "@material-ui/core/Typography";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import ArrowRightIcon from "@material-ui/icons/ArrowRight";
import { SvgIconProps } from "@material-ui/core/SvgIcon";
import IconButton from "@material-ui/core/IconButton";
import { SlackWorkspaceIcon, SlackFolderIcon, MuiRemoveCircleTwoToneIcon, MuiControlPointTwoToneIcon } from "../icons";

let vscode = null;

declare module "csstype" {
  interface Properties {
    "--tree-view-bg-color"?: string;
  }
}

type StyledTreeItemProps = TreeItemProps & {
  bgColor?: string;
  labelIcon?: React.ElementType<SvgIconProps>;
  labelInfo?: string;
  labelText: string;
  isWorkspace?: boolean;
  isLeaf?: boolean;
  authId?: string;
};

const useTreeItemStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      margin: 0,
      padding: theme.spacing(0.25, 0.5),
    },
    content: {
      width: "100%",
      fontWeight: theme.typography.fontWeightMedium,
    },
    labelRoot: {
      display: "flex",
      alignItems: "center",
      padding: theme.spacing(0.25, 0.5),
    },
    labelIcon: {
      marginRight: theme.spacing(1),
    },
    labelText: {
      fontWeight: "inherit",
      flexGrow: 1,
    },
  })
);

function removeWorkspaceClickHandler(authId: string) {
  const command = {
    action: "codetime.disconnectSlackWorkspace",
    command: "command_execute",
    arguments: [authId],
  };
  vscode.postMessage(command);
}

function StyledTreeItem(props: StyledTreeItemProps) {
  const classes = useTreeItemStyles();
  const { labelText, labelIcon: LabelIcon, labelInfo, bgColor, isWorkspace, isLeaf, authId, ...other } = props;

  return (
    <TreeItem
      icon={isLeaf && LabelIcon && <LabelIcon className={classes.labelIcon} />}
      label={
        <div className={classes.labelRoot}>
          {!isLeaf && LabelIcon && <LabelIcon className={classes.labelIcon} />}
          <Typography variant="body2" className={classes.labelText}>
            {labelText}
          </Typography>
          <Typography variant="caption">
            {labelInfo}
          </Typography>
          {isWorkspace && (
            <IconButton
              aria-label="Disconnect workspace"
              onClick={() => removeWorkspaceClickHandler(authId)}>
              <MuiRemoveCircleTwoToneIcon />
            </IconButton>
          )}
        </div>
      }
      style={{
        "--tree-view-bg-color": bgColor,
      }}
      classes={{
        root: classes.root
      }}
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
    <TreeView className={classes.root} defaultCollapseIcon={<ArrowDropDownIcon />} defaultExpandIcon={<ArrowRightIcon />}>
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
