/**
 * fetchGeneral: base function to build a TMDB URL.
 */
window.fetchGeneral = async function(id, type, section, sectionNumber, params) {
  params = params || {};
  let url = 'https://api.themoviedb.org/3';
  if (type) url += '/' + type;
  if (id) url += '/' + id;
  if (section) {
    url += '/' + section;
    if (sectionNumber) url += '/' + sectionNumber;
  }
  params.api_key = apiKey;
  let qs = new URLSearchParams(params).toString();
  url += '?' + qs;
  try {
    let resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.json();
  } catch (err) {
    console.error('fetchGeneral error:', err);
    return null;
  }
};

/**
 * fetchTrending
 */
window.fetchTrending = async function(mediaType) {
  return await window.fetchGeneral(null, 'trending', mediaType, 'day');
};

/**
 * fetchPopular
 *   e.g. /movie/popular or /tv/popular (with page)
 */
window.fetchPopular = async function(mediaType, page) {
  page = page || 1;
  let params = {
    page: page,
    "vote_count.gte": 100,
    "vote_average.gte": 5
  };
  if (mediaType === "tv") {
    // Use discover/tv to apply genre exclusion and sort by popularity descending.
    return await window.fetchGeneral(
      null,
      "discover/tv",
      null,
      null,
      Object.assign({}, params, {
        without_genres: "10764,10766,10767",
        sort_by: "popularity.desc"
      })
    );
  } else {
    return await window.fetchGeneral(null, mediaType, 'popular', null, params);
  }
};


//*** fetchDiscoverByGenre*/
window.fetchDiscoverByGenre = async function(mediaType, genreId, page) {
  page = page || 1;
  let params = {
    with_genres: genreId,
    page: page
  };
  if (mediaType === "tv") {
    params.without_genres = "10764,10766,10767"; // Exclude reality and soap operas
    params.sort_by = "popularity.desc";   // Optional: sort by popularity
  }
  return await window.fetchGeneral(null, "discover/" + mediaType, null, null, params);
};


/**
 * searchMedia
 */
window.searchMedia = async function(query, mediaType, page) {
  page = page || 1;
  return await window.fetchGeneral(null, 'search/' + mediaType, null, null, {
    query: query, 
    page: page
  });
};

/**
 * fetchTrailer
 */
window.fetchTrailer = async function(mediaType, id) {
  let data = await window.fetchGeneral(id, mediaType, 'videos');
  if (data && data.results) {
    let trailer = data.results.find(function(v) {
      return v.type === 'Trailer' && v.site === 'YouTube';
    });
    return trailer;
  }
  return null;
};

/**
 * formatImageUrl
 */
window.formatImageUrl = function(path, hd) {
	let image; // Declare image outside

	if (hd) {
		image = path ? 'https://image.tmdb.org/t/p/w1280' + path : 'https://placehold.co/1280x720?text=No+Image' ;
		} else {
			image = path ? 'https://image.tmdb.org/t/p/w500' + path : 'https://placehold.co/500x750?text=No+Image';
			}
  return image
};

/**
 * fetchItemDetails
 */

window.fetchItemDetails = async function(type, id) {
  return await window.fetchGeneral(id, type, null, null, {
    append_to_response: 'credits,similar'
  });
};


