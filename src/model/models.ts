import { PlaylistItem } from "cody-music";

export class KpmItem extends PlaylistItem {
  description: string = "";
  value: string = "";
  commandArgs: any[] = [];
  contextValue: string = "";
  callback: any = null;
  icon: string = null;
  children: KpmItem[] = [];
  eventDescription: string = null;
}
