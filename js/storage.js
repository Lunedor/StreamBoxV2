// js/storage.js

let db = new Dexie("StreamBoxDB");
db.version(1).stores({
  favorites: "id, type, timestamp",
  watched: "id, type, timestamp",
  tvProgress: "&id, season, episode, inProduction, currentTime, totalDuration, nextEpisode, nextSeason, nextEpisodeAirDate, lastSeason, lastEpisode, lastEpisodeAirDate, updatedAt",
  movieProgress: "&id, currentTime, totalTime, updatedAt"
});

window.addTvProgress = async function(
  id,
  season,
  episode,
  inProduction,
  currentTime,
  totalDuration,
  nextEpisode = null,
  nextSeason = null,
  nextEpisodeAirDate = null,
  lastSeason = null,
  lastEpisode = null,
  lastEpisodeAirDate = null
) {
  return db.tvProgress.put({
    id,
    season,
    episode,
    inProduction,
    currentTime,
    totalDuration,
    nextEpisode,
    nextSeason,
    nextEpisodeAirDate,
    lastSeason,
    lastEpisode,
    lastEpisodeAirDate,
    updatedAt: Date.now()
  });
};

window.updateTvProgress = async function(
  id,
  season,
  episode,
  inProduction,
  currentTime,
  totalDuration,
  nextEpisode = null,
  nextSeason = null,
  nextEpisodeAirDate = null,
  lastSeason = null,
  lastEpisode = null,
  lastEpisodeAirDate = null
) {
  return db.tvProgress.update(id, {
    season,
    episode,
    inProduction,
    currentTime,
    totalDuration,
    nextEpisode,
    nextSeason,
    nextEpisodeAirDate,
    lastSeason,
    lastEpisode,
    lastEpisodeAirDate,
    updatedAt: Date.now()
  });
};


window.getTvProgress = async function(id) {
  return db.tvProgress.get(id);
};

window.removeTvProgress = async function(id) {
  return db.tvProgress.delete(id);
};

window.getAllTvProgress = async function() {
  return db.tvProgress.toArray();
};

window.addMovieProgress = async function(id, currentTime, totalTime) {
  return db.movieProgress.put({
    id: Number(id),
    currentTime,
    totalTime,
    updatedAt: Date.now()
  });
};

window.updateMovieProgress = async function(id, currentTime, totalTime) {
  return db.movieProgress.update(Number(id), {
    currentTime,
    totalTime,
    updatedAt: Date.now()
  });
};

window.getMovieProgress = async function(id) {
  return db.movieProgress.get(Number(id));
};

window.getAllMovieProgress = async function() {
  return db.movieProgress.toArray();
};

window.removeMovieProgress = async function(id) {
  return db.movieProgress.delete(Number(id));
};

window.addFavorite = async function(item) {
  let genre_ids = item.genre_ids || [];

  // If genre_ids are missing, fetch from API
  if (!genre_ids.length) {
    try {
      const endpoint = item.type === 'tv' ? `tv/${item.id}` : `movie/${item.id}`;
      const details = await window.fetchGeneral(null, endpoint);
      if (details && details.genres) {
        genre_ids = details.genres.map(genre => genre.id);
      }
    } catch (error) {
      console.error(`Failed to fetch genres for item ID ${item.id}:`, error);
    }
  }

  return db.favorites.add({
    id: item.id,
    type: item.type || 'movie',
    title: item.title || item.name || '',
    poster_path: item.poster_path || '',
    vote_average: item.vote_average || '',
    release_date: item.release_date ? item.release_date : item.first_air_date ? item.first_air_date : 'Unknown Year',
    genre_ids,
    timestamp: Date.now()
  });
};

window.removeFavorite = async function(id, type) {
  return db.favorites.where({ id: parseInt(id), type: type }).delete();
};

window.getFavorites = async function() {
  return db.favorites.toArray();
};

window.addWatched = async function(item) {
  let genre_ids = item.genre_ids || [];

  // If genre_ids are missing, fetch from API
  if (!genre_ids.length) {
    try {
      const endpoint = item.type === 'tv' ? `tv/${item.id}` : `movie/${item.id}`;
      const details = await window.fetchGeneral(null, endpoint);
      if (details && details.genres) {
        genre_ids = details.genres.map(genre => genre.id);
      }
    } catch (error) {
      console.error(`Failed to fetch genres for item ID ${item.id}:`, error);
    }
  }

  return db.watched.add({
    id: item.id,
    type: item.type || 'movie',
    title: item.title || item.name || '',
    poster_path: item.poster_path || '',
    vote_average: item.vote_average || '',
    release_date: item.release_date ? item.release_date : item.first_air_date ? item.first_air_date : 'Unknown Year',
    genre_ids,
    timestamp: Date.now()
  });
};

window.removeWatched = async function(id, type) {
  return db.watched.where({ id: parseInt(id), type: type }).delete();
};

window.getWatched = async function() {
  return db.watched.toArray();
};

// Backup Export: Export all Dexie data as a JSON file.
window.exportBackup = async function() {
  try {
    let favorites = await db.favorites.toArray();
    let watched = await db.watched.toArray();
    let tvProgress = await db.tvProgress.toArray();
    let movieProgress = await db.movieProgress.toArray();

    let backupData = { favorites, watched, tvProgress, movieProgress };
    let backupStr = JSON.stringify(backupData, null, 2);

    // Generate timestamp
    let now = new Date();
    let timestamp = now.getFullYear() + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    String(now.getDate()).padStart(2, '0') + '_' +
                    String(now.getHours()).padStart(2, '0') + '-' +
                    String(now.getMinutes()).padStart(2, '0') + '-' +
                    String(now.getSeconds()).padStart(2, '0');

    let blob = new Blob([backupStr], { type: 'application/json' });
    let url = URL.createObjectURL(blob);
    let link = document.createElement('a');
    link.href = url;
    link.download = `streambox_backup_${timestamp}.json`; // Add timestamp here
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export backup failed:', error);
    alert('Failed to export backup.');
  }
};


// Backup Import: Import a JSON file and restore data into Dexie.
window.importBackup = async function(file) {
  let reader = new FileReader();
  reader.onload = async function(e) {
    try {
      let backupData = JSON.parse(e.target.result);
      // Optional: clear existing data before restoring
      await Promise.all([
        db.favorites.clear(),
        db.watched.clear(),
        db.tvProgress.clear(),
        db.movieProgress.clear()
      ]);
      // Bulk add the restored records. Use empty arrays as fallback.
      await Promise.all([
        db.favorites.bulkAdd(backupData.favorites || []),
        db.watched.bulkAdd(backupData.watched || []),
        db.tvProgress.bulkAdd(backupData.tvProgress || []),
        db.movieProgress.bulkAdd(backupData.movieProgress || [])
      ]);
      alert('Backup imported successfully.');
    } catch (error) {
      console.error('Import backup failed:', error);
      alert('Error importing backup: ' + error.message);
    }
  };
  reader.readAsText(file);
};
