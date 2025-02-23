// main.js

var currentMediaType = "movie";
var currentTvSubTab = "popular";
var currentTvPage = 1;
var tvData = [];
var currentMoviesSubTab = "popular";
var currentMoviesPage = 1;
var moviesData = [];
var mediaLoading = {
    movie: false,
    tv: false
};
var seenMediaItemIds = {
    movie: new Set(),
    tv: new Set()
};
let countScroll = 0;
let favoritesPage = 1;
let watchedPage = 1;
const itemsPerPage = 20;

async function renderTab(mediaType, tab) {
    const currentSubTabVar = mediaType === "movie" ? "currentMoviesSubTab" : "currentTvSubTab";
    const currentPageVar = mediaType === "movie" ? "currentMoviesPage" : "currentTvPage";
    const dataArrayVar = mediaType === "movie" ? "moviesData" : "tvData";
    const contentId = mediaType === "movie" ? "moviesContent" : "tvContent";

    // Set global state for active tab and reset pagination
    window[currentSubTabVar] = tab;
    window[currentPageVar] = 1;
    window[dataArrayVar] = [];
    seenMediaItemIds[mediaType].clear();

    const container = document.getElementById(contentId);
    container.innerHTML = "";
    container.scrollTop = 0;

    if (["favorites", "watched"].includes(tab)) {
        // Reset local pagination counters for favorites/watched
        if (tab === "favorites") {
            favoritesPage = 1;
        } else {
            watchedPage = 1;
        }
        const gridId = mediaType === "movie" ? "moviesGrid" : "tvGrid";
        // Render the first chunk of favorites/watched items
        await renderFavoritesChunk(mediaType, tab, container, gridId, 1);
        // Set up infinite scrolling for this container
        setupFavoritesScroll(mediaType, tab);
        mediaLoading[mediaType] = false;
        return;
    } else {
        // For other tabs, load media normally
        await loadMoreMedia(mediaType);
    }
}

function getOrCreateGridContainer(container, gridId, headingText) {
    let sectionElement = container.querySelector(".section");
    if (!sectionElement) {
        container.innerHTML = "";
        sectionElement = document.createElement("div");
        sectionElement.className = "section";
        sectionElement.innerHTML = `<h1>${headingText}</h1><div class="grid-container" id="${gridId}"></div>`;
        container.appendChild(sectionElement);
    }
    let gridElement = sectionElement.querySelector(`#${gridId}`);
    if (!gridElement) {
        gridElement = document.createElement("div");
        gridElement.className = "grid-container";
        gridElement.id = gridId;
        sectionElement.appendChild(gridElement);
    } else {
        gridElement.innerHTML = "";
    }
    return gridElement;
}

