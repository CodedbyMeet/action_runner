console.log('Lets write JavaScript');

// Global variables for application state
let currentSong = new Audio();
let songs = []; // Holds filenames for the current playlist
let currentFolder; // Stores the currently loaded album folder (e.g., "spotify/songs/ncs")

// --- Utility Functions ---

/**
 * Converts seconds to a formatted MM:SS string.
 */
function secondsToMinutesSeconds(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        return "00:00";
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

/**
 * Decodes a URI component and removes file extensions for display.
 */
function getDisplayTitle(encodedString) {
    const withoutExtension = encodedString.split('.').slice(0, -1).join('.');
    return decodeURIComponent(withoutExtension.replaceAll("%20", " "));
}

// --- Playback Functions ---

/**
 * Plays a specific song track from the current folder.
 * Updates UI and play/pause button.
 */
const playMusic = (trackFilename, pause = false) => {
    currentSong.src = `/${currentFolder}/${trackFilename}`;
    
    if (!pause) {
        currentSong.play().catch(error => {
            console.error("Playback failed:", error);
            alert("Playback blocked by browser. Please interact with the page first (e.g., click the play button).");
        });
        document.getElementById("play").src = "img/pause.svg";
    } else {
        document.getElementById("play").src = "img/play.svg";
    }

    document.querySelector(".songinfo").innerHTML = getDisplayTitle(trackFilename);
    document.querySelector(".songtime").innerHTML = "00:00 / 00:00";
};

/**
 * Gets the filename of the currently playing song from its src.
 */
function getCurrentSongFilename() {
    return currentSong.src.split('/').pop();
}

// --- Playlist Management ---

/**
 * Fetches MP3 songs for an album folder by parsing its directory listing.
 * Updates the global `songs` array and renders the playlist UI.
 */
async function getSongs(folderPath) {
    currentFolder = folderPath; // e.g., "spotify/songs/ncs"
    const songListUL = document.querySelector(".songList ul");
    songListUL.innerHTML = ""; // Clear existing songs

    try {
        const response = await fetch(`/${folderPath}/`); // e.g., /spotify/songs/ncs/
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status} for /${folderPath}/`);
        }
        const htmlText = await response.text();
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = htmlText;

        const anchors = tempDiv.getElementsByTagName("a");
        songs = []; // Reset global songs array for the new playlist

        for (const anchor of Array.from(anchors)) {
            if (anchor.href.endsWith(".mp3")) {
                const filename = anchor.href.split(`/${folderPath}/`).pop();
                songs.push(filename);
            }
        }

        if (songs.length === 0) {
            songListUL.innerHTML = "<li>No songs found in this album.</li>";
            console.warn(`No .mp3 files found in folder: ${folderPath}`);
            return [];
        }

        songs.forEach(songFilename => {
            songListUL.innerHTML += `
                <li>
                    <img class="invert" width="34" src="img/music.svg" alt="Music icon">
                    <div class="info">
                        <div>${getDisplayTitle(songFilename)}</div>
                        <div>Artist Name</div>
                    </div>
                    <div class="playnow">
                        <span>Play Now</span>
                        <img class="invert" src="img/play.svg" alt="Play button">
                    </div>
                </li>`;
        });

        // Attach click listeners to each song item
        Array.from(songListUL.getElementsByTagName("li")).forEach(liElement => {
            liElement.addEventListener("click", () => {
                const clickedSongTitle = liElement.querySelector(".info").firstElementChild.textContent.trim();
                const songToPlay = songs.find(s => getDisplayTitle(s) === clickedSongTitle);
                if (songToPlay) {
                    playMusic(songToPlay);
                } else {
                    console.error("Could not find song to play:", clickedSongTitle);
                }
            });
        });

        return songs;

    } catch (error) {
        console.error(`Error fetching songs for folder ${folderPath}:`, error);
        songListUL.innerHTML = `<li>Error loading songs. Please check console.</li>`;
        return [];
    }
}

// --- Album Display (Cards) ---

/**
 * Fetches and displays album cards on the main page.
 * Assumes each album folder contains `info.json` and `cover.jpg`.
 */
async function displayAlbums() {
    console.log("Displaying albums...");
    const cardContainer = document.querySelector(".cardContainer");
    cardContainer.innerHTML = "";

    try {
        const response = await fetch(`/spotify/songs/`); // Fetch directory listing for top-level album folders
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status} for /spotify/songs/`);
        }
        const htmlText = await response.text();
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = htmlText;
        const anchors = tempDiv.getElementsByTagName("a");

        const albumFolders = [];
        for (const anchor of Array.from(anchors)) {
            // Refined check for actual subdirectories ending with '/' and having appropriate path depth
            if (anchor.href.includes("/spotify/songs/") && anchor.href.endsWith('/') && anchor.href.split('/').filter(Boolean).length > 3) {
                const folderName = anchor.href.split('/').filter(Boolean).pop();
                if (folderName && !folderName.includes('.')) { // Exclude files like .htaccess, index.html, etc.
                    albumFolders.push(folderName);
                }
            }
        }
        console.log("Detected album folders:", albumFolders);

        for (const folder of albumFolders) {
            try {
                const infoResponse = await fetch(`/spotify/songs/${folder}/info.json?${Date.now()}`); // Cache busting
                if (!infoResponse.ok) {
                    throw new Error(`HTTP error! Status: ${infoResponse.status} for /spotify/songs/${folder}/info.json`);
                }
                const infoData = await infoResponse.json();

                cardContainer.innerHTML += `
                    <div data-folder="${folder}" class="card">
                        <div class="play">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 20V4L19 12L5 20Z" stroke="#141B34" fill="#000" stroke-width="1.5"
                                    stroke-linejoin="round" />
                            </svg>
                        </div>
                        <img src="/spotify/songs/${folder}/cover.jpg" alt="Album Cover for ${infoData.title}">
                        <h2>${infoData.title}</h2>
                        <p>${infoData.description}</p>
                    </div>`;
            } catch (error) {
                console.warn(`Skipping album card for folder '${folder}': Could not fetch info.json or cover.jpg. Error:`, error.message);
            }
        }

        // --- Reverted to individual event listeners for each card ---
        // This loop must run AFTER all cards have been added to the DOM
        Array.from(document.getElementsByClassName("card")).forEach(e => { 
            e.addEventListener("click", async item => {
                console.log("Fetching Songs for folder:", item.currentTarget.dataset.folder);
                // folderName is like "ncs" or "cs", so we need the full path for getSongs
                await getSongs(`spotify/songs/${item.currentTarget.dataset.folder}`); 
                if (songs.length > 0) {
                    playMusic(songs[0], true); // Load first song paused (this will trigger autoplay block on new album selection)
                } else {
                    console.warn(`No songs found in album '${item.currentTarget.dataset.folder}'.`);
                }
                document.querySelector(".left").style.left = "-120%"; // Close sidebar
            });
        });

    } catch (error) {
        console.error("Error displaying albums:", error);
        cardContainer.innerHTML = "<p>Failed to load albums. Please check your server setup and paths.</p>";
    }
}

