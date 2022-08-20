import { SpotifyAudioFeature } from 'cody-music';

export default class AudioFeatures {

	defaults: any = { min: 0, max: 1, total: 0, count: 0, avg: 0 };

	acousticness: any = {
		...this.defaults,
		label: 'Acousticness'
	};

	danceability: any = {
		...this.defaults,
		label: 'Danceability'
	};

	energy: any = {
		...this.defaults,
		label: 'Engery'
	};

	instrumentalness: any = {
		...this.defaults,
		label: 'Instrumentalness'
	};

	loudness: any = {
		...this.defaults,
		label: 'Loudness',
		min: -100,
		max: 0
	};

	liveness: any = {
		...this.defaults,
		label: 'Liveness'
	};

	speechiness: any = {
		...this.defaults,
		label: 'Speechiness'
	};

	tempo: any = {
		...this.defaults,
		label: 'Tempo',
		min: 0,
		max: 1015
	};

	valence: any = {
		...this.defaults,
		label: 'Valence'
	};

	metrics: any = {};

	constructor(features: SpotifyAudioFeature[]) {
		this.metrics = {}
		if (features?.length) {
			features.forEach(feature => {
				Object.keys(feature).forEach(key => {
					if (this[key]) {
						this[key].total += feature[key];
						this[key].count += 1
						this[key].avg = parseFloat(this[key].total) / this[key].count
						this.metrics[key] = this[key];
					}
				})
			});
		}
	}

	getMetrics() {
		return this.metrics;
	}

	getFeaturesForRecommendations() {
		const recommendationFeatures = {}
		Object.keys(this.metrics).forEach(key => {
			if (key !== 'tempo') {
				recommendationFeatures[`target_${key}`] = this.metrics[key].avg;
			}
		});
		return recommendationFeatures
	}
}
