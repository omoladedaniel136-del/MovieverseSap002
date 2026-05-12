/* ===================================================
   MOVIEVERSE — script.js
   TMDB API + Firebase Firestore Integration
=================================================== */

// ── Firebase Config & Init ─────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyCsjf_s4cjNyVrmRcTOfvIhMrxE_5DhLdc",
  authDomain:        "movieverse-fa90b.firebaseapp.com",
  projectId:         "movieverse-fa90b",
  storageBucket:     "movieverse-fa90b.firebasestorage.app",
  messagingSenderId: "665271003871",
  appId:             "1:665271003871:web:5c9454798a0106ef86976a"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── TMDB Configuration ─────────────────────────────
const TMDB_KEY   = '3a07862b9d342b553ceb866f75ea1038';
const TMDB_BASE  = 'https://api.themoviedb.org/3';
const IMG_BASE   = 'https://image.tmdb.org/t/p/w500';
const IMG_BACK   = 'https://image.tmdb.org/t/p/original';
const YT_WATCH   = 'https://www.youtube.com/watch?v=';

// ── App State ──────────────────────────────────────
let allMovies       = [];
let heroMovies      = [];
let heroIndex       = 0;
let heroTimer       = null;
let currentMovieId  = null;
let currentMovieObj = null;
let starSelected    = 0;
let searchTimeout   = null;

// ── Init ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPopularMovies();
  renderCustomMovies();
  initStars();
  window.addEventListener('scroll', handleScroll);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModalBtn();
  });
  // Preview live-update
  ['addTitle','addImage','addRating','addReview'].forEach(id => {
    document.getElementById(id).addEventListener('input', updatePreview);
  });
});

// ── Navbar Scroll ──────────────────────────────────
function handleScroll() {
  const nav = document.getElementById('navbar');
  nav.classList.toggle('scrolled', window.scrollY > 60);
}

// ── Section Switcher ──────────────────────────────
function showSection(name) {
  document.getElementById('homeSection').classList.toggle('hidden', name !== 'home');
  document.getElementById('addSection').classList.toggle('hidden',  name !== 'add');
  document.getElementById('heroSection').classList.toggle('hidden', name !== 'home');
  document.querySelectorAll('.nav-link').forEach((el, i) => {
    el.classList.toggle('active', (i === 0 && name === 'home') || (i === 1 && name === 'add'));
  });
  closeSearchResults();
  return false;
}

// ── Fetch Popular Movies ───────────────────────────
async function loadPopularMovies() {
  try {
    const res  = await fetch(`${TMDB_BASE}/movie/popular?api_key=${TMDB_KEY}&language=en-US&page=1`);
    const data = await res.json();
    allMovies   = data.results || [];
    heroMovies  = allMovies.slice(0, 6);

    document.getElementById('skeletonGrid').remove();
    renderMovieGrid(allMovies, 'movieGrid');
    buildHeroSlider();
  } catch (err) {
    console.error('TMDB fetch failed:', err);
    document.getElementById('skeletonGrid').innerHTML =
      '<p style="color:var(--text-muted);padding:1rem;grid-column:1/-1">Could not load movies. Check your API key.</p>';
  }
}

// ── Movie Grid ────────────────────────────────────
function renderMovieGrid(movies, containerId) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = '';
  if (!movies.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;padding:.5rem">No movies found.</p>';
    return;
  }
  movies.forEach((movie, i) => {
    grid.appendChild(createMovieCard(movie, i));
  });
}

function createMovieCard(movie, index = 0) {
  const card   = document.createElement('div');
  card.className = 'movie-card';
  card.style.animationDelay = `${index * 0.04}s`;
  card.style.animation = 'fadeInCard 0.5s ease both';

  const poster = movie.poster_path
    ? `${IMG_BASE}${movie.poster_path}`
    : (movie.image || 'https://via.placeholder.com/300x450/111118/606075?text=No+Poster');

  const rating = movie.vote_average
    ? Number(movie.vote_average).toFixed(1)
    : (movie.rating || '—');

  const year = movie.release_date
    ? movie.release_date.slice(0, 4)
    : '';

  card.innerHTML = `
    <img src="${poster}" alt="${movie.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x450/111118/606075?text=No+Poster'" />
    <div class="card-play-btn">▶</div>
    <div class="card-label">
      <div class="card-title">${movie.title}</div>
      <div class="card-rating">★ ${rating}</div>
    </div>
    <div class="movie-card-overlay">
      <div class="card-title">${movie.title}</div>
      <div class="card-rating">★ ${rating}</div>
      ${year ? `<div class="card-year">${year}</div>` : ''}
    </div>
  `;

  card.addEventListener('click', () => openMovieModal(movie));
  return card;
}

