export default class MusicMetrics {
	public acousticness: number;
  public album_uri: string;
  public artist_name: string;
  public artist_uri: string;
	public artwork: any[]; // {height, url, width}
	public danceability: number;
	public energy: number;
	public instrumentalness: number;
	public keystrokes: number;
	public liveness: number;
	public loudness: number;
	public plays: number;
	public primary_artist_name: string;
	public productivity_score: number;
	public song_id: string;
	public song_name: string;
	public song_rank: number;
	public song_uri: string;
	public speechiness: number;
	public tempo: number;
	public user_id: number;
	public valence: number;
}
