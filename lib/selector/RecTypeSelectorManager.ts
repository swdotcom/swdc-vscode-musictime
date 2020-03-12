import { showQuickPick } from "../MenuManager";

export async function showGenreSelections() {
    let menuOptions = {
        items: [],
        placeholder: "Select a genre"
    };

    // get the available genres
    const genres = getGenreSelections();
    genres.sort();

    genres.forEach(genre => {
        let label = genre.replace(/[_-]/g, " ");
        // capitalize the 1st character
        label = label.charAt(0).toUpperCase() + label.substring(1);
        // args: "Soundtracks", 0, ["soundtracks"]
        const args = [label, 0, [genre]];
        menuOptions.items.push({
            label,
            args,
            command: "musictime.updateRecommendations"
        });
    });

    const pick = await showQuickPick(menuOptions);
    if (pick && pick.label) {
        return pick.label;
    }
    return null;
}

export async function showCategorySelections() {
    let menuOptions = {
        items: [],
        placeholder: "Select a mood"
    };

    // add the categories
    const categories = getCategorySelections();
    categories.forEach(cateogry => {
        menuOptions.items.push({
            label: cateogry.label,
            detail: cateogry.description,
            args: cateogry.args,
            command: "musictime.updateRecommendations"
        });
    });

    const pick = await showQuickPick(menuOptions);
    if (pick && pick.label) {
        return pick.label;
    }
    return null;
}

function getCategorySelections() {
    // args example
    // args: ["Happy", 5, [], { min_valence: 0.6, target_valence: 1 }]
    const items = [
        // high valence
        {
            label: "Happy",
            description:
                "Positive, uplifting, mood-boosting; good for any type of coding",
            args: ["Happy", 5, [], { min_valence: 0.7, target_valence: 1 }]
        },
        // high energy
        {
            label: "Energetic",
            description:
                "Dynamic, loud, stimulating; grab a coffee and let's go",
            args: ["Energetic", 5, [], { min_energy: 0.7, target_energy: 1 }]
        },
        // high danceability
        {
            label: "Danceable",
            description:
                "Songs with a stable beat and rhythm; good for fast-paced work",
            args: [
                "Danceable",
                5,
                [],
                { min_danceability: 0.7, target_danceability: 1 }
            ]
        },
        // Low speechiness
        {
            label: "Instrumental",
            description: "Good for complex work requiring maximum focus",
            args: [
                "Instrumental",
                5,
                [],
                { min_instrumentalness: 0.5, target_instrumentalness: 1 }
            ]
        },
        // Liked songs
        {
            label: "Familiar",
            description:
                "Similar to your Liked Songs, familiar songs helps you get into flow faster",
            args: ["Familiar", 5]
        },
        // Low loudness
        {
            label: "Quiet music",
            description:
                "Songs that are soft and low energy, helping you stay focused",
            args: [
                "Quiet music",
                5,
                [],
                { max_loudness: -10, target_loudness: -50 }
            ]
        }
    ];

    return items;
}

function getGenreSelections() {
    const items = [
        "acoustic",
        "afrobeat",
        "alt-rock",
        "alternative",
        "ambient",
        "anime",
        "black-metal",
        "bluegrass",
        "blues",
        "bossanova",
        "brazil",
        "breakbeat",
        "british",
        "cantopop",
        "chicago-house",
        "children",
        "chill",
        "classical",
        "club",
        "comedy",
        "country",
        "dance",
        "dancehall",
        "death-metal",
        "deep-house",
        "detroit-techno",
        "disco",
        "disney",
        "drum-and-bass",
        "dub",
        "dubstep",
        "edm",
        "electro",
        "electronic",
        "emo",
        "folk",
        "forro",
        "french",
        "funk",
        "garage",
        "german",
        "gospel",
        "goth",
        "grindcore",
        "groove",
        "grunge",
        "guitar",
        "happy",
        "hard-rock",
        "hardcore",
        "hardstyle",
        "heavy-metal",
        "hip-hop",
        "holidays",
        "honky-tonk",
        "house",
        "idm",
        "indian",
        "indie",
        "indie-pop",
        "industrial",
        "iranian",
        "j-dance",
        "j-idol",
        "j-pop",
        "j-rock",
        "jazz",
        "k-pop",
        "kids",
        "latin",
        "latino",
        "malay",
        "mandopop",
        "metal",
        "metal-misc",
        "metalcore",
        "minimal-techno",
        "movies",
        "mpb",
        "new-age",
        "new-release",
        "opera",
        "pagode",
        "party",
        "philippines-opm",
        "piano",
        "pop",
        "pop-film",
        "post-dubstep",
        "power-pop",
        "progressive-house",
        "psych-rock",
        "punk",
        "punk-rock",
        "r-n-b",
        "rainy-day",
        "reggae",
        "reggaeton",
        "road-trip",
        "rock",
        "rock-n-roll",
        "rockabilly",
        "romance",
        "sad",
        "salsa",
        "samba",
        "sertanejo",
        "show-tunes",
        "singer-songwriter",
        "ska",
        "sleep",
        "songwriter",
        "soul",
        "soundtracks",
        "spanish",
        "study",
        "summer",
        "swedish",
        "synth-pop",
        "tango",
        "techno",
        "trance",
        "trip-hop",
        "turkish",
        "work-out",
        "world-music"
    ];

    return items;
}