// Add CSS for card entrance animation
const styleTag = document.createElement('style');
styleTag.textContent = `
@keyframes fadeInCard {
  from { opacity: 0; transform: translateY(16px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}`;
document.head.appendChild(styleTag);

// ── Hero Slider ───────────────────────────────────
function buildHeroSlider() {
  const slider = document.getElementById('heroSlider');
  const dots   = document.getElementById('heroDots');
  slider.innerHTML = '';
  dots.innerHTML   = '';

  heroMovies.forEach((movie, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide';
    const bg = movie.backdrop_path
      ? `${IMG_BACK}${movie.backdrop_path}`
      : (movie.poster_path ? `${IMG_BASE}${movie.poster_path}` : '');
    slide.style.backgroundImage = bg ? `url(${bg})` : '';
    slide.style.backgroundColor = '#0a0a0f';
    slider.appendChild(slide);

    const dot = document.createElement('div');
    dot.className = `hero-dot${i === 0 ? ' active' : ''}`;
    dot.onclick   = () => goToSlide(i);
    dots.appendChild(dot);
  });

  showHeroSlide(0);
  startHeroAuto();
}

function showHeroSlide(index) {
  if (!heroMovies.length) return;
  heroIndex = (index + heroMovies.length) % heroMovies.length;
  const movie = heroMovies[heroIndex];

  // Animate content out then in
  const content = document.getElementById('heroContent');
  content.style.opacity = '0';
  content.style.transform = 'translateY(12px)';

  setTimeout(() => {
    document.getElementById('heroTitle').textContent = movie.title;
    document.getElementById('heroDesc').textContent  = movie.overview || '';

    const rating = movie.vote_average ? `★ ${Number(movie.vote_average).toFixed(1)}` : '';
    const year   = movie.release_date ? movie.release_date.slice(0, 4) : '';
    const lang   = movie.original_language ? movie.original_language.toUpperCase() : '';
    document.getElementById('heroMeta').innerHTML =
      `<span class="rating">${rating}</span>
       ${year  ? `<span class="tag">${year}</span>` : ''}
       ${lang  ? `<span class="tag">${lang}</span>` : ''}`;

    content.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    content.style.opacity    = '1';
    content.style.transform  = 'translateY(0)';
  }, 200);

  // Update slider position
  const slides = document.querySelectorAll('.hero-slide');
  slides.forEach((s, i) => {
    s.style.position  = 'absolute';
    s.style.inset     = '0';
    s.style.opacity   = i === heroIndex ? '1' : '0';
    s.style.transition = 'opacity 1s ease';
  });

  // Update dots
  document.querySelectorAll('.hero-dot').forEach((d, i) => {
    d.classList.toggle('active', i === heroIndex);
  });
}

function goToSlide(i)  { showHeroSlide(i); resetHeroAuto(); }
function nextSlide()   { showHeroSlide(heroIndex + 1); resetHeroAuto(); }
function prevSlide()   { showHeroSlide(heroIndex - 1); resetHeroAuto(); }

function startHeroAuto() {
  heroTimer = setInterval(() => showHeroSlide(heroIndex + 1), 6000);
}

function resetHeroAuto() {
  clearInterval(heroTimer);
  startHeroAuto();
}

function openHeroMovie() {
  if (heroMovies[heroIndex]) openTrailerDirect(heroMovies[heroIndex].id);
}

function openHeroInfo() {
  if (heroMovies[heroIndex]) openMovieModal(heroMovies[heroIndex]);
}