async function loadMoreMedia(mediaType) {

    await ensureAvailableIDs();
    if (mediaLoading[mediaType]) {
        return;
    }
    mediaLoading[mediaType] = true;
    var containerId = mediaType === "movie" ? "moviesContent" : "tvContent";
    var gridId = mediaType === "movie" ? "moviesGrid" : "tvGrid";
    var currentSubTab = mediaType === "movie" ? currentMoviesSubTab : currentTvSubTab;
    var currentPage = mediaType === "movie" ? currentMoviesPage : currentTvPage;
    var dataArray = mediaType === "movie" ? moviesData : tvData;
    var genreConfig = mediaType === "movie" ? adminConfig.movieGenres : adminConfig.tvGenres;
    var fetchPopularFunc = mediaType === "movie" ? window.fetchPopular : window.fetchPopular;
    var fetchDiscoverByGenreFunc = mediaType === "movie" ? window.fetchDiscoverByGenre : window.fetchDiscoverByGenre;
    var container = document.getElementById(containerId);


    if (countScroll >= 5) {
        mediaLoading[mediaType] = false;
        // Check if the button already exists to avoid duplicates
        if (!container.querySelector('.load-more-btn')) {
            const btn = document.createElement('button');
            btn.className = 'load-more-btn';
            btn.textContent = 'Load More';
            btn.style.margin = '20px auto';
            btn.style.display = 'block';
            btn.addEventListener('click', () => {
                countScroll = 0; // reset the counter
                btn.remove(); // remove the button
                loadMoreMedia(mediaType);
            });
            container.appendChild(btn);
        }
        return;
    }

    if (["favorites", "watched"].includes(currentSubTab)) {
        await renderFavoritesOrWatched(mediaType, currentSubTab, container, gridId);
        return;
    }

    var grid = container.querySelector(`#${gridId}`);
    if (!grid) {
        var sectionMain = document.createElement("div");
        sectionMain.className = "section";
        var heading = "";
        if (currentSubTab === "popular") {
            heading = `Popular ${mediaType === "movie" ? "Movies" : "TV Shows"}`;
        } else {
            heading = `${currentSubTab} ${mediaType === "movie" ? "Movies" : "TV Shows"}`;
        }
        sectionMain.innerHTML = `<h1>${heading}</h1><div class="grid-container" id="${gridId}"></div>`;
        container.appendChild(sectionMain);
        grid = container.querySelector(`#${gridId}`);
    }
    let loadingIndicator = document.createElement("p");
    loadingIndicator.id = "mediaLoadingIndicator";
    loadingIndicator.textContent = `Loading more ${mediaType === "movie" ? "movies" : "TV shows"}...`;
    container.appendChild(loadingIndicator);
    var newItems = [];
    countScroll += 1;
    if (currentSubTab === "popular") {
        var popResp = await fetchPopularFunc(mediaType, currentPage);
        newItems = popResp && popResp.results ? popResp.results : [];
    } else if (["continue", "upnext", "waitlist"].includes(currentSubTab) && mediaType === "tv") {} else {
        var genreObj = genreConfig.find((g) => g.name === currentSubTab);
        if (!genreObj) {
            console.error(`Unknown ${mediaType} genre sub-tab:`, currentSubTab);
        }
        var discResp = await fetchDiscoverByGenreFunc(mediaType, genreObj.id, currentPage);
        newItems = discResp && discResp.results ? discResp.results : [];
    }
    const indicatorElement = document.getElementById("mediaLoadingIndicator");
    if (indicatorElement && indicatorElement.parentNode === container) {
        container.removeChild(indicatorElement);
    }

    if (!newItems.length) {
        mediaLoading[mediaType] = false;
        return;
    }
    const filteredNewItems = newItems.filter((item) => {
        if (!seenMediaItemIds[mediaType].has(item.id)) {
            seenMediaItemIds[mediaType].add(item.id);
            return true;
        } else {
            return false;
        }
    });
    newItems = filteredNewItems;
    if (!newItems.length) {
        mediaLoading[mediaType] = false;
        return;
    }
    if (mediaType === "movie") {
        moviesData = moviesData.concat(newItems);
    } else {
        tvData = tvData.concat(newItems);
    }
    newItems.forEach((item) => {
        var card = createMediaCard(item, mediaType);
        grid.appendChild(card);
    });
    if (mediaType === "movie") {
        currentMoviesPage++;
    } else {
        currentTvPage++;
    }
    mediaLoading[mediaType] = false;
}

