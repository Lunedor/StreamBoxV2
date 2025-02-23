/*********************************************************************
 * TV Page Script for StreamBox Live TV
 *********************************************************************/

/* --- M3U Parsing --- */
let lists = [
  'https://raw.githubusercontent.com/Lunedor/iptvTR/refs/heads/main/webFull.m3u',
  'https://raw.githubusercontent.com/Lunedor/iptvTR/refs/heads/main/indexv.m3u'
];

function parseM3U(content) {
  let channels = [];
  let lines = content.split('\n').map(line => line.trim());
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#EXTINF:")) {
      let infoLine = lines[i];
      let tvgIdMatch = /tvg-id="([^"]*)"/i.exec(infoLine);
      let tvgNameMatch = /tvg-name="([^"]*)"/i.exec(infoLine);
      let groupMatch = /tvg-group="([^"]*)"/i.exec(infoLine);
      let tvgLogoMatch = /tvg-logo="([^"]*)"/i.exec(infoLine);
      let tvgLogo = tvgLogoMatch ? tvgLogoMatch[1] : null;
      let tvgId = tvgIdMatch ? tvgIdMatch[1] : "";
      let tvgName = tvgNameMatch ? tvgNameMatch[1] : "";
      let category = groupMatch ? groupMatch[1].trim() : "Others";
      let displayName = infoLine.split(',').pop().trim();
      let url = "";
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j] !== "") {
          url = lines[j];
          i = j;
          break;
        }
      }
      channels.push({
        id: tvgId || null, // If missing, use null
        name: tvgName || displayName,
        category: category,
        logo: tvgLogo,
        url: url
      });
    }
  }
  return channels;
}

/* --- Load and Merge Channels --- */
async function loadAndParseLists() {
  let allChannels = [];
  await Promise.all(lists.map(async (listUrl) => {
    try {
      let response = await fetch(listUrl);
      if (!response.ok) {
        console.error('Failed to fetch', listUrl);
        return;
      }
      let content = await response.text();
      let channels = parseM3U(content);
      allChannels.push(...channels);
    } catch (err) {
      console.error('Error fetching list:', listUrl, err);
    }
  }));
  return allChannels;
}

/* --- Merge Channels --- */
// Use composite key: if channel.id exists, use it; otherwise, use normalizedName + '_' + category.
function mergeChannels(channels) {
  let merged = {};
  channels.forEach(channel => {
    let normalizedName = channel.name.trim().toLowerCase();
    let key = channel.id ? channel.id : normalizedName + '_' + channel.category;
    if (merged[key]) {
      merged[key].sources.push(channel.url);
      // Use logo from first occurrence.
      if (!merged[key].logo && channel.logo) {
        merged[key].logo = channel.logo;
      }
    } else {
      merged[key] = {
        id: channel.id || key,
        name: channel.name,
        category: channel.category,
        logo: channel.logo,
        sources: [channel.url]
      };
    }
  });
  return merged;
}

/* --- Rendering Channels --- */
let CHANNELS_PER_PAGE = 30;
let currentChannelPage = 1;
let mergedChannelsGlobal = null;

function renderChannels(mergedChannels, filterCategory = 'all', searchTerm = '') {
  currentChannelPage = 1;
  renderChannelsPage(mergedChannels, filterCategory, searchTerm, currentChannelPage);
}

function renderChannelsPage(mergedChannels, filterCategory = 'all', searchTerm = '', page = 1) {
  let channelsContainer = document.getElementById('channelsContainer');
  if (page === 1) channelsContainer.innerHTML = '';
  
  let allChannelsArray = Object.values(mergedChannels);
  let filtered = allChannelsArray.filter(channel => {
    if (filterCategory !== 'all' && channel.category !== filterCategory) return false;
    if (searchTerm && channel.name.toLowerCase().indexOf(searchTerm.toLowerCase()) === -1) return false;
    return true;
  });
  
  let startIndex = (page - 1) * CHANNELS_PER_PAGE;
  let pageChannels = filtered.slice(startIndex, startIndex + CHANNELS_PER_PAGE);
  
  pageChannels.forEach(channel => {
    let card = createChannelCard(channel);
    channelsContainer.appendChild(card);
  });
  
  let loadMoreBtn = document.getElementById('loadMoreChannelsBtn');
  if (startIndex + CHANNELS_PER_PAGE < filtered.length) {
    loadMoreBtn.style.display = 'block';
    loadMoreBtn.onclick = function () {
      currentChannelPage++;
      renderChannelsPage(mergedChannels, filterCategory, searchTerm, currentChannelPage);
    };
  } else {
    loadMoreBtn.style.display = 'none';
  }
}