async function openTrailerDirect(movieId) {
  try {
    const res  = await fetch(`${TMDB_BASE}/movie/${movieId}/videos?api_key=${TMDB_KEY}&language=en-US`);
    const data = await res.json();
    const trailer = (data.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube')
                 || data.results[0];
    if (trailer) window.open(`${YT_WATCH}${trailer.key}`, '_blank');
    else alert('No trailer available for this movie.');
  } catch (e) {
    alert('Could not fetch trailer.');
  }
}

// ── Movie Modal ───────────────────────────────────
async function openMovieModal(movie) {
  currentMovieObj = movie;
  currentMovieId  = movie.id || null;
  starSelected    = 0;
  resetStars();

  const isCustom = !movie.id || movie._custom;

  // Hero backdrop
  const backdrop = movie.backdrop_path
    ? `${IMG_BACK}${movie.backdrop_path}`
    : (movie.poster_path ? `${IMG_BASE}${movie.poster_path}` : '');

  document.getElementById('modalHero').style.backgroundImage = backdrop ? `url(${backdrop})` : '';

  // Poster
  document.getElementById('modalPoster').src = movie.poster_path
    ? `${IMG_BASE}${movie.poster_path}`
    : (movie.image || 'https://via.placeholder.com/150x225/111118/606075?text=No+Poster');

  // Texts
  document.getElementById('modalBadge').textContent = isCustom ? 'My Collection' : 'TMDB';
  document.getElementById('modalTitle').textContent  = movie.title;

  const rating = movie.vote_average
    ? `★ ${Number(movie.vote_average).toFixed(1)} / 10`
    : (movie.rating ? `★ ${movie.rating} / 10` : '');
  const year = movie.release_date ? movie.release_date.slice(0, 4) : '';
  const lang = movie.original_language ? movie.original_language.toUpperCase() : '';

  document.getElementById('modalMeta').innerHTML =
    `${rating ? `<span class="rating">${rating}</span>` : ''}
     ${year   ? `<span class="tag">${year}</span>` : ''}
     ${lang   ? `<span class="tag">${lang}</span>` : ''}`;

  document.getElementById('modalDesc').textContent =
    movie.overview || movie.review || 'No description available.';

  // Trailer button
  const trailerBtn = document.getElementById('trailerBtn');
  trailerBtn.style.display = isCustom ? 'none' : 'inline-flex';

  // Load reviews
  renderReviews(currentMovieId || movie.title);

  // Open
  const backdrop2 = document.getElementById('modalBackdrop');
  backdrop2.classList.add('open');
  document.body.style.overflow = 'hidden';

  // If TMDB movie, fetch extra details
  if (currentMovieId && !isCustom) fetchMovieDetails(currentMovieId);
}

async function fetchMovieDetails(id) {
  try {
    const res  = await fetch(`${TMDB_BASE}/movie/${id}?api_key=${TMDB_KEY}&language=en-US`);
    const data = await res.json();

    const genres = (data.genres || []).map(g => `<span class="tag">${g.name}</span>`).join('');
    const runtime = data.runtime ? `<span class="tag">${data.runtime} min</span>` : '';
    const existing = document.getElementById('modalMeta').innerHTML;
    document.getElementById('modalMeta').innerHTML = existing + genres + runtime;
  } catch (e) { /* silent */ }
}

function closeModal(event) {
  if (event.target === document.getElementById('modalBackdrop')) closeModalBtn();
}

function closeModalBtn() {
  document.getElementById('modalBackdrop').classList.remove('open');
  document.body.style.overflow = '';
  currentMovieId  = null;
  currentMovieObj = null;
  // Stop listening to reviews when modal closes
  if (reviewsUnsubscribe) { reviewsUnsubscribe(); reviewsUnsubscribe = null; }
}

// ── Trailer ───────────────────────────────────────
async function watchTrailer() {
  if (!currentMovieId) return;
  const btn = document.getElementById('trailerBtn');
  btn.textContent = '⏳ Loading…';
  btn.disabled = true;

  try {
    const res  = await fetch(`${TMDB_BASE}/movie/${currentMovieId}/videos?api_key=${TMDB_KEY}&language=en-US`);
    const data = await res.json();
    const trailer = (data.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube')
                 || (data.results || [])[0];

    if (trailer) {
      window.open(`${YT_WATCH}${trailer.key}`, '_blank');
    } else {
      alert('No trailer available for this movie.');
    }
  } catch (e) {
    alert('Could not load trailer. Please check your connection.');
  } finally {
    btn.textContent = '▶ Watch Trailer';
    btn.disabled = false;
  }
}

// ── Reviews (Firebase Firestore) ──────────────────
function getReviewId(id) {
  return String(id || 'custom');
}

// Listen in real-time to reviews for a movie
let reviewsUnsubscribe = null;

function renderReviews(id) {
  const list = document.getElementById('reviewList');
  list.innerHTML = '<p class="review-empty">Loading reviews…</p>';

  // Unsubscribe previous listener if any
  if (reviewsUnsubscribe) { reviewsUnsubscribe(); reviewsUnsubscribe = null; }

  reviewsUnsubscribe = db.collection('reviews')
    .where('movieId', '==', getReviewId(id))
    .orderBy('date', 'desc')
    .onSnapshot(snapshot => {
      list.innerHTML = '';
      if (snapshot.empty) {
        list.innerHTML = '<p class="review-empty">Be the first to leave a review!</p>';
        return;
      }
      snapshot.forEach(doc => {
        const r    = doc.data();
        const item = document.createElement('div');
        item.className = 'review-item';
        const stars = '★'.repeat(r.stars || 0) + '☆'.repeat(5 - (r.stars || 0));
        item.innerHTML = `
          <div class="review-item-header">
            <span class="review-author">${escapeHtml(r.author || 'Anonymous')}</span>
            <span class="review-stars">${stars}</span>
          </div>
          <p class="review-text">${escapeHtml(r.text)}</p>
        `;
        list.appendChild(item);
      });
    }, err => {
      console.error('Reviews fetch error:', err);
      list.innerHTML = '<p class="review-empty">Could not load reviews.</p>';
    });
}

function submitReview() {
  try {
    const id = currentMovieId
      ? String(currentMovieId)
      : (currentMovieObj && currentMovieObj.title)
        ? currentMovieObj.title
        : 'custom';

    const authorEl = document.getElementById('reviewAuthor');
    const textEl   = document.getElementById('reviewText');
    const postBtn  = document.getElementById('postReviewBtn');

    if (!authorEl || !textEl) return;

    const author = authorEl.value.trim() || 'Anonymous';
    const text   = textEl.value.trim();

    if (!text) {
      textEl.style.borderColor = 'var(--accent)';
      textEl.focus();
      setTimeout(() => textEl.style.borderColor = '', 1500);
      return;
    }

    // Disable button while saving
    if (postBtn) { postBtn.disabled = true; postBtn.textContent = 'Posting…'; }

    db.collection('reviews').add({
      movieId: getReviewId(id),
      author,
      text,
      stars:  starSelected,
      date:   firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      authorEl.value = '';
      textEl.value   = '';
      starSelected   = 0;
      resetStars();
    }).catch(err => {
      console.error('Save review error:', err);
      alert('Could not save review. Please try again.');
    }).finally(() => {
      if (postBtn) { postBtn.disabled = false; postBtn.textContent = 'Post Review'; }
    });

  } catch (err) {
    console.error('Review submit error:', err);
  }
}

// Bind Post Review button via event listener
document.addEventListener('DOMContentLoaded', () => {
  const postBtn = document.getElementById('postReviewBtn');
  if (postBtn) postBtn.addEventListener('click', submitReview);
});

// ── Star Rating ───────────────────────────────────
function initStars() {
  document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('mouseover', () => highlightStars(+star.dataset.val));
    star.addEventListener('mouseout',  resetStars);
    star.addEventListener('click', () => {
      starSelected = +star.dataset.val;
      resetStars();
    });
  });
}

