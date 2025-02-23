// common.js

let adminConfig = {
    movieGenres: [{
            name: "Action",
            id: 28
        },
        {
            name: "Animation",
            id: 16
        },
        {
            name: "Crime",
            id: 80
        },
        {
            name: "Drama",
            id: 18
        },
        {
            name: "Science Fiction",
            id: 878
        },
        {
            name: "Fantasy",
            id: 14
        },
        {
            name: "Comedy",
            id: 35
        },
        {
            name: "Documentary",
            id: 99
        },
        {
            name: "Romance",
            id: 10749
        },
        {
            name: "Family",
            id: 10751
        },
        {
            name: "Horror",
            id: 27
        },
        {
            name: "Thriller",
            id: 53
        },
        {
            name: "War",
            id: 10752
        },
        {
            name: "Western",
            id: 37
        }
    ],
    tvGenres: [{
            name: "Action & Adventure",
            id: 10759
        },
        {
            name: "Animation",
            id: 16
        },
        {
            name: "Crime",
            id: 80
        },
        {
            name: "Drama",
            id: 18
        },
        {
            name: "Sci-Fi & Fantasy",
            id: 10765
        },
        {
            name: "Comedy",
            id: 35
        },
        {
            name: "Documentary",
            id: 99
        },
        {
            name: "Family",
            id: 10751
        },
        {
            name: "Mistery",
            id: 9648
        },
        {
            name: "War & Politics",
            id: 10768
        },
    ]
};
// Globals:
window.mediaItems = {};
window.favorites = [];
window.watched = [];

function formatTime(seconds) {
    let h = Math.floor(seconds / 3600);
    let m = Math.floor((seconds % 3600) / 60);
    let s = Math.floor(seconds % 60);
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function enableHorizontalMouseDrag(container) {
    let isDown = false;
    let startX;
    let scrollLeft;
    let dragOccurred = false; // Flag to track drag

    container.addEventListener('mousedown', (e) => {
        isDown = true;
        dragOccurred = false; // Reset on mousedown
        container.classList.add('active-drag');
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });

    container.addEventListener('mouseleave', () => {
        isDown = false;
        container.classList.remove('active-drag');
    });

    container.addEventListener('mouseup', () => {
        isDown = false;
        container.classList.remove('active-drag');
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault(); // Prevent text selection
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX); // Adjust scroll speed
        container.scrollLeft = scrollLeft - walk;
        dragOccurred = true; // Dragging is happening!
    });

    // Prevent click IFF dragging occurred
    container.addEventListener('click', (e) => {
        if (dragOccurred) {
            e.stopPropagation(); // VERY IMPORTANT: Stop bubbling
        }
    }, true); // Use Capture Phase!
}
// Favori/Watched:
async function reloadFavoritesAndWatched() {
    window.favorites = await window.getFavorites();
    window.watched = await window.getWatched();
}

window.isFavorited = function(id, type) {
    return window.favorites.some(f => f.id == id && f.type === type);
};

window.isWatched = function(id, type) {
    return window.watched.some(w => w.id == id && w.type === type);
};

async function toggleFavorite(id, type, cardEl) {
    let already = isFavorited(id, type);
    if (already) {
        await window.removeFavorite(id, type);
    } else {
        let item = window.mediaItems[id];
        if (item) {
            await window.addFavorite(item);
        }
    }
    await reloadFavoritesAndWatched();
    if (cardEl) updateCardIcons(id, type, cardEl);
    if (window.currentTvSubTab === "favorites" || window.currentMoviesSubTab === "favorites") {
        renderTab(type, "favorites");
    }
}

async function toggleWatched(id, type, cardEl) {
    let already = isWatched(id, type);
    if (already) {
        await window.removeWatched(id, type);
    } else {
        let item = window.mediaItems[id];
        if (item) {
            await window.addWatched(item);
        }
    }
    await reloadFavoritesAndWatched();
    if (cardEl) updateCardIcons(id, type, cardEl);
    if (window.currentTvSubTab === "watched" || window.currentMoviesSubTab === "watched") {
        renderTab(type, "watched");
    }
}