// --- Main Application Initialization ---

async function main() {
    // Get the list of all the songs for the default album (ncs) and load it
    await getSongs("spotify/songs/ncs"); // Changed from "songs/ncs" to "spotify/songs/ncs" for consistency with structure
    
    // This call will likely trigger the "Playback blocked by browser" alert
    // because it's happening immediately on page load without user interaction.
    if (songs.length > 0) {
        playMusic(songs[0], true); // Load first song paused
    } else {
        console.warn("No songs loaded in the default playlist. Check 'spotify/songs/ncs' folder.");
    }

    // Display all the albums on the page
    await displayAlbums(); // This will also re-attach event listeners to all cards

    // Attach an event listener to play, next and previous
    const playButton = document.getElementById("play"); // Assuming element has ID 'play'
    const previousButton = document.getElementById("previous"); // Assuming element has ID 'previous'
    const nextButton = document.getElementById("next"); // Assuming element has ID 'next'

    playButton.addEventListener("click", () => {
        if (currentSong.paused) {
            currentSong.play();
            playButton.src = "img/pause.svg";
        } else {
            currentSong.pause();
            playButton.src = "img/play.svg";
        }
    });

    // Listen for timeupdate event
    currentSong.addEventListener("timeupdate", () => {
        document.querySelector(".songtime").innerHTML = `${secondsToMinutesSeconds(currentSong.currentTime)} / ${secondsToMinutesSeconds(currentSong.duration)}`
        if (currentSong.duration && !isNaN(currentSong.duration)) {
            document.querySelector(".circle").style.left = (currentSong.currentTime / currentSong.duration) * 100 + "%";
        }
    })

    // Add an event listener to seekbar
    document.querySelector(".seekbar").addEventListener("click", e => {
        if (!currentSong.duration || isNaN(currentSong.duration)) return; // Prevent seeking if no song loaded or duration invalid
        let percent = (e.offsetX / e.target.getBoundingClientRect().width) * 100;
        document.querySelector(".circle").style.left = percent + "%";
        currentSong.currentTime = ((currentSong.duration) * percent) / 100
    })

    // Add an event listener for hamburger
    document.querySelector(".hamburger").addEventListener("click", () => {
        document.querySelector(".left").style.left = "0"
    })

    // Add an event listener for close button
    document.querySelector(".close").addEventListener("click", () => {
        document.querySelector(".left").style.left = "-120%"
    })

    // Add an event listener to previous
    previousButton.addEventListener("click", () => { // Using previousButton variable
        currentSong.pause();
        console.log("Previous clicked");
        let index = songs.indexOf(getCurrentSongFilename()); // Use getCurrentSongFilename()
        if ((index - 1) >= 0) {
            playMusic(songs[index - 1]);
        } else {
            console.log("Already at the first song.");
        }
    });

    // Add an event listener to next
    nextButton.addEventListener("click", () => { // Using nextButton variable
        currentSong.pause();
        console.log("Next clicked");
        let index = songs.indexOf(getCurrentSongFilename()); // Use getCurrentSongFilename()
        if ((index + 1) < songs.length) {
            playMusic(songs[index + 1]);
        } else {
            console.log("Already at the last song.");
        }
    });

    // Add an event to volume
    document.querySelector(".range").getElementsByTagName("input")[0].addEventListener("change", (e) => {
        console.log("Setting volume to", e.target.value, "/ 100")
        currentSong.volume = parseInt(e.target.value) / 100
        if (currentSong.volume > 0){
            document.querySelector(".volume>img").src = document.querySelector(".volume>img").src.replace("img/mute.svg", "img/volume.svg");
        } else {
            document.querySelector(".volume>img").src = document.querySelector(".volume>img").src.replace("img/volume.svg", "img/mute.svg");
        }
    })

  // Add event listener to mute the track
    document.querySelector(".volume>img").addEventListener("click", e=>{ 
        if(e.target.src.includes("img/volume.svg")){
            e.target.src = e.target.src.replace("img/volume.svg", "img/mute.svg")
            currentSong.volume = 0;
            document.querySelector(".range").getElementsByTagName("input")[0].value = 0;
        }
        else{
            e.target.src = e.target.src.replace("img/mute.svg", "img/volume.svg")
            currentSong.volume = .10;
            document.querySelector(".range").getElementsByTagName("input")[0].value = 10;
        }

    })
}

// Initialize the application
main();