function highlightStars(val) {
  document.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('active', +s.dataset.val <= val);
  });
}

function resetStars() {
  document.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('active', +s.dataset.val <= starSelected);
  });
}

// ── Custom Movies ─────────────────────────────────
function getCustomMovies() {
  try { return JSON.parse(localStorage.getItem('mv_custom_movies')) || []; }
  catch { return []; }
}

function saveCustomMovies(arr) {
  localStorage.setItem('mv_custom_movies', JSON.stringify(arr));
}

function renderCustomMovies() {
  const movies = getCustomMovies();
  const grid   = document.getElementById('customGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!movies.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:.82rem;padding:.25rem">No custom movies yet. Add some!</p>';
    return;
  }
  movies.forEach((m, i) => grid.appendChild(createMovieCard(m, i)));
}

function addCustomMovie() {
  const title  = document.getElementById('addTitle').value.trim();
  const image  = document.getElementById('addImage').value.trim();
  const rating = document.getElementById('addRating').value.trim();
  const review = document.getElementById('addReview').value.trim();
  const fb     = document.getElementById('addFeedback');

  if (!title) { showFeedback(fb, 'Please enter a movie title.', 'error'); return; }
  if (!image) { showFeedback(fb, 'Please enter a poster image URL.', 'error'); return; }
  if (!review) { showFeedback(fb, 'Please write a review.', 'error'); return; }

  const movie = {
    _custom: true,
    title,
    image,
    poster_path: null,
    vote_average: rating ? parseFloat(rating) : null,
    rating: rating || null,
    overview: review,
    review,
  };

  const movies = getCustomMovies();
  movies.unshift(movie);
  saveCustomMovies(movies);
  renderCustomMovies();

  // Reset form
  document.getElementById('addTitle').value  = '';
  document.getElementById('addImage').value  = '';
  document.getElementById('addRating').value = '';
  document.getElementById('addReview').value = '';
  document.getElementById('addPreview').innerHTML = '<p class="preview-placeholder">Preview will appear here</p>';

  showFeedback(fb, '✓ Movie added to your collection!', 'success');
  setTimeout(() => showSection('home'), 1400);
}

