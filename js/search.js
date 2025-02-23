// search.js

let currentSearchQuery = "";
let currentSearchPages = {
    movie: 1,
    tv: 1,
    person: 1
};
let totalSearchPages = {
    movie: 1,
    tv: 1,
    person: 1
};
let searchLoading = {
    movie: false,
    tv: false,
    person: false
};

function setupSearch() {
    let searchBtn = document.getElementById("searchBtn");
    let searchInput = document.getElementById("searchInput");
    let closeBtn = document.getElementById("closeSearchModal");
    let modal = document.getElementById("searchModal");

    searchBtn.onclick = async function() {
        let q = searchInput.value.trim();
        if (!q) return;
        initializeSearchState(q);
        await performSearchAll(1);
        modal.classList.remove("hidden");
        disableBodyScroll();
    };

    searchInput.oninput = debounce(async function() {
        let q = searchInput.value.trim();
        if (q.length > 2) {
            initializeSearchState(q);
            await performSearchAll(1);
            modal.classList.remove("hidden");
            disableBodyScroll();
        }
    }, 500);

    closeBtn.onclick = function() {
        modal.classList.add("hidden");
        enableBodyScroll();
    };

    document.querySelectorAll(".modal-tab-btn").forEach(function(tb) {
        tb.onclick = function() {
            document.querySelectorAll(".modal-tab-btn").forEach(function(x) {
                x.classList.remove("active");
            });
            this.classList.add("active");

            let t = this.getAttribute("data-tab");
            document.getElementById("modalResultsMovies").classList.remove("active");
            document.getElementById("modalResultsTV").classList.remove("active");
            document.getElementById("modalResultsPerson").classList.remove("active");
            if (t === "movies") {
                document.getElementById("modalResultsMovies").classList.add("active");
            } else if (t === "tv") {
                document.getElementById("modalResultsTV").classList.add("active");
            } else {
                document.getElementById("modalResultsPerson").classList.add("active");
            }

        };
    });
}

function disableBodyScroll() {
    document.body.style.overflow = "hidden";
}

function enableBodyScroll() {
    document.body.style.overflow = "";
}

function getSearchResultsContainer(mediaType) {
    if (mediaType === "movie") return document.getElementById("modalResultsMovies");
    if (mediaType === "tv") return document.getElementById("modalResultsTV");
    if (mediaType === "person") return document.getElementById("modalResultsPerson");
    return null;
}

function initializeSearchState(query) {
    currentSearchQuery = query;
    currentSearchPages = {
        movie: 1,
        tv: 1,
        person: 1
    };
    totalSearchPages = {
        movie: 1,
        tv: 1,
        person: 1
    };
    searchLoading = {
        movie: false,
        tv: false,
        person: false
    }; // Reset loading state

    // Clear only the *inner* wrapper, and remove "Load More" button
    ["movie", "tv", "person"].forEach(type => {
        const container = getSearchResultsContainer(type);
        const wrapper = container.querySelector(".search-results-wrapper");
        if (wrapper) {
            wrapper.innerHTML = "";
        }
        let existingBtn = container.querySelector(".load-more-btn");
        if (existingBtn) {
            existingBtn.remove();
        }
    });
}

async function performSearchAll(page) {
    // 1. ENSURE WRAPPERS EXIST:  This is the crucial fix.
    ["movie", "tv", "person"].forEach(type => {
        const container = getSearchResultsContainer(type);
        let wrapper = container.querySelector(".search-results-wrapper");
        if (!wrapper) {
            wrapper = document.createElement("div");
            wrapper.className = "search-results-wrapper";
            container.appendChild(wrapper);
        }
    });

    // 2. Now make the API calls (they can still be concurrent)
    let [mData, tData, pData] = await Promise.all([
        window.searchMedia(currentSearchQuery, "movie", page),
        window.searchMedia(currentSearchQuery, "tv", page),
        window.searchMedia(currentSearchQuery, "person", page)
    ]);

    // 3. Safe to call appendSearchResults, because wrappers are guaranteed to exist
    totalSearchPages.movie = mData?.total_pages ?? 1;
    totalSearchPages.tv = tData?.total_pages ?? 1;
    totalSearchPages.person = pData?.total_pages ?? 1;

    appendSearchResults("movie", mData?.results || [], "movie");
    appendSearchResults("tv", tData?.results || [], "tv");
    appendSearchResults("person", pData?.results || [], "person");
}

function appendSearchResults(mediaType, items, type) {
    let container = getSearchResultsContainer(mediaType);
    // Get the wrapper (it's guaranteed to exist now)
    let wrapper = container.querySelector(".search-results-wrapper");

    items.forEach(item => {
        let card;
        if (type === "person") {
            card = createPersonCard({
                id: item.id,
                name: item.name,
                poster_path: item.profile_path,
                type: "person"
            });
        } else {
            card = createMediaCard(item, type);
        }
        wrapper.appendChild(card); // Append to the wrapper
    });

    // Remove any existing "Load More" button.
    let existingBtn = container.querySelector(".load-more-btn");
    if (existingBtn) {
        existingBtn.remove();
    }

    // Add "Load More" button *outside* the wrapper, if needed.
    if (currentSearchPages[mediaType] < totalSearchPages[mediaType] && items.length > 0) {
        let loadMoreBtn = document.createElement("button");
        loadMoreBtn.className = "load-more-btn";
        loadMoreBtn.textContent = "Load More";
        loadMoreBtn.style.display = "block";
        loadMoreBtn.style.margin = "20px auto"; // Center horizontally
        loadMoreBtn.addEventListener("click", () => {
            currentSearchPages[mediaType]++;
            loadMoreSearchResults(mediaType);
            loadMoreBtn.remove(); // Remove after successful load
        });
        container.appendChild(loadMoreBtn); // Append to the *container*, not the wrapper
    }
}

async function loadMoreSearchResults(mediaType) {
    if (searchLoading[mediaType]) return; // Prevent multiple simultaneous loads
    searchLoading[mediaType] = true;
    let data = await window.searchMedia(currentSearchQuery, mediaType, currentSearchPages[mediaType]);
    totalSearchPages[mediaType] = data?.total_pages ?? totalSearchPages[mediaType];
    appendSearchResults(mediaType, data?.results || [], mediaType);
    searchLoading[mediaType] = false; // Reset loading state
}

function debounce(fn, delay) {
    let stTimeout;
    return function() {
        clearTimeout(stTimeout);
        let args = arguments;
        stTimeout = setTimeout(() => fn.apply(null, args), delay);
    };
}

function createPersonCard(item) {
    let card = document.createElement("div");
    card.className = "person-card";
    card.setAttribute("data-id", item.id);
    card.innerHTML = `
    <img src="${
      item.poster_path
        ? window.formatImageUrl(item.poster_path, false)
        : "https://placehold.co/500x750?text=No+Image"
    }" alt="${item.name}">
    <div class="person-name">${item.name}</div>
  `;
    card.addEventListener("click", () => {
        goPersonPage(item.id);
    });
    return card;
}