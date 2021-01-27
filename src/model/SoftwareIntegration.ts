export default class SoftwareIntegration {
  public id: number;
  public name: string; // i.e. Slack, Spotify
  public value: string; // i.e. <email>
  public status: string; // i.e. ACTIVE
  public authId: string;
  public access_token: string;
  public refresh_token: string;
  public pluginId: number;
  public team_domain: string; // used for slack
  public team_name: string; // used for slack
  public integration_id: string;
  public plugin_uuid: string;
  public scopes: string[] = [];
}