function showFeedback(el, msg, type) {
  el.textContent  = msg;
  el.className    = `add-feedback ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'add-feedback'; }, 3000);
}

// Live preview
function updatePreview() {
  const title  = document.getElementById('addTitle').value;
  const image  = document.getElementById('addImage').value;
  const rating = document.getElementById('addRating').value;
  const preview = document.getElementById('addPreview');

  if (!title && !image) {
    preview.innerHTML = '<p class="preview-placeholder">Preview will appear here</p>';
    return;
  }

  preview.innerHTML = `
    <div style="width:100%;max-width:200px;margin:0 auto">
      <div class="movie-card" style="pointer-events:none;aspect-ratio:2/3;width:100%">
        ${image ? `<img src="${image}" alt="${title}" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover" />` : ''}
        <div class="card-label">
          <div class="card-title">${title || 'Movie Title'}</div>
          ${rating ? `<div class="card-rating">★ ${rating}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ── Search ────────────────────────────────────────
async function handleSearch(query) {
  clearTimeout(searchTimeout);
  if (!query.trim()) { closeSearchResults(); return; }

  searchTimeout = setTimeout(async () => {
    try {
      const res  = await fetch(`${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=en-US`);
      const data = await res.json();
      showSearchResults(data.results || []);
    } catch { closeSearchResults(); }
  }, 350);
}

function showSearchResults(results) {
  closeSearchResults();
  if (!results.length) {
    const box = document.createElement('div');
    box.className = 'search-results';
    box.id = 'searchResults';
    box.innerHTML = '<p class="search-no-result">No movies found.</p>';
    document.body.appendChild(box);
    return;
  }

  const box = document.createElement('div');
  box.className = 'search-results';
  box.id = 'searchResults';

  results.slice(0, 8).forEach(movie => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    const poster = movie.poster_path
      ? `${IMG_BASE}${movie.poster_path}`
      : 'https://via.placeholder.com/40x56/111118/606075?text=?';
    const year = movie.release_date ? movie.release_date.slice(0, 4) : '';
    item.innerHTML = `
      <img src="${poster}" alt="${movie.title}" onerror="this.src='https://via.placeholder.com/40x56/111118/606075?text=?'" />
      <div class="search-result-info">
        <div class="title">${movie.title}</div>
        ${year ? `<div class="year">${year}</div>` : ''}
      </div>
    `;
    item.addEventListener('click', () => {
      openMovieModal(movie);
      closeSearchResults();
      document.getElementById('searchInput').value = '';
    });
    box.appendChild(item);
  });

  document.body.appendChild(box);
  document.addEventListener('click', handleOutsideSearch);
}

function closeSearchResults() {
  const box = document.getElementById('searchResults');
  if (box) box.remove();
  document.removeEventListener('click', handleOutsideSearch);
}

function handleOutsideSearch(e) {
  if (!e.target.closest('#searchResults') && !e.target.closest('.nav-search')) {
    closeSearchResults();
  }
}

// ── Utility ───────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
