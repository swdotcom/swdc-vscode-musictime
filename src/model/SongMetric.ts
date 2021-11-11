import SongArtist from './SongArtist';

export default class SongMetric {
	public active_codetime_seconds: number = 0;
	public codetime_seconds: number = 0;
	public count_users: number = 0;
	public keystrokes: number = 0;
	public duration_played_minutes: number = 0;
	public keystrokes_per_minute: number = 0;
	public rank: number = 0;
	public song_id: string = '';
	public song_name: string = '';
	public song_plays: number = 0;
	public artists: SongArtist[] = [];
}
