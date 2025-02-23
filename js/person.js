// person.js

document.addEventListener('DOMContentLoaded', async () => {
    let urlParams = new URLSearchParams(window.location.search);
    let personId = urlParams.get('id');
    let personContainer = document.getElementById('personContainer');

    // Show a loading message.
    personContainer.innerHTML = '<div class="loading">Loading person details...</div>';

    try {
        // Ensure favorites and watched data is up-to-date before rendering cards.
        await window.reloadFavoritesAndWatched();

        // Fetch person details with appended movie and TV credits.
        let person = await window.fetchGeneral(
            personId,
            'person',
            null,
            null, {
                append_to_response: 'movie_credits,tv_credits'
            }
        );

        if (!person) throw new Error('No person details found');

        // Clear loading state and build the page.
        personContainer.innerHTML = '';
        personContainer.appendChild(buildPersonHTML(person));
    } catch (error) {
        console.error('Error loading person details:', error);
        personContainer.innerHTML = '<div class="error">Failed to load person details.</div>';
    }
});

function buildPersonHTML(person) {
    // Create a container for the entire person page.
    let container = document.createElement('div');

    // Build the header section.
    let headerDiv = document.createElement('div');
    headerDiv.className = 'person-header';
    headerDiv.innerHTML = `
    ${person.profile_path 
      ? `<div class="person-backdrop" style="background-image: url('${window.formatImageUrl(person.profile_path, true)}')"></div>` 
      : ''}
    <div class="person-poster-container">
      ${person.profile_path 
        ? `<img src="${window.formatImageUrl(person.profile_path)}" class="person-poster-image" alt="${person.name}">`
        : ''}
      <div class="person-detail-content">
        <div class="person-title-section">
          <h1>${person.name}</h1>
        </div>
        ${person.biography 
          ? `<div class="person-overview">
              <h3 class="section-title">Biography</h3>
              <p>${person.biography}</p>
            </div>` 
          : ''}
      </div>
    </div>
  `;
    container.appendChild(headerDiv);

    // Build the "Known For" section using both movie and TV credits.
    if (
        (person.movie_credits && (person.movie_credits.cast?.length > 0 || person.movie_credits.crew?.length > 0)) ||
        (person.tv_credits && (person.tv_credits.cast?.length > 0 || person.tv_credits.crew?.length > 0))
    ) {
        let knownForSection = document.createElement('div');
        knownForSection.className = 'known-for-section';

        let knownForTitle = document.createElement('h3');
        knownForTitle.className = 'section-title';
        knownForTitle.textContent = 'Known For: ' + person.known_for_department;
        knownForSection.appendChild(knownForTitle);

        let horizontalScroll = document.createElement('div');
        horizontalScroll.className = 'horizontal-scroll';

        // Define minimum vote count threshold to filter obscure items
        const MIN_VOTE_COUNT = 50;

        // Use known_for_department to determine the person's main role
        const knownForDepartment = person.known_for_department;

        // Select the appropriate credits based on department
        let combinedCredits = [];
        if (knownForDepartment === 'Acting') {
            combinedCredits = [
                ...(person.movie_credits?.cast || []).map(item => ({
                    ...item,
                    media_type: 'movie'
                })),
                ...(person.tv_credits?.cast || []).map(item => ({
                    ...item,
                    media_type: 'tv'
                }))
            ];
        } else {
            combinedCredits = [
                ...(person.movie_credits?.crew || []).map(item => ({
                    ...item,
                    media_type: 'movie'
                })),
                ...(person.tv_credits?.crew || []).map(item => ({
                    ...item,
                    media_type: 'tv'
                }))
            ];
        }

        // Deduplicate combined credits based on unique id and media_type
        let uniqueCreditsMap = new Map();
        combinedCredits.forEach(item => {
            const key = `${item.media_type}_${item.id}`;
            if (!uniqueCreditsMap.has(key)) {
                uniqueCreditsMap.set(key, item);
            }
        });

        let uniqueCredits = Array.from(uniqueCreditsMap.values());

        // Filter and sort items by vote average and vote count
        let knownForItems = uniqueCredits
            .filter(item => (item.first_air_date || item.release_date) && new Date(item.first_air_date || item.release_date) <= new Date())
            .filter(item => (item.vote_count || 0) >= MIN_VOTE_COUNT)
            .filter(item => {
                // Exclude unwanted TV show types like Talk Shows or Reality TV
                if (item.media_type === 'tv') {
                    const excludedGenres = ['Talk', 'Reality', 'News', 'Game Show', 'Soap'];
                    return !excludedGenres.some(genre => (item.genre_ids || []).includes(genre) || (item.name && item.name.toLowerCase().includes(genre.toLowerCase())));
                }
                return true;
            })
            .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
            .slice(0, 20); // Take top 20

        knownForItems.forEach(item => {
            let cardElement = createMediaCard(item, item.media_type, false);
            horizontalScroll.appendChild(cardElement);
        });

        knownForSection.appendChild(horizontalScroll);
        enableHorizontalMouseDrag(horizontalScroll);
        container.appendChild(knownForSection);
    }

    return container;
}