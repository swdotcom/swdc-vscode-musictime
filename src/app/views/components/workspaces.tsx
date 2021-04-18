import React from "react";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import TreeView from "@material-ui/lab/TreeView";
import TreeItem, { TreeItemProps } from "@material-ui/lab/TreeItem";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import ArrowRightIcon from "@material-ui/icons/ArrowRight";
import { SvgIconProps } from "@material-ui/core/SvgIcon";
import { SlackWorkspaceIcon, SlackFolderIcon, MuiControlPointTwoToneIcon } from "../icons";

let vscode = null;

type StyledTreeItemProps = TreeItemProps & {
  labelIcon?: React.ElementType<SvgIconProps>;
  labelText: string;
  isWorkspace?: boolean;
  isLeaf?: boolean;
  authId?: string;
};

function StyledTreeItem(props: StyledTreeItemProps) {
  const { labelText, labelIcon: LabelIcon, isWorkspace, isLeaf, authId, ...other } = props;

  return <TreeItem icon={isLeaf && LabelIcon && <LabelIcon />} label={labelText} {...other} />;
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
