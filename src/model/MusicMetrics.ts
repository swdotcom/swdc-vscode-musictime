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

  public increment(metrics: MusicMetrics): void {
    this.acousticness = this.incrementVals(this.acousticness, metrics.acousticness);
    this.danceability = this.incrementVals(this.danceability, metrics.danceability);
    this.energy = this.incrementVals(this.energy, metrics.energy);
    this.instrumentalness = this.incrementVals(this.instrumentalness, metrics.instrumentalness);
    this.liveness = this.incrementVals(this.liveness, metrics.liveness);
    this.loudness = this.incrementVals(this.loudness, metrics.loudness);
    this.speechiness = this.incrementVals(this.speechiness, metrics.speechiness);
    this.tempo = this.incrementVals(this.tempo, metrics.tempo);
    this.valence = this.incrementVals(this.valence, metrics.valence);
  }

  private incrementVals(thisVal, thatVal) {
    thisVal = thisVal ?? 0;
    thatVal = thatVal ?? 0;
    return thisVal + thatVal;
  }

  public setAverages(count: number) {
    this.acousticness = this.acousticness / count;
    this.danceability = this.danceability / count;
    this.energy = this.energy / count;
    this.instrumentalness = this.instrumentalness / count;
    this.liveness = this.liveness / count;
    this.loudness = this.loudness / count;
    this.speechiness = this.speechiness / count;
    this.tempo = this.tempo / count;
    this.valence = this.valence / count;
  }
}