// Icon Update:
function updateCardIcons(id, type, cardEl) {
    if (!cardEl) return;
    let favBtn = cardEl.querySelector(".fav-btn");
    let watBtn = cardEl.querySelector(".watched-btn");
    if (isFavorited(id, type)) {
        favBtn.innerHTML = '<i class="fas fa-heart" style="color:#e50914;"></i>';
    } else {
        favBtn.innerHTML = '<i class="far fa-heart"></i>';
    }
    if (isWatched(id, type)) {
        watBtn.innerHTML = '<i class="fas fa-eye" style="color:#0f0;"></i>';
    } else {
        watBtn.innerHTML = '<i class="far fa-eye"></i>';
    }
}

// Global Sets to store available movie and TV show IDs
window.availableMovieIDs = new Set();
window.availableTVIDs = new Set();

// Function to fetch and cache available IDs
async function fetchAvailableIDs() {
    try {
        // Fetch movie IDs
        const movieResponse = await fetch('https://vidsrc.me/ids/mov_tmdb.txt');
        const movieText = await movieResponse.text();
        window.availableMovieIDs = new Set(movieText.trim().split('\n').map(id => parseInt(id)));

        // Fetch TV show IDs
        const tvResponse = await fetch('https://vidsrc.me/ids/tv_tmdb.txt');
        const tvText = await tvResponse.text();
        window.availableTVIDs = new Set(tvText.trim().split('\n').map(id => parseInt(id)));

        console.log('Available IDs updated');
    } catch (error) {
        console.error('Error fetching available IDs:', error);
    }
}

async function ensureAvailableIDs() {
    if (!window.availableMovieIDs || window.availableMovieIDs.size === 0 ||
        !window.availableTVIDs || window.availableTVIDs.size === 0) {
        await fetchAvailableIDs();
    }
}

// Refresh available IDs every hour
setInterval(fetchAvailableIDs, 60 * 60 * 1000);

// Modify createMediaCard to include available icon
function createMediaCard(item, type) {
    window.mediaItems[item.id] = item;
    item.type = type;

    let title = item.name ? item.name : item.title ? item.title : "Unknown";
    let rating = typeof item.vote_average === 'number' ? item.vote_average.toFixed(1) : "0";
    let year = item.release_date ? new Date(item.release_date).getFullYear() : item.first_air_date ? new Date(item.first_air_date).getFullYear() : "N/A";

    let card = document.createElement("div");
    card.className = "media-card";
    card.setAttribute("data-id", item.id);
    card.setAttribute("data-type", type);

    card.innerHTML = `
    <img src="${window.formatImageUrl(item.poster_path, false)}" alt="${title}">
    <div class="card-actions">
      <button class="fav-btn" aria-label="Favorite"></button>
      <button class="watched-btn" aria-label="Watched"></button>
    </div>
  `;

    let titleOverlay = document.createElement("div");
    titleOverlay.className = "media-title-overlay";
    let titleElement = document.createElement("span");
    titleElement.className = "movie-title";
    titleElement.textContent = title;
    let ratingContainer = document.createElement("div");
    ratingContainer.className = "rating-container";
    let yearElement = document.createElement("span");
    yearElement.className = "movie-year";
    yearElement.textContent = year;
    let starsContainer = document.createElement("div");
    starsContainer.className = "rating-stars";
    starsContainer.innerHTML = getStarRating(item.vote_average / 2);
    let ratingText = document.createElement("div");
    ratingText.className = "rating-text";
    ratingText.textContent = rating;
    ratingContainer.appendChild(yearElement);
    ratingContainer.appendChild(starsContainer);
    ratingContainer.appendChild(ratingText);
    titleOverlay.appendChild(titleElement);
    titleOverlay.appendChild(ratingContainer);
    card.appendChild(titleOverlay);
    titleOverlay.addEventListener("click", () => goToDetailPage(item.id, type));
    updateCardIcons(item.id, type, card);

    let favBtn = card.querySelector(".fav-btn");
    let watBtn = card.querySelector(".watched-btn");

    favBtn.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(item.id, type, card);
    };
    watBtn.onclick = (e) => {
        e.stopPropagation();
        toggleWatched(item.id, type, card);
    };

    let isAvailable = (type === 'movie' && window.availableMovieIDs.has(item.id)) ||
        (type === 'tv' && window.availableTVIDs.has(item.id));
    if (isAvailable) {
        let availableIcon = document.createElement("div");
        availableIcon.className = "available-icon";
        availableIcon.innerHTML = '<i class="fas fa-play-circle" style="color:#00ff00; font-size: 2em;"></i>';
        card.appendChild(availableIcon);
    }

    // 3D tilt and shadow effects
    card.addEventListener("mousemove", handleCardMouseMove);
    card.addEventListener("mouseleave", handleCardMouseLeave);

    return card;
}

