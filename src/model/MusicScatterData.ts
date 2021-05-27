import MusicMetrics from "./MusicMetrics";
import MusicScatterMetric from "./MusicScatterMetric";

export default class MusicScatterData {
  public feature_keys: string[] = [
    "Acousticness",
    "Danceability",
    "Energy",
    "Instrumentalness",
    "Liveness",
    "Loudness",
    "Speechiness",
    "Tempo",
    "Valence",
  ];
  public acousticness: MusicScatterMetric[] = [];
  public accousticness_range: any = { min: 0.0, max: 1.0 };
  public danceability: MusicScatterMetric[] = [];
  public danceability_range: any = { min: 0.0, max: 1.0 };
  public energy: MusicScatterMetric[] = [];
  public energy_range: any = { min: 0.0, max: 1.0 };
  public instrumentalness: MusicScatterMetric[] = [];
  public instrumentalness_range: any = {};
  public liveness: MusicScatterMetric[] = [];
  public liveness_range: any = { min: 0.0, max: 1.0 };
  public loudness: MusicScatterMetric[] = [];
  public loudness_range: any = { min: -260, max: 200 };
  public speechiness: MusicScatterMetric[] = [];
  public speechiness_range: any = { min: 0.0, max: 1.0 };
  public tempo: MusicScatterMetric[] = [];
  public tempo_range: any = { min: 0.0, max: 200 };
  public valence: MusicScatterMetric[] = [];
  public valence_range: any = { min: 0.0, max: 1.0 };

  public addMetric(metrics: MusicMetrics): void {
    this.addMetricByFeature(metrics, "loudness");
    this.addMetricByFeature(metrics, "valence");
    this.addMetricByFeature(metrics, "acousticness");
    this.addMetricByFeature(metrics, "danceability");
    this.addMetricByFeature(metrics, "energy");
    this.addMetricByFeature(metrics, "instrumentalness");
    this.addMetricByFeature(metrics, "liveness");
    this.addMetricByFeature(metrics, "speechiness");
    this.addMetricByFeature(metrics, "tempo");
  }

  private addMetricByFeature(metrics: MusicMetrics, feature: string) {
    const scatterPoint: MusicScatterMetric = new MusicScatterMetric();
    scatterPoint.name = this.getTooltipDescription(metrics);
    switch (feature) {
      case "loudness":
        scatterPoint.value = metrics.loudness;
        this.loudness.push(scatterPoint);
        break;
      case "valence":
        scatterPoint.value = metrics.valence;
        this.valence.push(scatterPoint);
        break;
      case "acousticness":
        scatterPoint.value = metrics.acousticness;
        this.acousticness.push(scatterPoint);
        break;
      case "danceability":
        scatterPoint.value = metrics.danceability;
        this.danceability.push(scatterPoint);
        break;
      case "energy":
        scatterPoint.value = metrics.energy;
        this.energy.push(scatterPoint);
        break;
      case "instrumentalness":
        scatterPoint.value = metrics.instrumentalness;
        this.instrumentalness.push(scatterPoint);
        break;
      case "liveness":
        scatterPoint.value = metrics.liveness;
        this.liveness.push(scatterPoint);
        break;
      case "speechiness":
        scatterPoint.value = metrics.speechiness;
        this.speechiness.push(scatterPoint);
        break;
      case "tempo":
        scatterPoint.value = metrics.tempo;
        this.tempo.push(scatterPoint);
        break;
    }
  }

  private getTooltipDescription(metrics: MusicMetrics): string {
    const artistName: string = this.getDisplayFor(metrics.artist_name);

    return artistName ? `${metrics.song_name} - ${artistName}` : metrics.song_name;
  }

  private getDisplayFor(val) {
    val = val ? val.trim() : val;
    if (val && val.length > 50) {
      return val.substring(0, 50) + "...";
    }
    return val;
  }
}