function initSubTabs(mediaType) {
    const st = document.getElementById(mediaType === "movie" ? "moviesSubTabs" : "tvSubTabs");
    let html =
        '<button class="sub-tab-btn active" data-tab="popular"><i class="fa-duotone fa-solid fa-star" style="color:yellow;"></i><p>Popular</p></button>' +
        '<button class="sub-tab-btn" data-tab="favorites"><i class="fas fa-heart" style="color:#e50914;"></i><p>Favorites</p></button>' +
        '<button class="sub-tab-btn" data-tab="watched"><i class="fas fa-eye" style="color:#0f0;"></i><p>Watched</p></button>';

    const genres = mediaType === "movie" ? adminConfig.movieGenres : adminConfig.tvGenres;
    genres.forEach(function(g) {
        const encodedGenreName = g.name === "Action & Adventure" ? encodeURIComponent("action	") : g.name === "Mistery" ? encodeURIComponent("detective") : g.name === "Romance" ? encodeURIComponent("novel--v1") : (g.name === "War" || g.name === "War & Politics") ? encodeURIComponent("cannon") : (g.name === "Science Fiction" || g.name === "Sci-Fi & Fantasy") ? encodeURIComponent("sci-fi") : encodeURIComponent(g.name).toLowerCase(); // URL için güvenli hale getir
        let logoUrl = "https://img.icons8.com/glyph-neue/64/"
        html += `<button class="sub-tab-btn" data-tab="${g.name}">
		<img width="40" height="40" src="${logoUrl}${encodedGenreName}.png" alt="${g.name} title="${g.name}"/>
		<p>${g.name}</p>
	  </button>`;
    });

    st.innerHTML = html;
    renderTab(mediaType, "popular");
    loadMoreMedia(mediaType);
    st.querySelectorAll(".sub-tab-btn").forEach(function(b) {
        b.onclick = function() {
            // Reset scroll counter and pagination
            countScroll = 0;
            favoritesPage = 1;
            watchedPage = 1;
            st.querySelectorAll(".sub-tab-btn").forEach((x) => x.classList.remove("active"));
            this.classList.add("active");
            var tab = this.getAttribute("data-tab");
            renderTab(mediaType, tab);

            // If the selected tab is favorites or watched, set up infinite scroll on that container.
            if (tab === "favorites" || tab === "watched") {
                setupFavoritesScroll(mediaType, tab);
            }
        };
    });
    // Render the fixed sections above tabs
    renderAboveTabsUI();
}

async function renderFavoritesOrWatched(mediaType, subTab, container, gridId) {
    await reloadFavoritesAndWatched();
    const items = (subTab === "favorites" ? window.favorites : window.watched)
        .filter(item => item.type === mediaType);
    const heading = `${subTab === "favorites" ? "Favorite" : "Watched"} ${mediaType === "movie" ? "Movies" : "TV Shows"}`;
    const gridElement = getOrCreateGridContainer(container, gridId, heading);
    items.forEach(item => {
        const card = createMediaCard(item, mediaType);
        gridElement.appendChild(card);
    });
}

async function renderFavoritesChunk(mediaType, subTab, container, gridId, page) {
    // Ensure favorites/watched data is up-to-date.
    await reloadFavoritesAndWatched();
    const allItems = (subTab === "favorites" ? window.favorites : window.watched)
        .filter(item => item.type === mediaType);

    // Calculate start and end index for pagination
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const chunk = allItems.slice(startIndex, endIndex);

    // Get or create the grid container
    const heading = `${subTab === "favorites" ? "Favorite" : "Watched"} ${mediaType === "movie" ? "Movies" : "TV Shows"}`;
    const gridElement = getOrCreateGridContainer(container, gridId, heading);

    // Append each item as a media card
    chunk.forEach(item => {
        const card = createMediaCard(item, mediaType);
        gridElement.appendChild(card);
    });

    return chunk.length; // Return number of items loaded
}

function setupFavoritesScroll(mediaType, subTab) {
    // Select the container based on mediaType ("moviesContent" or "tvContent")
    const containerId = mediaType === "movie" ? "moviesContent" : "tvContent";
    const gridId = mediaType === "movie" ? "moviesGrid" : "tvGrid";
    const container = document.getElementById(containerId);

    // Remove any previous scroll listener if needed
    container.onscroll = null;

    container.addEventListener('scroll', throttle(async () => {
        // Check if user has scrolled near the bottom of the container
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
            // Determine which page to load next
            let currentPage = subTab === "favorites" ? favoritesPage : watchedPage;
            const loadedCount = await renderFavoritesChunk(mediaType, subTab, container, gridId, currentPage);

            // If we loaded items, increment page count; otherwise, you reached the end.
            if (loadedCount > 0) {
                if (subTab === "favorites") {
                    favoritesPage++;
                } else {
                    watchedPage++;
                }
            }
        }
    }, 200));
}

function throttle(fn, limit) {
    let lastCall = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= limit) {
            lastCall = now;
            fn(...args);
        }
    };
}

const filterButton = document.getElementById("filterBtn");
filterButton.addEventListener("click", function() {
    window.location.href = 'filter.html';
});

window.addEventListener('scroll', throttle(() => {
    if ((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 50)) {
        if (currentMediaType === "movie") {
            loadMoreMedia("movie");
        } else {
            loadMoreMedia("tv");
        }
    }
}, 50));

