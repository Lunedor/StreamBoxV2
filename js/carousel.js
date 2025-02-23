// carousel.js

let trendingItems = [];
let currentSlideIndex = 0;
let carouselTimer = null;
let isDragging = false; // Global flag to track dragging state
let activeHoverFrame = null; // Track active hover frame for proper cancellation

// Debounce Utility Function
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Show Slide Function
async function showSlide(index) {
    let container = document.getElementById("carouselContainer");

    // Reset carousel timer when manually changing slides
    resetCarouselTimer();

    // Remove existing visible class from current slides
    const existingSlides = container.querySelectorAll(".carousel-slide");
    existingSlides.forEach(slide => {
        slide.classList.remove("visible");
        slide.classList.add("hidden");
    });

    if (!trendingItems[index]) {
        container.innerHTML = "<p>No trending items.</p>";
        document.getElementById("carouselIndicator").textContent = "0 / 0";
        return;
    }

    let item = trendingItems[index];
    let mediaTypeLocal = item.media_type || window.currentMediaType || 'movie';

    if (!item.__fullDetails) {
        try {
            let details = await window.fetchItemDetails(mediaTypeLocal, item.id);
            item.__fullDetails = details;
        } catch (err) {
            console.error("Failed to fetch details for carousel item:", err);
            item.__fullDetails = {};
        }
    }
    let details = item.__fullDetails;

    let slide = document.createElement("div");
    slide.className = "carousel-slide hidden";
    slide.style.backgroundImage = "url(" + window.formatImageUrl(details.backdrop_path || item.backdrop_path || item.poster_path, true) + ")";

    let title = details.title || details.name || "Untitled";
    let year = details.release_date ?
        new Date(details.release_date).getFullYear() :
        details.first_air_date ?
        new Date(details.first_air_date).getFullYear() :
        "";
    slide.setAttribute("role", "button");
    slide.setAttribute("aria-label", `${title} ${year ? "(" + year + ")" : ""}`);

    let overlay = document.createElement("div");
    overlay.className = "carousel-info-overlay";
    let tagline = details.tagline ? `<div class=\"carousel-tagline\">${details.tagline}</div>` : "";
    let runtimeStr = details.runtime ? details.runtime + " mins" : (details.episode_run_time && details.episode_run_time.length ? details.episode_run_time[0] + " mins/ep" : "");
    let ratingNum = details.vote_average ? details.vote_average.toFixed(1) : "N/A";
    let starsHtml = details.vote_average ? getStarRating(details.vote_average / 2) : "";
    overlay.innerHTML = `
    <h4 class=\"carousel-title\">${title} ${year ? "(" + year + ")" : ""}</h4>
    ${tagline}
    <div class=\"carousel-metadata\">
      ${details.vote_average ? `<span class=\"carousel-rating-stars\">${starsHtml} <b>${ratingNum}</b></span>` : ""}
    </div>
  `;
    slide.appendChild(overlay);

    let frag = document.createDocumentFragment();
    frag.appendChild(slide);
    container.appendChild(frag);

    // Force reflow to ensure CSS animation triggers
    void slide.offsetWidth;
    slide.classList.remove("hidden");
    slide.classList.add("visible");

    updateIndicators(currentSlideIndex, trendingItems.length);

    // Hover Events
    slide.addEventListener("mouseenter", function() {
        if (isDragging) return; // Prevent hover logic during/after drag
        clearInterval(carouselTimer);
        slide.setAttribute("data-hover", "true");

        const indicator = document.getElementById("circleIndicator");
        indicator.style.display = "flex";
        const progressCircle = indicator.querySelector(".progress-circle");
        progressCircle.classList.add("animate-progress");

        slide.hoverStart = performance.now();

        if (activeHoverFrame) cancelAnimationFrame(activeHoverFrame); // Cancel any previous hover frames

        activeHoverFrame = requestAnimationFrame(function check() {
            if (!slide.getAttribute("data-hover")) return;
            const elapsed = performance.now() - slide.hoverStart;
            if (elapsed >= 3000 && !slide.getAttribute("data-trailer-playing")) {
                playTrailer(item, slide, mediaTypeLocal);
                // Hide indicator when trailer starts
                indicator.style.display = "none";
                progressCircle.classList.remove("animate-progress");
            } else {
                activeHoverFrame = requestAnimationFrame(check);
            }
        });
    });

    slide.addEventListener("mouseleave", function() {
        slide.removeAttribute("data-hover");
        cancelAnimationFrame(activeHoverFrame);

        const indicator = document.getElementById("circleIndicator");
        indicator.style.display = "none";
        const progressCircle = indicator.querySelector(".progress-circle");
        progressCircle.classList.remove("animate-progress");

        if (slide.getAttribute("data-trailer-playing")) {
            slide.innerHTML = "";
            slide.style.backgroundImage = "url(" + window.formatImageUrl(details.backdrop_path || item.backdrop_path || item.poster_path, true) + ")";
            slide.removeAttribute("data-trailer-playing");
            slide.appendChild(overlay);

            document.getElementById("carouselIndicators").style.display = "flex";
            document.querySelector(".carousel-arrows").style.display = "flex";
        }
        startCarousel();
    });

    slide.addEventListener("click", function() {
        goToDetailPage(item.id, mediaTypeLocal);
    });
}

// Reset Carousel Timer
function resetCarouselTimer() {
    clearInterval(carouselTimer);
    carouselTimer = setInterval(() => {
        currentSlideIndex = (currentSlideIndex + 1) % trendingItems.length;
        showSlide(currentSlideIndex);
    }, 5000); // Reset to 5 seconds on each manual change
}

// Play Trailer Function
async function playTrailer(item, slide, mediaTypeLocal) {
    let trailer;
    if (!window.trailerCache) window.trailerCache = {};
    if (window.trailerCache[item.id]) {
        trailer = window.trailerCache[item.id];
    } else {
        trailer = await window.fetchTrailer(mediaTypeLocal, item.id);
        window.trailerCache[item.id] = trailer;
    }
    if (trailer && trailer.key) {
        if (!slide.getAttribute("data-hover")) return;
        slide.innerHTML = "";
        const iframe = document.createElement("iframe");
        iframe.allow = "autoplay; encrypted-media";
        iframe.setAttribute("allowfullscreen", true);
        iframe.className = "trailer-iframe";
        iframe.src = "https://www.youtube.com/embed/" + trailer.key + "?autoplay=1&controls=1&modestbranding=1&showinfo=0";
        slide.appendChild(iframe);
        slide.setAttribute("data-trailer-playing", "true");

        // Hide carousel controls when trailer starts
        document.getElementById("carouselIndicators").style.display = "none";
        document.querySelector(".carousel-arrows").style.display = "none";
    }
}

function startCarousel() {
    clearInterval(carouselTimer);
    carouselTimer = setInterval(function() {
        currentSlideIndex = (currentSlideIndex + 1) % trendingItems.length;
        showSlide(currentSlideIndex);
    }, 5000);
}

async function loadTrending(mediaType) {
    let cacheStr = localStorage.getItem("trending_" + mediaType);
    let useCache = false;
    if (cacheStr) {
        try {
            let cobj = JSON.parse(cacheStr);
            if (Date.now() - cobj.timestamp < 24 * 3600 * 1000) {
                trendingItems = cobj.data;
                useCache = true;
            }
        } catch (e) {}
    }
    if (!useCache) {
        let resp = await window.fetchTrending(mediaType);
        trendingItems = resp && resp.results ? resp.results : [];
        localStorage.setItem("trending_" + mediaType, JSON.stringify({
            timestamp: Date.now(),
            data: trendingItems
        }));
    }
    currentSlideIndex = 0;
    showSlide(0);
    startCarousel();
}

function setupCarouselArrows() {
    let carouselPrev = document.getElementById("carouselPrev");
    carouselPrev.onclick = function() {
        if (trendingItems.length) {
            currentSlideIndex = (currentSlideIndex - 1 + trendingItems.length) % trendingItems.length;
            showSlide(currentSlideIndex);
            resetIndicator();
        }
    };
    let carouselNext = document.getElementById("carouselNext");
    carouselNext.onclick = function() {
        if (trendingItems.length) {
            currentSlideIndex = (currentSlideIndex + 1) % trendingItems.length;
            showSlide(currentSlideIndex);
            resetIndicator();
        }
    };
}

function updateIndicators(currentIndex, totalSlides) {
    const indicatorsContainer = document.getElementById("carouselIndicators");
    indicatorsContainer.innerHTML = "";
    for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement("span");
        dot.className = "indicator" + (i === currentIndex ? " active" : "");
        dot.addEventListener("click", () => {
            currentSlideIndex = i;
            showSlide(currentSlideIndex);
            clearInterval(carouselTimer);
            startCarousel();
            resetIndicator();
        });
        indicatorsContainer.appendChild(dot);
    }
}

function cleanupCarousel() {
    clearInterval(carouselTimer);
    trendingItems = [];
    document.getElementById("carouselContainer").innerHTML = "";
    document.getElementById("carouselPrev").onclick = null;
    document.getElementById("carouselNext").onclick = null;
}

window.addEventListener("beforeunload", cleanupCarousel);

// Enable Mouse Drag Function
function enableMouseDrag(carouselElement) {
    let startX = 0;

    carouselElement.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.pageX;
        carouselElement.style.cursor = "grabbing";
        resetIndicator();
        if (activeHoverFrame) cancelAnimationFrame(activeHoverFrame); // Cancel hover frame during drag
    });

    window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const diffX = e.pageX - startX;

        if (Math.abs(diffX) > 50) {
            if (diffX > 0) {
                currentSlideIndex = (currentSlideIndex - 1 + trendingItems.length) % trendingItems.length;
            } else {
                currentSlideIndex = (currentSlideIndex + 1) % trendingItems.length;
            }
            showSlide(currentSlideIndex);
            resetIndicator();
            isDragging = false;
        }
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
        carouselElement.style.cursor = "grab";
    });

    carouselElement.addEventListener("touchstart", (e) => {
        isDragging = true;
        startX = e.touches[0].clientX;
        resetIndicator();
        if (activeHoverFrame) cancelAnimationFrame(activeHoverFrame); // Cancel hover frame during drag
    });

    carouselElement.addEventListener("touchmove", (e) => {
        if (!isDragging) return;
        const diffX = e.touches[0].clientX - startX;

        if (Math.abs(diffX) > 50) {
            if (diffX > 0) {
                currentSlideIndex = (currentSlideIndex - 1 + trendingItems.length) % trendingItems.length;
            } else {
                currentSlideIndex = (currentSlideIndex + 1) % trendingItems.length;
            }
            showSlide(currentSlideIndex);
            resetIndicator();
            isDragging = false;
        }
    });

    carouselElement.addEventListener("touchend", () => {
        isDragging = false;
    });
}

// Reset Hover Indicator
function resetIndicator() {
    const indicator = document.getElementById("circleIndicator");
    indicator.style.display = "none";
    const progressCircle = indicator.querySelector(".progress-circle");
    progressCircle.classList.remove("animate-progress");
    if (activeHoverFrame) cancelAnimationFrame(activeHoverFrame); // Ensure hover frame is canceled
}