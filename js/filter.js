// filter.js

document.addEventListener("DOMContentLoaded", function() {
    // DOM elements 
    let filterForm = document.getElementById("filterForm");
    let mediaTypeSelect = document.getElementById("mediaType");
    let genreSelectionContainer = document.getElementById("genreSelection");
    let fromYearInput = document.getElementById("fromYear");
    let toYearInput = document.getElementById("toYear");
    let sortBySelect = document.getElementById("sortBy");
    let filterResultsContainer = document.getElementById("filterResults");

    // Watched and Favorited checkboxes
    let watchedCheckbox = document.getElementById("watchedFilter");
    let favoritedCheckbox = document.getElementById("favoritedFilter");

    // Define global filter parameters
    let currentFilterParams = {};
    let filterPage = 1;

    // Genre chip creation
    function populateGenres(mediaType) {
        genreSelectionContainer.innerHTML = "";
        let genres = mediaType === "movie" ? adminConfig.movieGenres : adminConfig.tvGenres;
        genres.forEach(g => {
            let chip = document.createElement("button");
            chip.type = "button";
            chip.className = "genre-chip";
            chip.dataset.genreId = g.id;
            chip.textContent = g.name;
            chip.addEventListener("click", function() {
                chip.classList.toggle("selected");
            });
            genreSelectionContainer.appendChild(chip);
        });
    }
    populateGenres(mediaTypeSelect.value);
    mediaTypeSelect.addEventListener("change", function() {
        populateGenres(this.value);
    });

    // Enable "To Year" input after 4 characters in "From Year"
    fromYearInput.addEventListener("input", function() {
        if (this.value.length === 4) {
            toYearInput.disabled = false;
        } else {
            toYearInput.disabled = true;
            toYearInput.value = "";
        }
    });

    // Helper function to apply filters to local items (watched/favorited)
    function applyLocalFilters(items, genres, fromYear, toYear, minVote, maxVote) {
        return items.filter(item => {
            // Normalize item genres to IDs
            let itemGenreIds = [];
            if (Array.isArray(item.genre_ids)) {
                if (typeof item.genre_ids[0] === 'object') {
                    itemGenreIds = item.genre_ids.map(g => g.id);
                } else {
                    itemGenreIds = item.genre_ids;
                }
            }

            // Filter by genres
            if (genres.length > 0) {
                if (!itemGenreIds.length || !genres.every(g => itemGenreIds.includes(g))) return false;
            }

            // Filter by release year
            let releaseDate = item.release_date || item.first_air_date || "";
            let releaseYear = releaseDate.split("-")[0];
            if (fromYear && releaseYear < fromYear) return false;
            if (toYear && releaseYear > toYear) return false;

            // Filter by vote average
            if (minVote && item.vote_average < parseFloat(minVote)) return false;
            if (maxVote && item.vote_average > parseFloat(maxVote)) return false;

            return true;
        });
    }

    // Helper function to sort items
    function sortItems(items, sortBy) {
        return items.sort((a, b) => {
            if (sortBy === "popularity.desc") return b.popularity - a.popularity;
            if (sortBy === "popularity.asc") return a.popularity - b.popularity;
            if (sortBy === "vote_average.desc") return b.vote_average - a.vote_average;
            if (sortBy === "vote_average.asc") return a.vote_average - b.vote_average;
            let dateA = new Date(a.release_date || a.first_air_date);
            let dateB = new Date(b.release_date || b.first_air_date);
            if (sortBy === "release_date.desc") return dateB - dateA;
            if (sortBy === "release_date.asc") return dateA - dateB;
            return 0;
        });
    }

    // Collect filter parameters and update results
    async function updateFilterResults(reset = true) {
        if (reset) filterPage = 1;
        let mediaType = mediaTypeSelect.value;
        let fromYear = fromYearInput.value;
        let toYear = toYearInput.value;
        let minVote = document.getElementById("minVote").value;
        let maxVote = document.getElementById("maxVote").value;
        let sortBy = sortBySelect ? sortBySelect.value : "";

        // Selected genres
        let selectedChips = document.querySelectorAll("#genreSelection .genre-chip.selected");
        let genres = Array.from(selectedChips).map(chip => parseInt(chip.dataset.genreId));

        // API parameters
        currentFilterParams = {
            page: filterPage
        };
        if (fromYear && toYear) {
            currentFilterParams["primary_release_date.gte"] = fromYear + "-01-01";
            currentFilterParams["primary_release_date.lte"] = toYear + "-12-31";
        } else if (fromYear) {
            currentFilterParams.primary_release_year = fromYear;
        }
        if (genres.length) currentFilterParams.with_genres = genres.join(",");
        if (minVote) currentFilterParams["vote_average.gte"] = minVote;
        if (maxVote) currentFilterParams["vote_average.lte"] = maxVote;
        if (sortBy) currentFilterParams.sort_by = sortBy;
        currentFilterParams["vote_count.gte"] = 50;

        let isWatched = watchedCheckbox.checked;
        let isFavorited = favoritedCheckbox.checked;

        let allItems = [];

        // Handle Watched and Favorited filters with mediaType and extra filtering
        if (isWatched) {
            let watchedItems = await window.getWatched();
            watchedItems = watchedItems.filter(item => item.type === mediaType);
            watchedItems = applyLocalFilters(watchedItems, genres, fromYear, toYear, minVote, maxVote);
            allItems = allItems.concat(watchedItems);
        }

        if (isFavorited) {
            let favoritedItems = await window.getFavorites();
            favoritedItems = favoritedItems.filter(item => item.type === mediaType);
            favoritedItems = applyLocalFilters(favoritedItems, genres, fromYear, toYear, minVote, maxVote);
            allItems = allItems.concat(favoritedItems);
        }
        await reloadFavoritesAndWatched();
        // If no watched/favorited filter, fetch from API
        if (!isWatched && !isFavorited) {

            let endpoint = mediaType === "tv" ? "discover/tv" : "discover/movie";
            let data = await window.fetchGeneral(null, endpoint, null, null, currentFilterParams);
            allItems = data && data.results ? data.results : [];
        }

        // Apply sorting to local data
        if (sortBy) {
            allItems = sortItems(allItems, sortBy);
        }

        // Render results after filtering
        renderFilterResults(allItems, mediaType, reset, !isWatched && !isFavorited);
    }

    // Apply Filter button
    if (filterForm) {
        filterForm.addEventListener("submit", async function(e) {
            e.preventDefault();
            await updateFilterResults(true);
        });
    }

    // Sorting
    if (sortBySelect) {
        sortBySelect.addEventListener("change", async function() {
            if (filterResultsContainer && filterResultsContainer.childElementCount > 0) {
                await updateFilterResults(true);
            }
        });
    }

    // Load More function
    async function loadMoreFilterResults(mediaType) {
        filterPage++;
        currentFilterParams.page = filterPage;
        let endpoint = mediaType === "tv" ? "discover/tv" : "discover/movie";
        let data = await window.fetchGeneral(null, endpoint, null, null, currentFilterParams);
        let results = data && data.results ? data.results : [];
        renderFilterResults(results, mediaType, false, true);
    }

    // Render results
    function renderFilterResults(results, mediaType, reset = false, isApiData = true) {
        if (reset) filterResultsContainer.innerHTML = "";
        if (results.length === 0 && reset) {
            filterResultsContainer.innerHTML = "<p>No results found.</p>";
            return;
        }
        results.forEach(item => {
            let card = createMediaCard(item, mediaType);
            filterResultsContainer.appendChild(card);
        });

        let loadMoreBtn = document.getElementById("loadMoreBtn");
        if (loadMoreBtn) {
            loadMoreBtn.style.display = isApiData && results.length > 0 ? "block" : "none";
            loadMoreBtn.onclick = function() {
                loadMoreFilterResults(mediaType);
            };
        }
    }
});

document.addEventListener("DOMContentLoaded", function() {
    document.querySelectorAll('.number-input').forEach(function(wrapper) {
        let input = wrapper.querySelector("input");
        let plusBtn = wrapper.querySelector(".plus");
        let minusBtn = wrapper.querySelector(".minus");

        plusBtn.addEventListener("click", function() {
            input.stepUp();
            input.dispatchEvent(new Event("input"));
        });

        minusBtn.addEventListener("click", function() {
            input.stepDown();
            input.dispatchEvent(new Event("input"));
        });
    });
});