function setupToggle() {
    const savedType = localStorage.getItem("preferredMediaType") || "movie";
    currentMediaType = savedType;

    document.querySelectorAll(".toggle-btn").forEach(function(btn) {
        const type = btn.getAttribute("data-type");

        if (type === currentMediaType) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }

        btn.onclick = function() {

            countScroll = 0

            document.querySelectorAll(".toggle-btn").forEach(function(b) {
                b.classList.remove("active");
            });
            btn.classList.add("active");

            currentMediaType = type;
            localStorage.setItem("preferredMediaType", currentMediaType);

            if (currentMediaType === "movie") {
                document.getElementById("moviesSection").style.display = "flex";
                document.getElementById("tvSection").style.display = "none";
            } else {
                document.getElementById("moviesSection").style.display = "none";
                document.getElementById("tvSection").style.display = "flex";
            }

            document.getElementById("moviesSection").classList.toggle("active", currentMediaType === "movie");
            document.getElementById("tvSection").classList.toggle("active", currentMediaType === "tv");

            loadTrending(currentMediaType);
            initSubTabs(currentMediaType);
            const isProgressVisible = localStorage.getItem("showProgressSections") === "true";

            document.getElementById("movieProgressContainer").style.display = (currentMediaType === "movie" && isProgressVisible) ? "flex" : "none";
            document.getElementById("tvFixedSections").style.display = (currentMediaType === "tv" && isProgressVisible) ? "flex" : "none";

        };
    });

    if (currentMediaType === "movie") {
        document.getElementById("moviesSection").style.display = "flex";
        document.getElementById("tvSection").style.display = "none";
    } else {
        document.getElementById("moviesSection").style.display = "none";
        document.getElementById("tvSection").style.display = "flex";
    }

    document.getElementById("moviesSection").classList.toggle("active", currentMediaType === "movie");
    document.getElementById("tvSection").classList.toggle("active", currentMediaType === "tv");
}

// Dropdown Toggle Logic
const hamburgerMenu = document.getElementById("hamburgerMenu");
const hamburgerDropdown = document.getElementById("hamburgerDropdown");

// Toggle dropdown on hamburger click
hamburgerMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    hamburgerDropdown.classList.toggle("open");
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
    if (!hamburgerDropdown.contains(e.target) && !hamburgerMenu.contains(e.target)) {
        hamburgerDropdown.classList.remove("open");
    }
});


// Theme Toggle Logic
themeToggleBtn.addEventListener("click", () => {
    isDarkTheme = !isDarkTheme;
    applyTheme(isDarkTheme);

    // Save the selected theme to localStorage
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
});

function setupProgressToggle() {
    const hamburgerDropdown = document.getElementById("hamburgerDropdown");

    // Create toggle switch
    const toggleItem = document.createElement("div");
    toggleItem.className = "dropdown-item toggle-switch";
    toggleItem.innerHTML = `
    <span>Progress Sections</span>
    <label class="switch">
      <input type="checkbox" id="progressToggleCheckbox">
      <span class="slider round"></span>
    </label>
  `;
    hamburgerDropdown.appendChild(toggleItem);

    const progressToggleCheckbox = document.getElementById("progressToggleCheckbox");

    // Load saved state from localStorage
    const isProgressVisible = localStorage.getItem("showProgressSections") === "true";
    progressToggleCheckbox.checked = isProgressVisible;
    applyProgressVisibility(isProgressVisible);

    // Handle toggle changes
    progressToggleCheckbox.addEventListener("change", (e) => {
        const isChecked = e.target.checked;
        localStorage.setItem("showProgressSections", isChecked);
        applyProgressVisibility(isChecked);
    });
}

function applyProgressVisibility(show) {
    const movieProgress = document.getElementById("movieProgressContainer");
    const tvProgress = document.getElementById("tvFixedSections");

    if (movieProgress) movieProgress.style.display = show ? "block" : "none";
    if (tvProgress) tvProgress.style.display = show ? "block" : "none";
}

document.getElementById('exportBackupBtn').addEventListener('click', () => {
    window.exportBackup();
});

