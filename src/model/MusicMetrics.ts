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

	public updateAverage(metrics: MusicMetrics, index: number): void {
		this.acousticness = this.getAvg(this.acousticness, metrics.acousticness, index);
		this.danceability = this.getAvg(this.danceability, metrics.danceability, index);
		this.energy = this.getAvg(this.energy, metrics.energy, index);
		this.instrumentalness = this.getAvg(this.instrumentalness, metrics.instrumentalness, index);
		this.liveness = this.getAvg(this.liveness, metrics.liveness, index);
		this.loudness = this.getAvg(this.loudness, metrics.loudness, index);
		this.speechiness = this.getAvg(this.speechiness, metrics.speechiness, index);
		this.tempo = this.getAvg(this.tempo, metrics.tempo, index);
		this.valence = this.getAvg(this.valence, metrics.valence, index);
	}

	private getAvg(thisVal, thatVal, index) {
		thisVal = thisVal ?? 0;
		thatVal = thatVal ?? 0;
		return (thisVal + thatVal) / index;
	}
}
