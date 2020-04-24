import { showQuickPick } from "../MenuManager";
import { MusicManager } from "../music/MusicManager";
import { MusicDataManager } from "../music/MusicDataManager";
import { Track, PlayerContext, getSpotifyPlayerContext } from "cody-music";

export async function showSortPlaylistMenu() {
    const items = getSortItems();
    let menuOptions = {
        items,
        placeholder: "Sort by",
    };

    const pick = await showQuickPick(menuOptions);
    if (pick && pick.label) {
        return pick.label;
    }
    return null;
}

export async function showPlaylistOptionsMenu() {
    const items = getOptionItems();
    let menuOptions = {
        items,
        placeholder: "",
    };

    const pick = await showQuickPick(menuOptions);
    if (pick && pick.label) {
        return pick.label;
    }
    return null;
}

async function getOptionItems() {
    /**
    context:null
    currently_playing_type:"track"
    device:Object {id: "3f0a959e218e64620d90e48ade038179d49691bb", is_active: true, is_private_session: false, …}
    id:"3f0a959e218e64620d90e48ade038179d49691bb"
    is_active:true
    is_private_session:false
    is_restricted:false
    name:"Xavier’s MacBook Pro (2)"
    type:"Computer"
    volume_percent:100
    __proto__:Object {constructor: , __defineGetter__: , __defineSetter__: , …}
    is_playing:true
    item:Object {album: Object, available_markets: Array(75), disc_number: 1, …}
    progress_ms:203031
    repeat_state:"context" | repeat_state:"off" | repeat_state:"track"
    shuffle_state:false
     */
    const spotifyContext: PlayerContext = await getSpotifyPlayerContext();

    // is it currently shuffling?
    const isShuffling = spotifyContext.shuffle_state === true ? true : false;
    // is it currently on playlist repeat, song repeat, no repeat?
    const isRepeatingTrack =
        spotifyContext.repeat_state === "track" ? true : false;
    const isRepeatingPlaylist =
        spotifyContext.repeat_state === "context" ? true : false;

    const items = [];
    if (isShuffling) {
        items.push({
            label: "Don't shuffle",
            command: "musictime.shuffleOff",
        });
    } else {
        items.push({
            label: "Shuffle",
            command: "musictime.shuffleOn",
        });
    }
    if (isRepeatingPlaylist) {
        items.push({
            label: "Repeat track",
            command: "musictime.repeatTrack",
        });
    } else if (isRepeatingTrack) {
        items.push({
            label: "Don't repeat",
            command: "musictime.repeatOff",
        });
    } else {
        items.push({
            label: "Repeat playlist",
            command: "musictime.repeatPlaylist",
        });
        items.push({
            label: "Repeat track",
            command: "musictime.repeatTrack",
        });
    }

    return items;
}

function getSortItems() {
    const items = [
        {
            label: "Sort A-Z",
            command: "musictime.sortAlphabetically",
        },
        {
            label: "Sort by latest",
            command: "musictime.sortToOriginal",
        },
    ];

    return items;
}