document.getElementById('importBackupInput').addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
        window.importBackup(event.target.files[0]);
    }
});

// Function to show random favorite item in a modal
async function showRandomFavoriteItem(mediaType) {
    // Fetch all favorites (movies and TV shows)
    const favorites = await window.getFavorites();

    // Filter favorites based on active media type
    const filteredFavorites = favorites.filter(item => item.type === mediaType);

    if (filteredFavorites.length === 0) {
        alert(`No favorite ${mediaType === 'movie' ? 'movies' : 'TV shows'} found!`);
        return;
    }

    // Pick a random item
    const randomItem = filteredFavorites[Math.floor(Math.random() * filteredFavorites.length)];

    // Fetch detailed info (for genres, tagline, etc.)
    const details = await window.fetchItemDetails(randomItem.type, randomItem.id);

    // Create modal content
    const modal = document.createElement('div');
    modal.classList.add('random-item-modal');

    const backdropPath = details.backdrop_path ? window.formatImageUrl(details.backdrop_path, true) : '';
    const genres = details.genres ? details.genres.map(g => g.name).join(', ') : 'N/A';

    modal.innerHTML = `
    <div class="modal-content" style="background-image: url('${backdropPath}')">
      <div class="modal-overlay"></div>
      <span class="close-btn">&times;</span>
	    ${
              details.release_date || details.first_air_date
                ? `<h2>${details.title || details.name}</h2> <h4>${new Date(details.release_date || details.first_air_date).getFullYear()}</h4>`
                : `<h2>${details.title || details.name}</h2>`
            }
			<h4>${details.tagline || ''}</h4>
			<div class="icon-info">
			${
              details.runtime
                ? `<p><i class="fas fa-clock" style="opacity: 0.8"></i> ${details.runtime} mins</p>`
                : ''
            }
			${
              details.vote_average
                ? `<p><i class="fas fa-star" style="color:yellow; opacity: 0.8; filter:drop-shadow(0 0 3px gray)"></i> ${details.vote_average.toFixed(1)}</p>`
                : ''
            }
			${
              details.genres?.length
                ? `<p><i class="fas fa-tag" style="opacity: 0.8"></i> ${details.genres.map(g => g.name).join(', ')}</p>`
                : ''
            }
			</div>
      <p class="overview">${details.overview}</p>
      <button class="go-to-details">View Details</button>
    </div>
  `;

    document.body.appendChild(modal);

    // Close modal when clicking on close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        modal.remove();
    });

    // Close modal when clicking outside modal-content
    modal.addEventListener('click', (event) => {
        if (!event.target.closest('.modal-content')) {
            modal.remove();
        }
    });

    // Go to details page
    modal.querySelector('.go-to-details').addEventListener('click', () => {
        goToDetailPage(randomItem.id, randomItem.type);
    });
}

// Add button to favorites tab when active
function addRandomItemButton() {
    const observer = new MutationObserver(() => {
        const favoritesContainers = [{
                container: document.querySelector("#moviesContent .section h1"),
                mediaType: 'movie'
            },
            {
                container: document.querySelector("#tvContent .section h1"),
                mediaType: 'tv'
            }
        ];

        favoritesContainers.forEach(({
            container,
            mediaType
        }) => {
            if (container && container.textContent.includes('Favorite')) {
                const existingButton = container.parentNode.querySelector('.random-item-btn');

                if (!existingButton) {
                    const randomBtn = document.createElement('button');
                    randomBtn.classList.add('random-item-btn');
                    randomBtn.textContent = `🎲`;

                    randomBtn.addEventListener('click', () => showRandomFavoriteItem(mediaType));

                    container.parentNode.insertBefore(randomBtn, container.nextSibling);
                }
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function init() {
    setupToggle();
    setupSearch();
    setupProgressToggle();
    reloadFavoritesAndWatched();
    initSubTabs(currentMediaType);
    loadTrending(currentMediaType);
    setupCarouselArrows();
    resetCarouselTimer();
    const carouselContainer = document.getElementById("carouselContainer");
    enableMouseDrag(carouselContainer);
    addRandomItemButton();
}

document.addEventListener("DOMContentLoaded", init);