// Add CSS for available-icon
document.addEventListener("DOMContentLoaded", function() {
    const style = document.createElement('style');
    style.textContent = `
    .available-icon {
      position: absolute;
      top: 5px;
      right: 5px;
      z-index: 10;
	  filter: drop-shadow(2px 4px 6px black);
    }
  `;
    document.head.appendChild(style);
});

function handleCardMouseMove(e) {
    const card = e.currentTarget;

    if (e.target.closest('.card-actions')) {
        card.style.transform = "perspective(500px) rotateX(0deg) rotateY(0deg) scale(1)";
        card.style.boxShadow = "none";
        return;
    }

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const maxTilt = 10; // maximum tilt (degree)
    const tiltY = ((x - centerX) / centerX) * maxTilt;
    const tiltX = -((y - centerY) / centerY) * maxTilt;

    card.style.transform = `perspective(500px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.04)`;

    const shadowX = -tiltY;
    const shadowY = -tiltX;
    card.style.boxShadow = `${shadowX}px ${shadowY}px 20px rgba(0, 0, 0, 0.4)`;
}

function handleCardMouseLeave(e) {
    const card = e.currentTarget;
    card.style.transform = "perspective(500px) rotateX(0deg) rotateY(0deg) scale(1)";
    card.style.boxShadow = "none";
}

function getStarRating(rating) {
    rating = Math.max(0, Math.min(rating, 5));
    let fullStars = Math.floor(rating);
    let decimalPart = rating - fullStars;
    let hasHalfStar = decimalPart >= 0.5;
    let emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    let starsHtml = "";
    for (let index = 0; index < fullStars; index++) starsHtml += '<i class="fa-duotone fa-solid fa-star"></i>';
    if (hasHalfStar) starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
    for (let index = 0; index < emptyStars; index++) starsHtml += '<i class="fa-duotone fa-regular fa-star"></i>';
    return starsHtml;
}

// Function to navigate to the details page
function goToDetailPage(itemId, type) {
    window.location.href = `details.html?id=${itemId}&type=${type}`;
}

// Function to navigate to the person page
function goPersonPage(personId) {
    window.location.href = `person.html?id=${personId}`;
}

// When the user scrolls down 20px from the top of the document, show the button
window.addEventListener("scroll", function() {
    let goTopBtn = document.getElementById("goTopBtn");
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        goTopBtn.style.display = "block";
    } else {
        goTopBtn.style.display = "none";
    }
});

// When the user clicks on the button, scroll to the top of the document
document.getElementById("goTopBtn").addEventListener("click", function() {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});
// Check saved theme in localStorage on page load
let isDarkTheme = localStorage.getItem('theme') === 'dark' || !localStorage.getItem('theme'); // Default to dark
const themeToggleBtn = document.getElementById("themeToggleBtn");
// Function to Apply Theme
function applyTheme(darkTheme) {
    document.documentElement.style.setProperty('--background-color', darkTheme ? '#1b1b1b' : '#FBFBFB');
    document.documentElement.style.setProperty('--text-color', darkTheme ? '#e0e0e0' : '#000000');
    document.documentElement.style.setProperty('--hover-color', darkTheme ? 'crimson' : 'crimson');
    document.documentElement.style.setProperty('--border-color', darkTheme ? '#333' : '#ccc');
    document.documentElement.style.setProperty('--accent-color', darkTheme ? '#888888' : '#888888');
    document.documentElement.style.setProperty('--button-color', darkTheme ? '#ccc' : '#333');
    document.documentElement.style.setProperty('--img-filter', darkTheme ? 'invert(0.8)' : 'invert(0)');
    document.documentElement.style.setProperty('--logo-filter', darkTheme ? 'invert(0)' : 'invert(1)');
    document.documentElement.style.setProperty('--scrollbar-thumb', darkTheme ? '#606060' : '#ddd');
    document.documentElement.style.setProperty('--scrollbar-track', darkTheme ? '#202020' : '#bbb');
    themeToggleBtn ? themeToggleBtn.textContent = darkTheme ? "Switch to Light Theme" : "Switch to Dark Theme" : "";
}

applyTheme(isDarkTheme);