import React from "react";
import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import TreeView from "@material-ui/lab/TreeView";
import TreeItem, { TreeItemProps } from "@material-ui/lab/TreeItem";
import Button from "@material-ui/core/Button";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import ArrowRightIcon from "@material-ui/icons/ArrowRight";
import Grid from "@material-ui/core/Grid";
import { SvgIconProps } from "@material-ui/core/SvgIcon";
import { SpotifyIcon, PlaylistIcon } from "../icons";
import IconButton from "@material-ui/core/IconButton";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import DeleteIcon from "@material-ui/icons/Delete";
import deepPurple from "@material-ui/core/colors/deepPurple";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import PlaylistItem from "./playlist_item";

let vscode = null;

type StyledTreeItemProps = TreeItemProps & {
  labelIcon?: React.ElementType<SvgIconProps>;
  labelInfo?: string;
  labelText: string;
  isLeaf?: boolean
};

const useTreeItemStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      color: theme.palette.text.secondary,
      "&:hover > $content": {
        backgroundColor: theme.palette.action.hover,
      },
      margin: 0,
      padding: theme.spacing(0.25, 0.5),
    },
    content: {
      width: "100%",
      color: theme.palette.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
    },
    label: {
      fontWeight: "inherit",
      color: "inherit",
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
    gridItem: {
      marginLeft: -10
    },
    textButton: {
      width: "100%",
      justifyContent: "flex-start",
      padding: theme.spacing(0.25, 0.5),
      fontWeight: 500,
    },
  })
);

function StyledTreeItem(props: StyledTreeItemProps) {
  const classes = useTreeItemStyles();
  const { labelText, labelIcon: LabelIcon, labelInfo, isLeaf, ...other } = props;

  return (
    <TreeItem
      label={
        <Grid container direction="row" justify="space-between" alignItems="flex-start">
          <Grid item xs={11} className={classes.gridItem}>
            <Button classes={{ root: classes.textButton }} startIcon={<PlaylistIcon />}>
              { labelText }
            </Button>
          </Grid>
          <Grid item xs={1} style={{ marginRight: 4 }}>
            <IconButton
                  size="small"
                  style={{ color: deepPurple[300] }}
                  aria-label="Delete">
              <DeleteIcon/>
            </IconButton>
          </Grid>
        </Grid>
      }
      classes={{
        root: classes.root,
        content: classes.content,
        label: classes.label,
      }}
      {...other}
    />
  );
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
      flexGrow: 1,
      margin: 0,
      padding: 0
    },
    gridItem: {
      marginLeft: -10
    },
    textButton: {
      width: "100%",
      justifyContent: "flex-start",
      padding: theme.spacing(0.25, 0.5),
      fontWeight: 500,
    },
    playlistName: {
      marginLeft: -10
    }
  })
);

export default function Playlists(props) {
  vscode = props.vscode;
  const classes = useStyles();

  return (
    <div style={{padding: 0, marginRight: 10, width: "100%"}}>
      {props.stateData.spotifyPlaylists ? (
        props.stateData.spotifyPlaylists.map((item, index) => {
          return (<PlaylistItem playlistItem={item} key={index}/>)
        })) : (null)}
    </div>
//     return (<Grid container direction="row" justify="space-between" onMouseOver={gridRowHoverHandler}
//     key={item.id}>
//   <Grid item xs={10} className={classes.playlistName}>
//     <Button classes={{ root: classes.textButton }} startIcon={<PlaylistIcon />}>
//       <Box textOverflow="ellipsis" overflow="hidden">{ item.name }</Box>
//     </Button>
//   </Grid>
//   <Grid item xs={2}>
//     <IconButton
//       hidden={true}
//       size="small"
//       style={{ color: deepPurple[300] }}
//       aria-label="Playlist menu">
//       <MoreVertIcon/>
//     </IconButton>
//   </Grid>
// </Grid>)
    // <TreeView className={classes.root}
    //     defaultCollapseIcon={<ArrowDropDownIcon />} defaultExpandIcon={<ArrowRightIcon />}>
    //   {props.stateData.spotifyPlaylists ? (
    //     props.stateData.spotifyPlaylists.map((item, index) => {
    //       return (<StyledTreeItem nodeId={item.id} labelText={item.name} key={item.id} labelIcon={SpotifyIcon}/>)
    //     })
    //   ) : (null)}
    // </TreeView>
  );
}
