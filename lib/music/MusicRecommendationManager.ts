import { commands } from "vscode";
import { Track, getRecommendationsForTracks } from "cody-music";
import {
    sortTracks,
    requiresSpotifyAccess,
    buildTracksForRecommendations
} from "./MusicUtil";
import { MusicDataManager } from "./MusicDataManager";

const dataMgr: MusicDataManager = MusicDataManager.getInstance();

export async function refreshRecommendations() {
    if (requiresSpotifyAccess()) {
        // update the recommended tracks to empty
        dataMgr.recommendationTracks = [];
        commands.executeCommand("musictime.refreshRecommendationsTree");
    } else if (dataMgr.currentRecMeta && dataMgr.currentRecMeta.label) {
        // use the current recommendation metadata and bump the offset
        this.updateRecommendations(
            dataMgr.currentRecMeta.label,
            dataMgr.currentRecMeta.likedSongSeedLimit,
            dataMgr.currentRecMeta.seed_genres,
            dataMgr.currentRecMeta.features,
            dataMgr.currentRecMeta.offset
        );
    } else {
        // default to the similar liked songs recommendations
        this.updateRecommendations("Similar to Liked Songs", 5);
    }
}

export async function getRecommendedTracks(
    trackIds,
    seed_genres,
    features
): Promise<Track[]> {
    try {
        return getRecommendationsForTracks(
            trackIds,
            100,
            "" /*market*/,
            20,
            100,
            seed_genres,
            [],
            features
        );
    } catch (e) {
        //
    }

    return [];
}

export async function updateRecommendations(
    label: string,
    likedSongSeedLimit: number = 5,
    seed_genres: string[] = [],
    features: any = {},
    offset: number = 0
) {
    dataMgr.currentRecMeta = {
        label,
        likedSongSeedLimit,
        seed_genres,
        features,
        offset
    };

    const trackIds = await this.getTrackIdsForRecommendations(
        likedSongSeedLimit,
        offset
    );

    // fetch the recommendations from spotify
    const tracks: Track[] =
        (await this.getRecommendedTracks(trackIds, seed_genres, features)) ||
        [];

    // get the tracks that have already been recommended
    let existingTrackIds = dataMgr.prevRecTrackMap[label]
        ? dataMgr.prevRecTrackMap[label]
        : [];
    let finalTracks: Track[] = [];
    if (existingTrackIds.length) {
        // filter out the ones that are already used
        tracks.forEach((track: Track) => {
            if (!existingTrackIds.find((id: string) => id === track.id)) {
                finalTracks.push(track);
            }
        });
        if (finalTracks.length < 10) {
            // use the 1st 10 from recommendations and clear out the existing track ids
            finalTracks = [];
            finalTracks.push(...tracks);
            // clear out the old
            existingTrackIds = [];
        }
    } else {
        // no tracks found in the existing list
        finalTracks.push(...tracks);
    }

    // trim down to 10
    finalTracks = finalTracks.splice(0, 10);

    // add these to the previously recommended tracks
    const finalTrackIds = finalTracks.map((t: Track) => t.id);
    existingTrackIds.push(...finalTrackIds);

    // update the cache map based on this recommendation type
    dataMgr.prevRecTrackMap[label] = existingTrackIds;

    if (finalTracks.length > 0) {
        // sort them alpabeticaly
        sortTracks(finalTracks);
    }

    // set the manager's recommendation tracks
    dataMgr.recommendationTracks = finalTracks;
    dataMgr.recommendationLabel = label;

    // refresh the rec tree
    commands.executeCommand("musictime.refreshRecommendationsTree");
}

export async function getTrackIdsForRecommendations(
    likedSongSeedLimit: number = 5,
    offset: number = 0
) {
    let trackIds = [];
    let trackRecs = dataMgr.trackIdsForRecommendations || [];

    if (trackRecs.length === 0) {
        // call the music util to populate the rec track ids
        await buildTracksForRecommendations(dataMgr.spotifyPlaylists);
        trackRecs = dataMgr.trackIdsForRecommendations || [];
    }

    if (trackRecs.length > 0) {
        for (let i = 0; i < likedSongSeedLimit; i++) {
            if (trackRecs.length > offset) {
                // we have enough, grab the next track
                trackIds.push(trackRecs[offset]);
            } else {
                // start the offset back to the begining
                offset = 0;
                trackIds.push(trackRecs[offset]);
            }
            offset++;
        }
    }
    return trackIds;
}