function createChannelCard(channel) {
  let card = document.createElement('div');
  card.className = 'channel';
  card.setAttribute('data-category', channel.category);

  // Logo container (fixed size)
  let logoContainer = document.createElement('div');
  logoContainer.className = 'logo-container';
  let logoImg = document.createElement('img');
  logoImg.src = channel.logo || `https://placehold.co/80x80?text=${channel.name.substring(0,3)}`;
  logoImg.alt = `${channel.name} logo`;
  logoContainer.appendChild(logoImg);
  card.appendChild(logoContainer);

  // New container for details (channel info and source dropdown)
  let detailsDiv = document.createElement('div');
  detailsDiv.className = 'channel-details';
  
  // Channel info container
  let infoDiv = document.createElement('div');
  infoDiv.className = 'channel-info';
  let title = document.createElement('h3');
  title.textContent = channel.name;
  title.classList.add('channel-title');
  infoDiv.appendChild(title);
  let catInfo = document.createElement('p');
  catInfo.textContent = channel.category;
  infoDiv.appendChild(catInfo);
  detailsDiv.appendChild(infoDiv);
  
  // If there are multiple sources, add a dropdown below the info.
  if (channel.sources.length > 1) {
    let sourceSelect = document.createElement('select');
    sourceSelect.className = 'source-selector';
    channel.sources.forEach((src, index) => {
      let option = document.createElement('option');
      option.value = src;
      option.textContent = 'Source ' + (index + 1);
      sourceSelect.appendChild(option);
    });
    detailsDiv.appendChild(sourceSelect);
  }
  
  // Append the details container to the card.
  card.appendChild(detailsDiv);
  
  // Play button (outside the details container for clarity)
  let playButton = document.createElement('button');
  playButton.className = 'play-btn';
  playButton.innerHTML = '<i class="fas fa-play-circle"></i>';
  playButton.addEventListener('click', () => {
    resetPlayingChannelHighlight();
    card.classList.add('playing');
    currentlyPlayingChannelDiv = card;
    let streamUrl = detailsDiv.querySelector('.source-selector')
      ? detailsDiv.querySelector('.source-selector').value
      : channel.sources[0];
    playStream(streamUrl);
  });
  card.appendChild(playButton);
  
  return card;
}

let currentlyPlayingChannelDiv = null;
function resetPlayingChannelHighlight() {
  if (currentlyPlayingChannelDiv) {
    currentlyPlayingChannelDiv.classList.remove('playing');
    currentlyPlayingChannelDiv = null;
  }
}

function playStream(url) {
  url = url.replace(/^http:\/\//i, 'https://');
  let video = document.getElementById('videoPlayer');
  if (url && url.indexOf('.m3u8') > -1 && Hls.isSupported()) {
    if (window.hls) window.hls.destroy();
    window.hls = new Hls();
    window.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(error => console.error("Playback error:", error));
    });
    window.hls.loadSource(url);
    window.hls.attachMedia(video);
  } else {
    video.src = url;
    video.load();
    video.play().catch(error => console.error("Playback error:", error));
  }
}

/* --- Category and Search Filtering --- */
function renderCategoryOptions(mergedChannels) {
  let categorySelect = document.getElementById('categorySelect');
  let categories = new Set();
  Object.values(mergedChannels).forEach(channel => {
    categories.add(channel.category);
  });
  categorySelect.innerHTML = '<option value="all">All Categories</option>';
  Array.from(categories).sort().forEach(category => {
    let option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
}

/* --- Initialization --- */
async function init() {
  let channels = await loadAndParseLists();
  let mergedChannels = mergeChannels(channels);
  mergedChannelsGlobal = mergedChannels;
  renderCategoryOptions(mergedChannels);
  renderChannels(mergedChannels);

  document.getElementById('categorySelect').addEventListener('change', () => {
    let filterCategory = document.getElementById('categorySelect').value;
    let searchTerm = document.getElementById('searchInput').value;
    renderChannels(mergedChannels, filterCategory, searchTerm);
  });

  document.getElementById('searchInput').addEventListener('input', () => {
    let searchTerm = document.getElementById('searchInput').value;
    let filterCategory = document.getElementById('categorySelect').value;
    renderChannels(mergedChannels, filterCategory, searchTerm);
  });
}

init();
