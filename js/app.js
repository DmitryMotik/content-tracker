/* js/app.js — вся логика сайта. Карта: см. ПОДСКАЗКИ.md. Ищи по эмодзи-комментариям (// 🎬 ...). */
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
    import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
    import { getFirestore, doc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

    // 🔑 Пароль и ключи API лежат в js/config.js
    const { myFirebaseConfig, ADMIN_PASSWORD, KINOPOISK_API_KEY, YOUTUBE_API_KEY } = window.APP_CONFIG;
    // Экранирование текста перед вставкой в HTML (защита от XSS из названий/комментариев)
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    const appId = 'my-personal-tracker';
    const firebaseConfig = myFirebaseConfig;
    
    let app, db, auth, itemsCollection, youtubeCollection, settingsDocRef;
    let statsDocRef;
    let contentData = [];
    let youtubeData = [];
    let currentYtWatchedCount = 0;
    let itemToDeleteId = null; 
    let itemToDeleteType = 'main'; 

    let currentTab = 'main';
    let currentPage = 1;
    // 📄 Сколько карточек на одной странице
    const ITEMS_PER_PAGE = 48;
    
    let currentFilters = { type: 'all', status: 'all', search: '', genre: '', director: '', year: '', bestOnly: false, sort: 'title' };
    let ytFilters = { category: 'all', search: '', priorityOnly: false };
    
    let isAdmin = false;

    // 🏷 ТИПЫ записей: название, иконка, цвета. Новый тип = новая строка тут + кнопка-фильтр и <option> в index.html
    const TYPE_CONFIG = {
        'movie': { label: 'Фильм', icon: 'ph-film-strip', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', badge: 'bg-blue-500 text-white' },
        'series': { label: 'Сериал', icon: 'ph-television', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300', badge: 'bg-purple-500 text-white' },
        'cartoon': { label: 'Мультфильм', icon: 'ph-paint-brush-broad', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300', badge: 'bg-pink-500 text-white' },
        'game': { label: 'Игра', icon: 'ph-game-controller', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300', badge: 'bg-green-500 text-white' },
        'unknown': { label: 'Неизвестно', icon: 'ph-question', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', badge: 'bg-gray-500 text-white' }
    };

    // 🏷 СТАТУСЫ (просмотрено / в планах / ...)
    const STATUS_CONFIG = {
        'watched': { label: 'Просмотрено / Пройдено', icon: 'ph-check-circle', color: 'text-green-500', badge: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
        'planning': { label: 'В планах', icon: 'ph-bookmark-simple', color: 'text-blue-500', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
        'watching': { label: 'В процессе', icon: 'ph-play-circle', color: 'text-yellow-500', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
        'dropped': { label: 'Брошено', icon: 'ph-x-circle', color: 'text-red-500', badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' }
    };

    // 🎭 ЖАНРЫ кино — добавь строку, и жанр появится в форме и фильтрах
    const MOVIE_GENRES = {
        'action': { label: 'Боевик', color: 'bg-red-500 text-white dark:bg-red-600' },
        'comedy': { label: 'Комедия', color: 'bg-yellow-400 text-yellow-900 dark:bg-yellow-500 dark:text-yellow-900' },
        'drama': { label: 'Драма', color: 'bg-blue-500 text-white dark:bg-blue-600' },
        'horror': { label: 'Ужасы', color: 'bg-black text-red-500 dark:bg-black border border-red-500/50' },
        'thriller': { label: 'Триллер', color: 'bg-gray-800 text-white dark:bg-gray-900' },
        'crime': { label: 'Криминал', color: 'bg-slate-700 text-white dark:bg-slate-800' },
        'sci-fi': { label: 'Фантастика', color: 'bg-indigo-500 text-white dark:bg-indigo-600' },
        'fantasy': { label: 'Фэнтези', color: 'bg-purple-500 text-white dark:bg-purple-600' },
        'adventure': { label: 'Приключения', color: 'bg-green-500 text-white dark:bg-green-600' },
        'detective': { label: 'Детектив', color: 'bg-teal-500 text-white dark:bg-teal-600' },
        'war': { label: 'Военный', color: 'bg-lime-800 text-white dark:bg-lime-900' },
        'romance': { label: 'Мелодрама', color: 'bg-pink-500 text-white dark:bg-pink-600' },
        'family': { label: 'Семейный', color: 'bg-orange-400 text-white dark:bg-orange-500' },
        'doc': { label: 'Документальный', color: 'bg-cyan-600 text-white dark:bg-cyan-700' },
        'biography': { label: 'Биография', color: 'bg-stone-500 text-white dark:bg-stone-600' },
        'history': { label: 'История', color: 'bg-amber-700 text-white dark:bg-amber-800' },
        'musical': { label: 'Мюзикл', color: 'bg-fuchsia-500 text-white dark:bg-fuchsia-600' },
        'sport': { label: 'Спорт', color: 'bg-orange-600 text-white dark:bg-orange-700' },
        'western': { label: 'Вестерн', color: 'bg-yellow-700 text-white dark:bg-yellow-800' },
        'short': { label: 'Короткометражка', color: 'bg-indigo-400 text-white dark:bg-indigo-500' }
    };

    // 🎮 ЖАНРЫ игр
    const GAME_GENRES = {
        'rpg': { label: 'RPG', color: 'bg-purple-600 text-white dark:bg-purple-700' },
        'action_game': { label: 'Экшен', color: 'bg-red-600 text-white dark:bg-red-700' },
        'shooter': { label: 'Шутер', color: 'bg-slate-800 text-white dark:bg-slate-900' },
        'strategy': { label: 'Стратегия', color: 'bg-blue-600 text-white dark:bg-blue-700' },
        'adventure_game': { label: 'Приключение', color: 'bg-green-600 text-white dark:bg-green-700' },
        'indie': { label: 'Инди', color: 'bg-teal-600 text-white dark:bg-teal-700' },
        'simulator': { label: 'Симулятор', color: 'bg-cyan-700 text-white dark:bg-cyan-800' },
        'platformer': { label: 'Платформер', color: 'bg-orange-500 text-white dark:bg-orange-600' },
        'puzzle': { label: 'Головоломка', color: 'bg-pink-600 text-white dark:bg-pink-700' },
        'horror_game': { label: 'Хоррор', color: 'bg-black text-red-500 border border-red-500/50' },
        'survival': { label: 'Выживание', color: 'bg-lime-700 text-white dark:bg-lime-800' },
        'mmo': { label: 'MMO', color: 'bg-indigo-600 text-white dark:bg-indigo-700' },
        'sports_game': { label: 'Спорт', color: 'bg-yellow-600 text-white dark:bg-yellow-700' }
    };
    
    // 📺 КАТЕГОРИИ видео (вкладка «Видосы»)
    const YT_CATEGORIES = {
        'truecrime': 'Трукрайм',
        'trailers': 'Трейлеры',
        'expose': 'Разоблачения',
        'review': 'Обзор',
        'guide': 'Гайд',
        'educational': 'Познавательное',
        'entertainment': 'Развлекательные',
        'retellings': 'Пересказы',
        'other': 'Разное'
    };

    const ALL_GENRES = { ...MOVIE_GENRES, ...GAME_GENRES };
    let selectedGenres = [];

    window.closeAllCustomSelects = function() {
        document.querySelectorAll('.custom-select-dropdown').forEach(el => el.classList.remove('show'));
    }

    // 🚀 СТАРТ: тема, вход админа, подключение Firebase, подписки на данные
    async function init() {
        initTheme();
        checkAdminStatus(); 
        try {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);

            signInAnonymously(auth).then(() => {
                itemsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'tracker_items');
                youtubeCollection = collection(db, 'artifacts', appId, 'public', 'data', 'youtube_items');
                settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'socials');
                statsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'stats');

                onSnapshot(itemsCollection, (snapshot) => {
                    contentData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                    if(currentTab === 'main') renderGrid();
                }, (error) => console.error("Ошибка элементов:", error));
                
                onSnapshot(youtubeCollection, (snapshot) => {
                    youtubeData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                    if(currentTab === 'youtube') renderYoutubeGrid();
                }, (error) => console.error("Ошибка YouTube:", error));

                onSnapshot(settingsDocRef, (docSnap) => {
                    if (docSnap.exists()) updateSocialLinksUI(docSnap.data());
                });
            }).catch((error) => {
                 console.error("Ошибка Firebase Auth:", error);
                 if(currentTab === 'main') renderGrid();
            });

        } catch (error) { 
            console.error("Ошибка инициализации Firebase:", error); 
        }

        setupEventListeners();
        renderGenreFilterOptions();
        renderYoutubeCategorySelection();
    }

    window.toggleCustomSelect = function(e, id) {
        e.stopPropagation();
        closeAllCustomSelects();
        document.getElementById(id).classList.toggle('show');
    }
    
    window.selectCustomGenre = function(val, label) {
        currentFilters.genre = val;
        currentPage = 1;
        document.getElementById('customGenreSelectLabel').textContent = label;
        
        document.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
        if(val) {
             document.querySelector(`.custom-select-option[data-val="${val}"]`)?.classList.add('selected');
        } else {
             document.querySelector(`.custom-select-option[data-val="all"]`)?.classList.add('selected');
        }
        
        renderGrid();
    }

    function renderGenreFilterOptions() {
        const select = document.getElementById('customGenreSelect');
        select.innerHTML = `<div class="custom-select-option selected" data-val="all" onclick="selectCustomGenre('', 'Всё')">Всё</div>`;
        
        select.innerHTML += `<div class="px-3 py-1 text-xs font-bold text-gray-400 mt-2 uppercase">Кино и Сериалы</div>`;
        for (const [id, genre] of Object.entries(MOVIE_GENRES)) {
            select.innerHTML += `<div class="custom-select-option" data-val="${id}" onclick="selectCustomGenre('${id}', '${genre.label}')">${genre.label}</div>`;
        }
        
        select.innerHTML += `<div class="px-3 py-1 text-xs font-bold text-gray-400 mt-2 border-t border-gray-100 dark:border-white/10 pt-2 uppercase">Игры</div>`;
        for (const [id, genre] of Object.entries(GAME_GENRES)) {
            select.innerHTML += `<div class="custom-select-option" data-val="${id}" onclick="selectCustomGenre('${id}', '${genre.label}')">${genre.label}</div>`;
        }
    }

    // 🗂 Переключение вкладок
    window.switchTab = function(tab) {
        currentTab = tab;
        
        document.getElementById('tabMain').classList.remove('active');
        document.getElementById('tabYoutube').classList.remove('active');
        
        document.getElementById('mainContainer').classList.add('hidden');
        document.getElementById('youtubeContainer').classList.add('hidden');
        
        // Исправлено: Скрываем обертки кнопок, а не сами кнопки напрямую, которые не имели ID
        if(document.getElementById('mainActionButtons')) document.getElementById('mainActionButtons').classList.add('hidden');
        if(document.getElementById('youtubeActionButtons')) document.getElementById('youtubeActionButtons').classList.add('hidden');
        
        document.getElementById('globalSearchInput').value = '';
        document.getElementById('emptyState').classList.add('hidden'); // раньше «Ничего не найдено» висело поверх вкладки «Видосы»
        if(document.getElementById('globalSearchInputMobile')) document.getElementById('globalSearchInputMobile').value = '';
        
        currentFilters.search = '';
        ytFilters.search = '';

        if (tab === 'main') {
            document.getElementById('tabMain').classList.add('active');
            document.getElementById('mainContainer').classList.remove('hidden');
            if(isAdmin && document.getElementById('mainActionButtons')) document.getElementById('mainActionButtons').classList.remove('hidden');
            renderGrid();
        } else {
            document.getElementById('tabYoutube').classList.add('active');
            document.getElementById('youtubeContainer').classList.remove('hidden');
            if(isAdmin && document.getElementById('youtubeActionButtons')) document.getElementById('youtubeActionButtons').classList.remove('hidden');
            renderYoutubeGrid();
        }
    }

    function initTheme() {
        if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            document.getElementById('themeIcon').classList.replace('ph-moon', 'ph-sun');
        } else {
            document.documentElement.classList.remove('dark');
            document.getElementById('themeIcon').classList.replace('ph-sun', 'ph-moon');
        }
    }

    window.toggleTheme = function() {
        document.documentElement.classList.toggle('dark');
        if (document.documentElement.classList.contains('dark')) {
            localStorage.setItem('theme', 'dark');
            document.getElementById('themeIcon').classList.replace('ph-moon', 'ph-sun');
        } else {
            localStorage.setItem('theme', 'light');
            document.getElementById('themeIcon').classList.replace('ph-sun', 'ph-moon');
        }
    }

    // 🔐 Включает/выключает режим админа (класс is-admin на <body>)
    function checkAdminStatus() {
        if (localStorage.getItem('tracker_admin_key') === ADMIN_PASSWORD) {
            isAdmin = true;
            document.body.classList.add('is-admin');
            document.getElementById('loginBtn').classList.add('hidden');
            document.getElementById('logoutBtn').classList.remove('hidden');
        } else {
            isAdmin = false;
            document.body.classList.remove('is-admin');
            document.getElementById('loginBtn').classList.remove('hidden');
            document.getElementById('logoutBtn').classList.add('hidden');
        }
        
        if(isAdmin) {
            if(currentTab === 'main') {
                if(document.getElementById('mainActionButtons')) document.getElementById('mainActionButtons').classList.remove('hidden');
                if(document.getElementById('youtubeActionButtons')) document.getElementById('youtubeActionButtons').classList.add('hidden');
            } else {
                if(document.getElementById('mainActionButtons')) document.getElementById('mainActionButtons').classList.add('hidden');
                if(document.getElementById('youtubeActionButtons')) document.getElementById('youtubeActionButtons').classList.remove('hidden');
            }
        }
    }

    window.logout = function() {
        localStorage.removeItem('tracker_admin_key');
        checkAdminStatus();
        if(currentTab === 'main') renderGrid(); else renderYoutubeGrid();
    };

    const pwModal = document.getElementById('passwordModal');
    const pwInput = document.getElementById('passwordInput');
    const pwError = document.getElementById('passwordError');

    window.openPasswordModal = function() {
        document.body.classList.add('modal-open');
        pwInput.value = '';
        pwError.classList.add('hidden');
        pwModal.classList.remove('hidden');
        setTimeout(() => { pwModal.classList.remove('opacity-0'); pwModal.children[0].classList.remove('scale-95'); pwInput.focus(); }, 10);
    }

    window.closePasswordModal = function() {
        document.body.classList.remove('modal-open');
        pwModal.classList.add('opacity-0');
        pwModal.children[0].classList.add('scale-95');
        setTimeout(() => pwModal.classList.add('hidden'), 200);
    }

    // 🔐 Проверка пароля админа
    window.submitPassword = function() {
        if (pwInput.value === ADMIN_PASSWORD) {
            localStorage.setItem('tracker_admin_key', pwInput.value);
            checkAdminStatus();
            if(currentTab === 'main') renderGrid(); else renderYoutubeGrid();
            closePasswordModal();
        } else { pwError.classList.remove('hidden'); }
    }
    pwInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') submitPassword(); });

    function formatTime(minutes) {
        if (!minutes || minutes <= 0) return '';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) return `${hours} ч. ${mins > 0 ? mins + ' мин.' : ''}`;
        return `${mins} мин.`;
    }

    function updateSocialLinksUI(data) {
        const container = document.getElementById('socialLinksContainer');
        container.innerHTML = '';
        const createBtn = (url, iconHtml, title) => {
            if(!/^https?:\/\//i.test(url || '')) return ''; // только http(s)-ссылки
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="p-2 text-gray-500 hover:text-ytGreen transition-colors rounded-lg" title="${title}">${iconHtml}</a>`;
        };
        if(data.shiki) container.innerHTML += createBtn(data.shiki, `<img src="https://s2.googleusercontent.com/s2/favicons?domain=shikimori.one&sz=64" class="w-5 h-5 rounded-sm grayscale hover:grayscale-0 transition-all opacity-80 hover:opacity-100">`, 'Профиль Shikimori');
        if(data.tgProfile) container.innerHTML += createBtn(data.tgProfile, `<i class="ph-fill ph-telegram-logo text-xl"></i>`, 'Telegram Профиль');
        if(data.tgChannel) container.innerHTML += createBtn(data.tgChannel, `<i class="ph-fill ph-users text-xl"></i>`, 'Telegram Канал/Группа');
    }

    function renderGenreSelection(type) {
        const container = document.getElementById('genresSelection');
        container.innerHTML = '';
        const genreDict = type === 'game' ? GAME_GENRES : MOVIE_GENRES;
        for (const [id, genre] of Object.entries(genreDict)) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${genre.color} opacity-60 hover:opacity-100 grayscale hover:grayscale-0 transform hover:scale-105 active:scale-95`;
            btn.textContent = genre.label;
            btn.onclick = () => toggleGenreSelection(id, btn);
            btn.dataset.id = id;
            container.appendChild(btn);
        }
        updateGenreSelectionUI();
    }

    window.toggleGenreSelection = function(id, btn) {
        if (selectedGenres.includes(id)) {
            selectedGenres = selectedGenres.filter(g => g !== id);
        } else {
            selectedGenres.push(id);
        }
        updateGenreSelectionUI();
    }

    function updateGenreSelectionUI() {
        const buttons = document.getElementById('genresSelection').querySelectorAll('button');
        buttons.forEach(btn => {
            if (selectedGenres.includes(btn.dataset.id)) {
                btn.classList.remove('opacity-60', 'grayscale');
                btn.classList.add('ring-2', 'ring-offset-2', 'dark:ring-offset-ytBlack', 'ring-indigo-500', 'opacity-100', 'grayscale-0');
            } else {
                btn.classList.add('opacity-60', 'grayscale');
                btn.classList.remove('ring-2', 'ring-offset-2', 'dark:ring-offset-ytBlack', 'ring-indigo-500', 'opacity-100', 'grayscale-0');
            }
        });
    }

    function renderYoutubeCategorySelection() {
        const container = document.getElementById('ytCategorySelection');
        container.innerHTML = '';
        for (const [id, label] of Object.entries(YT_CATEGORIES)) {
            container.innerHTML += `
                <label class="cursor-pointer">
                    <input type="radio" name="ytCategory" value="${id}" class="hidden category-radio">
                    <div class="px-4 py-2 rounded-full border border-gray-300 dark:border-white/10 text-sm font-semibold text-gray-600 dark:text-gray-400 transition-colors">
                        ${label}
                    </div>
                </label>
            `;
        }
    }

    // 📚 Склеивает «Название N сезон» в одну карточку сериала
    function groupSeasons(data) {
        const grouped = [];
        const seasonRegex = /^(.*?)(\s+\d+\s+сезон)$/i;
        const parentMap = new Map();

        data.forEach(item => {
            const match = item.title.match(seasonRegex);
            if (match && item.type === 'series') {
                const baseName = match[1].trim();
                if (!parentMap.has(baseName)) {
                    parentMap.set(baseName, {
                        id: 'group_' + baseName,
                        title: baseName,
                        type: 'series',
                        isGroup: true,
                        children: [],
                        poster: item.poster,
                        genres: item.genres,
                        genre: item.genre,
                        year: item.year,
                        director: item.director,
                        kpUrl: item.kpUrl,
                        imdbUrl: item.imdbUrl
                    });
                    grouped.push(parentMap.get(baseName));
                }
                const parent = parentMap.get(baseName);
                item.parentId = parent.id;
                parent.children.push(item);
                
                if (item.poster) parent.poster = item.poster;
                if (!parent.year || item.year < parent.year) parent.year = item.year;
            } else {
                grouped.push(item);
            }
        });

        parentMap.forEach(parent => {
            parent.children.sort((a, b) => a.title.localeCompare(b.title, 'ru', { numeric: true })); // «2 сезон» перед «10 сезон»
            const activeChild = parent.children.find(c => c.status === 'watching') || parent.children[parent.children.length - 1];
            parent.status = activeChild.status;
            const ratedChildren = parent.children.filter(c => c.rating).map(c => c.rating);
            if(ratedChildren.length > 0) parent.rating = (ratedChildren.reduce((a,b)=>a+b,0) / ratedChildren.length).toFixed(1);
            parent.isTop = parent.children.some(c => c.isTop);
        });

        return grouped;
    }

    // 🎲 Подпись кнопки-рандомайзера зависит от раздела
    const randomLabel = () => ({ game: 'Во что играть?', movie: 'Какой фильм?', series: 'Какой сериал?', cartoon: 'Какой мультик?' }[currentFilters.type] || 'Что смотреть?');

    // 📊 Статистика РАЗДЕЛА: считает только записи выбранного типа (type) и плавно докручивает цифры
    function updateStats() {
        const t = currentFilters.type;
        const list = groupSeasons(contentData).filter(i => t === 'all' || i.type === t);
        const vals = { watched: list.filter(i => i.status === 'watched').length, planning: list.filter(i => i.status === 'planning').length };
        const N = { movie: 'Фильмов', series: 'Сериалов', cartoon: 'Мультфильмов', game: 'Игр' }[t];
        document.querySelector('[data-label="watched"]').textContent = N ? N + (t === 'game' ? ' пройдено' : ' просмотрено') : 'Пройдено и просмотрено';
        document.querySelector('[data-label="planning"]').textContent = N ? N + ' в планах' : 'В планах';
        document.querySelector('#btnRandom span').textContent = randomLabel();
        // Фильтр статуса: «Просмотрено» для фильмов/сериалов/мультфильмов, «Пройдено» для игр
        document.querySelector('.status-filter[data-value="watched"]').textContent = t === 'game' ? 'Пройдено' : t === 'all' ? 'Просмотрено / Пройдено' : 'Просмотрено';
        document.querySelectorAll('[data-stat]').forEach(el => {
            const to = vals[el.dataset.stat], from = parseFloat(el.dataset.v || 0);
            if (to === from) return;
            el.dataset.v = to;
            const t0 = performance.now();
            const tick = ts => {
                const k = Math.min((ts - t0) / 700, 1);
                el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
                if (k < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }

    // 🎲 Рандомайзер: перебирает названия из «В планах» ТЕКУЩЕГО раздела (на «Все форматы» — из всех) и открывает случайное
    window.pickRandom = function() {
        const all = groupSeasons(contentData).filter(i => currentFilters.type === 'all' || i.type === currentFilters.type); // только текущий раздел
        const planned = all.filter(i => i.status === 'planning');
        const list = planned.length ? planned : all;   // если «В планах» пусто — выбираем из всего
        if (!list.length) return;
        const label = document.querySelector('#btnRandom span');
        let n = 0;
        const timer = setInterval(() => {
            label.textContent = list[Math.floor(Math.random() * list.length)].title;
            if (++n > 10) {
                clearInterval(timer);
                label.textContent = randomLabel();
                window.openViewModal(list[Math.floor(Math.random() * list.length)].id);
            }
        }, 80);
    };

    // 🎬 РИСУЕТ карточки кино/игр. Разметка карточки — card.innerHTML ниже. Порог «Лучшего»: рейтинг >= 7.5
    function renderGrid() {
        updateStats();
        const grid = document.getElementById('contentGrid');
        const emptyState = document.getElementById('emptyState');
        const pagControls = document.getElementById('paginationControls');
        grid.innerHTML = '';

        const processedData = groupSeasons(contentData);

        let filteredData = processedData.filter(item => {
            const mSearch = item.title.toLowerCase().includes(currentFilters.search.toLowerCase());
            const mType = currentFilters.type === 'all' || item.type === currentFilters.type;
            const mStatus = currentFilters.status === 'all' || item.status === currentFilters.status;
            
            let mGenre = true;
            if (currentFilters.genre) {
                const hasInArray = item.genres && item.genres.includes(currentFilters.genre);
                const legacyLabel = ALL_GENRES[currentFilters.genre]?.label.toLowerCase() || '';
                const hasInLegacyString = item.genre && item.genre.toLowerCase().includes(legacyLabel);
                mGenre = hasInArray || hasInLegacyString;
            }
            
            const mDir = !currentFilters.director || (item.director && item.director.toLowerCase().includes(currentFilters.director.toLowerCase()));
            const mYear = !currentFilters.year || (item.year && item.year.toString() === currentFilters.year);
            
            let mBest = true;
            if (currentFilters.bestOnly) mBest = (item.rating && item.rating >= 7.5) || item.isTop === true;

            return mSearch && mType && mStatus && mGenre && mDir && mYear && mBest;
        });

        if (filteredData.length === 0) {
            grid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            pagControls.classList.add('hidden');
            pagControls.classList.remove('flex');
            return;
        }

        grid.classList.remove('hidden');
        emptyState.classList.add('hidden');

        const s = currentFilters.bestOnly && currentFilters.sort === 'title' ? 'rating' : currentFilters.sort; // «Лучшее» по умолчанию сортируется по оценке
        filteredData.sort((a, b) => s === 'rating' ? (b.rating || 0) - (a.rating || 0) : s === 'year' ? (b.year || 0) - (a.year || 0) : a.title.localeCompare(b.title, 'ru'));

        const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
        if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

        if (totalPages > 1) {
            pagControls.classList.remove('hidden');
            pagControls.classList.add('flex');
            document.getElementById('pageInfo').textContent = `Стр ${currentPage} / ${totalPages}`;
            document.getElementById('prevPageBtn').disabled = currentPage === 1;
            document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
        } else {
            pagControls.classList.add('hidden');
            pagControls.classList.remove('flex');
        }

        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pagedData = filteredData.slice(startIndex, endIndex);

        pagedData.forEach(item => {
            const typeInfo = TYPE_CONFIG[item.type] || TYPE_CONFIG['unknown'];
            const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG['planning'];

            let primaryGenreHtml = '';
            if (item.genres && item.genres.length > 0) {
                const gConf = ALL_GENRES[item.genres[0]];
                if(gConf) primaryGenreHtml = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${gConf.color} border-none max-w-full block">${gConf.label}</span>`;
            } else if (item.genre) { 
                primaryGenreHtml = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300 max-w-full truncate block">${esc(item.genre.split(',')[0])}</span>`;
            }

            const card = document.createElement('div');
            card.className = `bg-white dark:bg-ytGray/30 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-white/5 dark:hover:border-white/20 card-transition flex flex-col h-full relative group cursor-pointer`;
            // 🔍 Окно просмотра записи (по клику на карточку)
            card.onclick = () => window.openViewModal(item.id);
            
            let adminButtons = '';
            if(!item.isGroup) {
                adminButtons = `
                    <button onclick="window.confirmDelete('${item.id}', 'main', event)" class="admin-only absolute top-3 right-3 bg-red-500/90 backdrop-blur text-white w-9 h-9 flex items-center justify-center rounded-xl sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-30 hover:bg-red-600 shadow-lg border border-red-400">
                        <i class="ph-bold ph-trash text-lg"></i>
                    </button>
                    <button onclick="window.editItem('${item.id}', event)" class="admin-only absolute top-3 left-3 bg-white/90 dark:bg-ytBlack/90 backdrop-blur text-gray-800 dark:text-white w-9 h-9 flex items-center justify-center rounded-xl sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-30 hover:bg-white dark:hover:bg-ytGray shadow-lg border border-gray-200 dark:border-white/10">
                        <i class="ph-bold ph-pencil-simple text-lg"></i>
                    </button>
                `;
            }

            card.innerHTML = `
                ${adminButtons}
                <div class="relative pt-[140%] bg-gray-100 dark:bg-black/30 overflow-hidden flex-shrink-0">
                    <div class="absolute inset-0 flex items-center justify-center p-4 text-center bg-gradient-to-br from-gray-200 to-gray-300 dark:from-ytGray dark:to-ytBlack z-0">
                        <span class="font-black text-gray-400 dark:text-gray-600 text-xl uppercase tracking-widest break-words w-full line-clamp-4">${esc(item.title)}</span>
                    </div>
                    
                    ${item.poster ? `<img src="${esc(item.poster)}" alt="${esc(item.title)}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 z-10" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : ''}
                    
                    ${item.isTop && !currentFilters.bestOnly ? `<div class="absolute top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900 text-[10px] font-black px-3 py-1 rounded-full shadow-lg z-20 flex items-center gap-1 border border-yellow-300"><i class="ph-fill ph-trophy"></i>ТОП</div>` : ''}

                    <div class="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-transparent to-transparent z-10 pointer-events-none"></div>

                    <div class="absolute bottom-0 left-0 right-0 p-3 pt-10 flex justify-between items-end z-20 pointer-events-none">
                        <span class="flex items-center justify-center w-7 h-7 rounded-full bg-black/60 backdrop-blur-md shadow-inner border border-white/10" title="${statusInfo.label}">
                            <i class="ph-fill ${statusInfo.icon} ${statusInfo.color.replace('text-', 'text-')} text-lg"></i>
                        </span>
                        ${item.rating ? `<span class="flex items-center gap-1 text-xs font-black text-yellow-400 bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-md shadow-inner border border-yellow-500/20"><i class="ph-fill ph-star text-sm"></i>${item.rating}</span>` : ''}
                    </div>
                </div>
                <div class="p-3.5 flex flex-col flex-grow bg-white dark:bg-transparent w-full overflow-hidden">
                    <h3 class="font-extrabold text-gray-900 dark:text-white leading-tight line-clamp-2 text-sm sm:text-base mb-2">${esc(item.title)}</h3>
                    <div class="flex items-end justify-between mt-auto pt-2 gap-2 w-full overflow-hidden">
                        <div class="flex flex-col gap-1.5 items-start overflow-hidden w-full min-w-0">
                            <span class="text-[11px] text-gray-500 dark:text-gray-400 font-bold leading-none">${item.year ? item.year : '—'}</span>
                            ${primaryGenreHtml}
                        </div>
                        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${typeInfo.color} flex-shrink-0 self-end border border-white/5">
                            ${item.isGroup ? '<i class="ph-fill ph-stack"></i>' : ''}${typeInfo.label}
                        </span>
                    </div>
                </div>
            `;
            card.style.setProperty('--i', Math.min(grid.children.length, 12));
            if (!grid.dataset.done) { card.classList.add('reveal'); setTimeout(() => grid.dataset.done = 1, 900); }
            grid.appendChild(card);
        });
    }

    function renderYoutubeFilters() {
        const container = document.getElementById('ytFiltersContainer');
        container.innerHTML = '';
        
        const counts = { all: youtubeData.length, priority: 0 };
        for(let key in YT_CATEGORIES) counts[key] = 0;
        
        youtubeData.forEach(item => {
            if(item.isPriority) counts.priority++;
            if(item.category && counts[item.category] !== undefined) counts[item.category]++;
        });

        const activeClass = "bg-ytGreen text-white border-ytGreen";
        const inactiveClass = "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-ytGray dark:border-white/10 dark:text-gray-300 dark:hover:bg-ytGray/80";

        const isPrioActive = ytFilters.priorityOnly;
        container.innerHTML += `
            <button onclick="toggleYtPriorityFilter()" class="px-4 py-1.5 rounded-full text-sm font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${isPrioActive ? activeClass : inactiveClass}">
                <i class="ph-fill ph-star ${isPrioActive ? 'text-yellow-300' : 'text-yellow-500'}"></i> Приоритет <span class="opacity-60 text-xs ml-1">${counts.priority}</span>
            </button>
        `;

        const isAllActive = !ytFilters.priorityOnly && ytFilters.category === 'all';
        container.innerHTML += `
            <button onclick="setYoutubeFilter('all')" class="px-4 py-1.5 rounded-full text-sm font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${isAllActive ? activeClass : inactiveClass}">
                Все <span class="opacity-60 text-xs ml-1">${counts.all}</span>
            </button>
        `;

        for (const [id, label] of Object.entries(YT_CATEGORIES)) {
            const isActive = !ytFilters.priorityOnly && ytFilters.category === id;
            container.innerHTML += `
                <button onclick="setYoutubeFilter('${id}')" class="px-4 py-1.5 rounded-full text-sm font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${isActive ? activeClass : inactiveClass}">
                    ${label} <span class="opacity-60 text-xs ml-1">${counts[id]}</span>
                </button>
            `;
        }
    }

    window.setYoutubeFilter = function(category) {
        ytFilters.priorityOnly = false;
        ytFilters.category = category;
        renderYoutubeFilters();
        renderYoutubeGrid();
    }

    window.toggleYtPriorityFilter = function() {
        ytFilters.priorityOnly = !ytFilters.priorityOnly;
        if(ytFilters.priorityOnly) ytFilters.category = 'all';
        renderYoutubeFilters();
        renderYoutubeGrid();
    }

    // 📺 РИСУЕТ карточки видео. Разметка — card.innerHTML ниже
    function renderYoutubeGrid() {
        const grid = document.getElementById('youtubeGrid');
        const emptyState = document.getElementById('youtubeEmptyState');
        grid.innerHTML = '';
        renderYoutubeFilters();

        let filteredData = youtubeData.filter(item => {
            const mSearch = item.title.toLowerCase().includes(ytFilters.search.toLowerCase()) || 
                            (item.channel && item.channel.toLowerCase().includes(ytFilters.search.toLowerCase()));
            
            let mCat = true;
            if (ytFilters.priorityOnly) {
                mCat = item.isPriority === true;
            } else if (ytFilters.category !== 'all') {
                mCat = item.category === ytFilters.category;
            }
            return mSearch && mCat;
        });
        
        filteredData.sort((a, b) => {
            let tA = a.addedAt?.toMillis?.() ?? 0;
            let tB = b.addedAt?.toMillis?.() ?? 0;
            return tB - tA;
        });

        if (filteredData.length === 0) {
            grid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        grid.classList.remove('hidden');
        emptyState.classList.add('hidden');

        filteredData.forEach(item => {
            const card = document.createElement('a');
            card.href = /^https?:\/\//i.test(item.url) ? item.url : '#';
            card.target = '_blank';
            card.className = `bg-white dark:bg-ytGray/30 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-white/5 dark:hover:border-white/20 card-transition flex flex-col relative group cursor-pointer block`;
            
            let adminButtons = '';
            if(isAdmin) {
                adminButtons = `
                    <button onclick="window.confirmDelete('${item.id}', 'youtube', event)" class="admin-only absolute top-2 right-2 bg-red-500/90 backdrop-blur text-white w-8 h-8 flex items-center justify-center rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-30 hover:bg-red-600 shadow-md border border-red-400">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                    <button onclick="window.editYoutubeItem('${item.id}', event)" class="admin-only absolute top-2 left-2 bg-white/90 dark:bg-ytBlack/90 backdrop-blur text-gray-800 dark:text-white w-8 h-8 flex items-center justify-center rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-30 hover:bg-white dark:hover:bg-ytGray shadow-md border border-white/10">
                        <i class="ph-bold ph-pencil-simple"></i>
                    </button>
                `;
            }
            
            let badges = '';
            if (item.isPriority) {
                badges += `<div class="absolute top-2 left-2 z-20 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1"><i class="ph-fill ph-star"></i>Важное</div>`;
            }

            card.innerHTML = `
                ${adminButtons}
                <div class="relative w-full aspect-video bg-gray-200 dark:bg-black/50 overflow-hidden flex-shrink-0">
                    ${badges}
                    ${item.thumbnail ? `<img src="${esc(item.thumbnail)}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 z-10" loading="lazy">` : 
                    `<div class="absolute inset-0 flex items-center justify-center text-gray-400"><i class="ph-fill ph-youtube-logo text-4xl"></i></div>`}
                    
                    ${item.duration ? `<div class="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-20">${item.duration}</div>` : ''}
                </div>
                <div class="p-4 flex flex-col flex-grow">
                    <h3 class="font-bold text-gray-900 dark:text-white leading-tight line-clamp-2 text-sm sm:text-base mb-2 group-hover:text-ytGreen transition-colors">${esc(item.title)}</h3>
                    
                    ${item.comment ? `<p class="text-xs text-gray-500 dark:text-gray-400 italic line-clamp-2 mb-3 break-words leading-snug"><i class="ph-bold ph-quotes"></i> ${esc(item.comment)}</p>` : ''}
                    
                    <div class="flex items-center justify-between text-xs font-semibold mt-auto pt-1">
                        <div class="flex items-center text-gray-500 dark:text-gray-400 truncate pr-2">
                            <i class="ph-fill ph-user-circle text-lg mr-1.5"></i>
                            <span class="truncate">${esc(item.channel || 'Неизвестный канал')}</span>
                        </div>
                        ${item.category && YT_CATEGORIES[item.category] ? `<span class="bg-gray-100 dark:bg-black/30 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-md shrink-0 uppercase tracking-wider text-[9px] border border-gray-200 dark:border-white/5">${YT_CATEGORIES[item.category]}</span>` : ''}
                    </div>
                </div>
            `;
            card.style.setProperty('--i', Math.min(grid.children.length, 12));
            if (!grid.dataset.done) { card.classList.add('reveal'); setTimeout(() => grid.dataset.done = 1, 900); }
            grid.appendChild(card);
        });
    }

    window.changePage = function(delta) {
        currentPage += delta;
        renderGrid();
        document.getElementById('contentGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.jumpToPage = function() {
        const input = document.getElementById('pageJumpInput');
        let p = parseInt(input.value);
        if (!p || p < 1) return;
        const processedData = groupSeasons(contentData);
        let filteredData = processedData.filter(item => {
            const mSearch = item.title.toLowerCase().includes(currentFilters.search.toLowerCase());
            const mType = currentFilters.type === 'all' || item.type === currentFilters.type;
            const mStatus = currentFilters.status === 'all' || item.status === currentFilters.status;
            let mGenre = true;
            if (currentFilters.genre) {
                const hasInArray = item.genres && item.genres.includes(currentFilters.genre);
                mGenre = hasInArray || (item.genre && item.genre.toLowerCase().includes((ALL_GENRES[currentFilters.genre]?.label||'').toLowerCase()));
            }
            const mBest = currentFilters.bestOnly ? ((item.rating && item.rating >= 7.5) || item.isTop) : true;
            const mDir = !currentFilters.director || (item.director && item.director.toLowerCase().includes(currentFilters.director.toLowerCase()));
            const mYear = !currentFilters.year || (item.year && item.year.toString() === currentFilters.year);
            return mSearch && mType && mStatus && mGenre && mDir && mYear && mBest;
        });
        const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
        if (p > totalPages) p = totalPages;
        currentPage = p;
        input.value = '';
        renderGrid();
        document.getElementById('contentGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.setFilter = function(filterType, value) {
        currentFilters[filterType] = value;
        currentPage = 1;
        const buttons = document.querySelectorAll(`.${filterType}-filter`);
        buttons.forEach(btn => {
            if (btn.dataset.value === value) {
                btn.classList.remove('bg-white', 'text-gray-600', 'dark:bg-ytGray', 'dark:text-gray-300');
                btn.classList.add('bg-ytGreen/20', 'text-ytGreen', 'dark:bg-ytGreen/20', 'dark:text-ytGreen', 'active');
            } else {
                btn.classList.add('bg-white', 'text-gray-600', 'dark:bg-ytGray', 'dark:text-gray-300');
                btn.classList.remove('bg-ytGreen/20', 'text-ytGreen', 'dark:bg-ytGreen/20', 'dark:text-ytGreen', 'active');
            }
        });
        renderGrid();
    };

    window.toggleBestFilter = function() {
        currentFilters.bestOnly = !currentFilters.bestOnly;
        currentPage = 1;
        const btn = document.getElementById('btnBest');
        if (currentFilters.bestOnly) {
            btn.classList.remove('bg-yellow-50', 'text-yellow-600', 'border-yellow-200', 'dark:bg-ytGray', 'dark:border-white/10', 'dark:text-yellow-500');
            btn.classList.add('bg-gradient-to-r', 'from-yellow-400', 'to-yellow-500', 'text-yellow-900', 'border-yellow-500', 'shadow-md');
        } else {
            btn.classList.add('bg-yellow-50', 'text-yellow-600', 'border-yellow-200', 'dark:bg-ytGray', 'dark:border-white/10', 'dark:text-yellow-500');
            btn.classList.remove('bg-gradient-to-r', 'from-yellow-400', 'to-yellow-500', 'text-yellow-900', 'border-yellow-500', 'shadow-md');
        }
        renderGrid();
    };

    window.toggleAdvancedFilters = function() {
        const div = document.getElementById('advancedFilters');
        if (div.classList.contains('hidden')) {
            div.classList.remove('hidden');
        } else {
            div.classList.add('hidden');
            selectCustomGenre('', 'Всё');
            document.getElementById('filterDirector').value = '';
            document.getElementById('filterYear').value = '';
            currentFilters.genre = currentFilters.director = currentFilters.year = '';
            currentPage = 1;
            renderGrid();
        }
    };

    const viewModal = document.getElementById('viewModal');
    
    window.openViewModal = function(id) {
        let item;
        let isGroup = false;
        
        if (id.toString().startsWith('group_')) {
            const processed = groupSeasons(contentData);
            item = processed.find(i => i.id === id);
            isGroup = true;
        } else {
            item = contentData.find(i => i.id === id);
        }
        
        if (!item) return;
        document.body.classList.add('modal-open');

        const typeInfo = TYPE_CONFIG[item.type] || TYPE_CONFIG['unknown'];
        const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG['planning'];

        const viewPoster = document.getElementById('viewPoster');
        if (item.poster) { viewPoster.src = item.poster; viewPoster.style.display = 'block'; } 
        else { viewPoster.style.display = 'none'; }
        
        document.getElementById('viewFallbackText').textContent = item.title;
        document.getElementById('viewTitle').textContent = item.title;
        document.getElementById('viewType').textContent = typeInfo.label;
        document.getElementById('viewType').className = `inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${typeInfo.badge}`;
        document.getElementById('viewStatus').textContent = statusInfo.label;
        document.getElementById('viewStatus').className = `inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${statusInfo.badge}`;
        document.getElementById('viewYear').textContent = item.year || 'Неизвестно';
        
        if (item.rating) {
            document.getElementById('viewRatingBadge').classList.remove('hidden');
            document.getElementById('viewRating').textContent = item.rating;
        } else document.getElementById('viewRatingBadge').classList.add('hidden');

        if (item.duration) {
            document.getElementById('viewDurationWrap').classList.remove('hidden');
            document.getElementById('viewDuration').textContent = formatTime(item.duration);
        } else document.getElementById('viewDurationWrap').classList.add('hidden');

        if (item.isTop) document.getElementById('viewIsTopBadge').classList.remove('hidden');
        else document.getElementById('viewIsTopBadge').classList.add('hidden');

        if (item.director) {
            document.getElementById('viewDirectorWrap').classList.remove('hidden');
            document.getElementById('viewDirector').textContent = item.director;
        } else document.getElementById('viewDirectorWrap').classList.add('hidden');

        const genresWrap = document.getElementById('viewGenresWrap');
        const genresContainer = document.getElementById('viewGenres');
        genresContainer.innerHTML = '';
        let hasGenres = false;
        if (item.genres && item.genres.length > 0) {
            item.genres.forEach(gid => {
                const gConf = ALL_GENRES[gid];
                if(gConf) { genresContainer.innerHTML += `<span class="px-3 py-1 rounded-lg text-xs font-bold shadow-sm ${gConf.color}">${gConf.label}</span>`; hasGenres = true; }
            });
        } else if (item.genre) {
            genresContainer.innerHTML = `<span class="px-3 py-1 rounded-lg text-xs font-bold shadow-sm bg-gray-200 text-gray-800 dark:bg-black/30 dark:text-gray-200 border dark:border-white/10">${esc(item.genre)}</span>`;
            hasGenres = true;
        }
        if(hasGenres) genresWrap.classList.remove('hidden'); else genresWrap.classList.add('hidden');

        if (item.comment) {
            document.getElementById('viewCommentWrap').classList.remove('hidden');
            document.getElementById('viewComment').textContent = item.comment;
        } else document.getElementById('viewCommentWrap').classList.add('hidden');

        const link1 = document.getElementById('viewLink1');
        const link2 = document.getElementById('viewLink2');
        const linksWrap = document.getElementById('viewLinksWrap');
        
        link1.className = 'hidden flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#f50] hover:bg-[#ff661a] text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg text-sm whitespace-nowrap min-w-[160px]';
        link2.className = 'hidden flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#f5c518] hover:bg-[#e3b516] text-black rounded-xl font-bold transition-all shadow-md hover:shadow-lg text-sm whitespace-nowrap min-w-[160px]';

        let hasLinks = false;
        if(item.type === 'game') {
            if(item.kpUrl) { link1.href = item.kpUrl; link1.innerHTML = '<i class="ph-bold ph-steam-logo text-xl"></i> Steam'; link1.className = link1.className.replace('bg-[#f50] hover:bg-[#ff661a]', 'bg-[#171a21] hover:bg-[#2a475e]'); link1.classList.remove('hidden'); hasLinks = true; }
            if(item.imdbUrl) { link2.href = item.imdbUrl; link2.innerHTML = '<i class="ph-bold ph-game-controller text-xl"></i> Metacritic'; link2.className = link2.className.replace('bg-[#f5c518] hover:bg-[#e3b516]', 'bg-[#ffcc33] hover:bg-[#ffdf73]'); link2.classList.remove('hidden'); hasLinks = true; }
        } else {
            if (item.kpUrl) { link1.href = item.kpUrl; link1.innerHTML = 'Кинопоиск'; link1.classList.remove('hidden'); hasLinks = true; }
            if (item.imdbUrl) { link2.href = item.imdbUrl; link2.innerHTML = '<i class="ph-bold ph-imdb-logo text-xl"></i> IMDb'; link2.classList.remove('hidden'); hasLinks = true; }
        }
        if (hasLinks) linksWrap.classList.remove('hidden'); else linksWrap.classList.add('hidden');

        const seasonsWrap = document.getElementById('viewSeasonsWrap');
        const seasonsList = document.getElementById('viewSeasonsList');
        if (isGroup && item.children.length > 0) {
            seasonsList.innerHTML = '';
            item.children.forEach(child => {
                const sStatus = STATUS_CONFIG[child.status];
                seasonsList.innerHTML += `
                    <div class="flex items-center justify-between bg-gray-50 dark:bg-black/30 p-3 rounded-xl border border-gray-100 dark:border-white/10">
                        <div class="flex flex-col">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">${esc(child.title)}</span>
                            <div class="flex gap-2 items-center mt-1">
                                <span class="text-[10px] font-bold uppercase ${sStatus.color}">${sStatus.label}</span>
                                ${child.rating ? `<span class="text-[10px] font-bold text-yellow-500 flex items-center gap-0.5"><i class="ph-fill ph-star"></i>${child.rating}</span>` : ''}
                            </div>
                        </div>
                        <button onclick="window.editItem('${child.id}', event); window.closeViewModal();" class="admin-only p-2 text-gray-400 hover:text-ytGreen bg-white dark:bg-ytGray rounded-lg shadow-sm border border-gray-200 dark:border-white/10 transition-colors">
                            <i class="ph-bold ph-pencil-simple"></i>
                        </button>
                    </div>
                `;
            });
            seasonsWrap.classList.remove('hidden');
        } else {
            seasonsWrap.classList.add('hidden');
        }

        viewModal.classList.remove('hidden');
        setTimeout(() => { viewModal.classList.remove('opacity-0'); viewModal.children[0].classList.remove('scale-95'); }, 10);
    };

    window.closeViewModal = function(e) {
        if (!e || e.target === viewModal || e.target.closest('button.absolute')) {
            document.body.classList.remove('modal-open');
            viewModal.classList.add('opacity-0');
            viewModal.children[0].classList.add('scale-95');
            setTimeout(() => viewModal.classList.add('hidden'), 300);
        }
    };

    const setModal = document.getElementById('settingsModal');
    window.openSettingsModal = function() {
        if(!isAdmin) return;
        document.body.classList.add('modal-open');
        const container = document.getElementById('socialLinksContainer');
        const shiki = container.querySelector('a[href*="shikimori"]')?.href || '';
        const tgProf = container.querySelector('a[href*="t.me"]:not(:has(.ph-users))')?.href || '';
        const tgChan = container.querySelector('a:has(.ph-users)')?.href || '';
        
        document.getElementById('settingShiki').value = shiki;
        document.getElementById('settingTgProfile').value = tgProf;
        document.getElementById('settingTgChannel').value = tgChan;

        setModal.classList.remove('hidden');
        setTimeout(() => { setModal.classList.remove('opacity-0'); setModal.children[0].classList.remove('scale-95'); }, 10);
    };

    window.closeSettingsModal = function() {
        document.body.classList.remove('modal-open');
        setModal.classList.add('opacity-0');
        setModal.children[0].classList.add('scale-95');
        setTimeout(() => setModal.classList.add('hidden'), 300);
    };

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!isAdmin || !auth.currentUser) return;
        const newSettings = { shiki: document.getElementById('settingShiki').value, tgProfile: document.getElementById('settingTgProfile').value, tgChannel: document.getElementById('settingTgChannel').value };
        try { await setDoc(settingsDocRef, newSettings); closeSettingsModal(); } 
        catch(err) { console.error("Ошибка настроек", err); }
    });

    const modal = document.getElementById('itemModal');
    const modalContent = document.getElementById('modalContent');
    const form = document.getElementById('itemForm');

    function updateFormForType(type) {
        const isGame = type === 'game';
        document.getElementById('magicWandBtn').style.display = isGame ? 'none' : 'flex';
        document.getElementById('labelLink1').textContent = isGame ? 'Ссылка Steam' : 'Ссылка Кинопоиск';
        document.getElementById('labelLink2').textContent = isGame ? 'Ссылка Metacritic' : 'Ссылка IMDb';
        renderGenreSelection(type);
    }

    document.getElementById('itemType').addEventListener('change', (e) => {
        selectedGenres = [];
        updateFormForType(e.target.value);
    });

    window.openModal = function() {
        if (!isAdmin) return;
        document.body.classList.add('modal-open');
        form.reset();
        document.getElementById('itemId').value = '';
        document.getElementById('itemLegacyGenre').value = '';
        selectedGenres = [];
        if (currentFilters.type !== 'all') document.getElementById('itemType').value = currentFilters.type; // тип = текущий раздел
        document.getElementById('itemStatus').value = 'planning'; // статус по умолчанию — «В планах»
        updateFormForType(document.getElementById('itemType').value);
        document.getElementById('modalTitle').textContent = 'Добавить запись';
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);
    };

    window.closeModal = function() {
        document.body.classList.remove('modal-open');
        modal.classList.add('opacity-0');
        modalContent.classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    // 🪄 Автозаполнение формы с Кинопоиска (берёт первый найденный результат)
    window.autoFillData = async function() {
        const titleInput = document.getElementById('itemTitle').value;
        if (!titleInput) { alert("Сначала введите название для поиска!"); return; }
        
        const btn = document.getElementById('magicWandBtn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin text-xl"></i>';
        btn.disabled = true;

        try {
            const searchUrl = `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(titleInput)}&page=1`;
            const searchRes = await fetch(searchUrl, { headers: { 'X-API-KEY': KINOPOISK_API_KEY, 'Content-Type': 'application/json' } });
            const searchData = await searchRes.json();

            if (searchData.films && searchData.films.length > 0) {
                const film = searchData.films[0];
                document.getElementById('itemYear').value = film.year || '';
                
                if (film.filmLength) {
                    let durationStr = String(film.filmLength);
                    if (durationStr.includes(':')) {
                        const parts = durationStr.split(':');
                        const h = parseInt(parts[0]) || 0;
                        const m = parseInt(parts[1]) || 0;
                        document.getElementById('itemDuration').value = (h * 60) + m;
                    } else {
                        const durationMatch = durationStr.match(/\d+/);
                        if (durationMatch) document.getElementById('itemDuration').value = durationMatch[0];
                    }
                }
                
                if (film.posterUrl || film.posterUrlPreview) document.getElementById('itemPoster').value = film.posterUrl || film.posterUrlPreview;
                if (film.filmId) document.getElementById('itemKpUrl').value = `https://www.kinopoisk.ru/film/${film.filmId}/`;

                if (film.genres && film.genres.length > 0) {
                    selectedGenres = [];
                    film.genres.forEach(g => {
                        const kpGenre = g.genre.toLowerCase();
                        for (const [id, conf] of Object.entries(MOVIE_GENRES)) {
                            if (conf.label.toLowerCase() === kpGenre && !selectedGenres.includes(id)) {
                                selectedGenres.push(id);
                                break;
                            }
                        }
                    });
                    updateGenreSelectionUI();
                }

                if (film.filmId) {
                    try {
                        const staffUrl = `https://kinopoiskapiunofficial.tech/api/v1/staff?filmId=${film.filmId}`;
                        const staffRes = await fetch(staffUrl, { headers: { 'X-API-KEY': KINOPOISK_API_KEY, 'Content-Type': 'application/json' } });
                        const staffData = await staffRes.json();
                        const director = staffData.find(s => s.professionKey === 'DIRECTOR');
                        if (director) document.getElementById('itemDirector').value = director.nameRu || director.nameEn || '';
                    } catch (e) { console.log("Не удалось загрузить режиссера"); }
                }
            } else {
                alert("Ничего не найдено на Кинопоиске :(");
            }
        } catch (error) {
            console.error(error);
            alert("Ошибка при обращении к API Кинопоиска.");
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    };

    const ytModal = document.getElementById('youtubeModal');
    const ytModalContent = document.getElementById('youtubeModalContent');
    const ytForm = document.getElementById('youtubeForm');

    window.openYoutubeModal = function() {
        if (!isAdmin) return;
        document.body.classList.add('modal-open');
        ytForm.reset();
        document.getElementById('ytItemId').value = '';
        document.getElementById('ytThumbnailUrl').value = '';
        document.getElementById('ytTitle').value = '';
        document.getElementById('ytChannel').value = '';
        document.getElementById('ytDuration').value = '';
        document.getElementById('ytIsPriority').value = 'false';
        document.getElementById('ytPriorityToggle').children[0].classList.remove('active');
        
        document.getElementById('ytPreviewImg').src = '';
        document.getElementById('ytPreviewImg').classList.add('hidden');
        document.getElementById('ytPreviewPlaceholder').classList.remove('hidden');
        document.getElementById('ytAutoData').classList.add('hidden');
        
        document.querySelectorAll('.category-radio').forEach(r => r.checked = false);
        
        document.getElementById('ytModalTitle').textContent = 'Добавить видео';
        
        ytModal.classList.remove('hidden');
        setTimeout(() => { ytModal.classList.remove('opacity-0'); ytModalContent.classList.remove('scale-95'); }, 10);
    }
    
    window.closeYoutubeModal = function() {
        document.body.classList.remove('modal-open');
        ytModal.classList.add('opacity-0');
        ytModalContent.classList.add('scale-95');
        setTimeout(() => ytModal.classList.add('hidden'), 300);
    }
    
    window.toggleYtPriority = function() {
        const input = document.getElementById('ytIsPriority');
        const icon = document.getElementById('ytPriorityToggle').children[0];
        if (input.value === 'true') {
            input.value = 'false';
            icon.classList.remove('active');
        } else {
            input.value = 'true';
            icon.classList.add('active');
        }
    }
    
    // ▶️ Автозаполнение видео по ссылке (YouTube API, с задержкой 0.4 с)
    let ytTimer;
    window.fetchYoutubeData = function(url) { clearTimeout(ytTimer); ytTimer = setTimeout(() => fetchYoutubeDataNow(url), 400); } // debounce: не дёргаем API на каждую букву
    async function fetchYoutubeDataNow(url) {
        if(!url) return;
        const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regExp);
        
        if (match && match[1]) {
            const videoId = match[1];
            
            const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`; 
            document.getElementById('ytThumbnailUrl').value = thumbUrl;
            
            const imgEl = document.getElementById('ytPreviewImg');
            imgEl.src = thumbUrl;
            imgEl.classList.remove('hidden');
            document.getElementById('ytPreviewPlaceholder').classList.add('hidden');
            
            imgEl.onerror = function() {
                this.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                this.onerror = null;
            }

            if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === "ВСТАВЬ_СЮДА_НОВЫЙ_КЛЮЧ" || YOUTUBE_API_KEY === "") return;

            try {
                const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${YOUTUBE_API_KEY}`;
                const res = await fetch(apiUrl);
                const data = await res.json();
                
                if(data.error) {
                    console.error("Ошибка от YouTube: " + data.error.message);
                    return;
                }

                if (data.items && data.items.length > 0) {
                    const videoInfo = data.items[0];
                    
                    document.getElementById('ytTitle').value = videoInfo.snippet.title;
                    document.getElementById('ytChannel').value = videoInfo.snippet.channelTitle;
                    
                    document.getElementById('ytAutoTitle').textContent = videoInfo.snippet.title;
                    document.getElementById('ytAutoChannel').textContent = videoInfo.snippet.channelTitle;
                    
                    const durationIso = videoInfo.contentDetails.duration;
                    const durationMatch = durationIso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                    let durationStr = "";
                    if (durationMatch) {
                        const h = parseInt(durationMatch[1]) || 0;
                        const m = parseInt(durationMatch[2]) || 0;
                        const s = parseInt(durationMatch[3]) || 0;
                        
                        if (h > 0) durationStr += `${h}:`;
                        durationStr += `${h > 0 ? m.toString().padStart(2, '0') : m}:${s.toString().padStart(2, '0')}`;
                        document.getElementById('ytDuration').value = durationStr;
                        document.getElementById('ytAutoDuration').textContent = durationStr;
                    }
                    
                    document.getElementById('ytAutoData').classList.remove('hidden');
                    document.getElementById('ytAutoData').classList.add('flex');
                }
            } catch (error) {
                console.error("Ошибка YouTube API", error);
            }
        }
    }

    window.editItem = function(id, event) {
        if (!isAdmin) return;
        if(event) { event.preventDefault(); event.stopPropagation(); }
        
        const item = contentData.find(i => i.id === id);
        if (!item) return;

        document.body.classList.add('modal-open');
        document.getElementById('itemId').value = item.id;
        document.getElementById('itemTitle').value = item.title;
        document.getElementById('itemType').value = item.type;
        updateFormForType(item.type);

        document.getElementById('itemStatus').value = item.status;
        document.getElementById('itemRating').value = item.rating || '';
        document.getElementById('itemYear').value = item.year || '';
        document.getElementById('itemDuration').value = item.duration || '';
        document.getElementById('itemDirector').value = item.director || '';
        document.getElementById('itemIsTop').checked = item.isTop || false;
        document.getElementById('itemPoster').value = item.poster || '';
        document.getElementById('itemKpUrl').value = item.kpUrl || '';
        document.getElementById('itemImdbUrl').value = item.imdbUrl || '';
        document.getElementById('itemComment').value = item.comment || '';
        document.getElementById('itemLegacyGenre').value = item.genre || '';
        
        selectedGenres = item.genres || [];
        updateGenreSelectionUI();

        document.getElementById('modalTitle').textContent = 'Редактировать запись';
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);
    };
    
    window.editYoutubeItem = function(id, event) {
        if (!isAdmin) return;
        if(event) { event.preventDefault(); event.stopPropagation(); }
        
        const item = youtubeData.find(i => i.id === id);
        if (!item) return;

        document.body.classList.add('modal-open');
        document.getElementById('ytItemId').value = item.id;
        document.getElementById('ytUrl').value = item.url || '';
        document.getElementById('ytTitle').value = item.title || '';
        document.getElementById('ytChannel').value = item.channel || '';
        document.getElementById('ytDuration').value = item.duration || '';
        document.getElementById('ytComment').value = item.comment || '';
        
        const isPriority = item.isPriority === true;
        document.getElementById('ytIsPriority').value = isPriority ? 'true' : 'false';
        if(isPriority) document.getElementById('ytPriorityToggle').children[0].classList.add('active');
        else document.getElementById('ytPriorityToggle').children[0].classList.remove('active');
        
        if (item.category) {
            const radio = document.querySelector(`input[name="ytCategory"][value="${item.category}"]`);
            if(radio) radio.checked = true;
        }
        
        if (item.thumbnail) {
            document.getElementById('ytThumbnailUrl').value = item.thumbnail;
            document.getElementById('ytPreviewImg').src = item.thumbnail;
            document.getElementById('ytPreviewImg').classList.remove('hidden');
            document.getElementById('ytPreviewPlaceholder').classList.add('hidden');
            
            document.getElementById('ytAutoTitle').textContent = item.title;
            document.getElementById('ytAutoChannel').textContent = item.channel;
            document.getElementById('ytAutoDuration').textContent = item.duration;
            document.getElementById('ytAutoData').classList.remove('hidden');
            document.getElementById('ytAutoData').classList.add('flex');
        }

        document.getElementById('ytModalTitle').textContent = 'Редактировать видео';
        ytModal.classList.remove('hidden');
        setTimeout(() => { ytModal.classList.remove('opacity-0'); ytModalContent.classList.remove('scale-95'); }, 10);
    }

    const confirmModal = document.getElementById('confirmModal');
    
    window.confirmDelete = function(id, type, event) {
        if (!isAdmin) return;
        if(event) { event.preventDefault(); event.stopPropagation(); }
        itemToDeleteId = id;
        itemToDeleteType = type;
        document.body.classList.add('modal-open');
        confirmModal.classList.remove('hidden');
        setTimeout(() => { confirmModal.classList.remove('opacity-0'); confirmModal.children[0].classList.remove('scale-95'); }, 10);
    }

    window.closeConfirmModal = function() {
        document.body.classList.remove('modal-open');
        confirmModal.classList.add('opacity-0');
        confirmModal.children[0].classList.add('scale-95');
        setTimeout(() => { confirmModal.classList.add('hidden'); itemToDeleteId = null; }, 200);
    }

    document.getElementById('confirmBtn').addEventListener('click', async () => {
        if (!isAdmin || !auth.currentUser || !itemToDeleteId) return;
        try {
            if(itemToDeleteType === 'youtube') {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'youtube_items', itemToDeleteId));
            } else {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tracker_items', itemToDeleteId));
            }
            closeConfirmModal();
        } catch(e) { console.error("Ошибка удаления:", e); }
    });

    // 💾 Поиск, фильтры и СОХРАНЕНИЕ форм в Firestore (ищи submit)
    function setupEventListeners() {
        document.getElementById('globalSearchInput').addEventListener('input', (e) => { 
            const val = e.target.value;
            if(currentTab === 'main') {
                currentFilters.search = val; currentPage = 1; renderGrid(); 
            } else {
                ytFilters.search = val; renderYoutubeGrid();
            }
        });
        
        if (document.getElementById('globalSearchInputMobile')) {
             document.getElementById('globalSearchInputMobile').addEventListener('input', (e) => { 
                const val = e.target.value;
                if(currentTab === 'main') {
                    currentFilters.search = val; currentPage = 1; renderGrid(); 
                } else {
                    ytFilters.search = val; renderYoutubeGrid();
                }
            });
        }
        
        document.getElementById('filterDirector').addEventListener('input', (e) => { currentFilters.director = e.target.value; currentPage = 1; renderGrid(); });
        document.getElementById('filterYear').addEventListener('input', (e) => { currentFilters.year = e.target.value; currentPage = 1; renderGrid(); });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isAdmin || !auth.currentUser) return;

            const id = document.getElementById('itemId').value;
            const newItem = {
                title: document.getElementById('itemTitle').value,
                type: document.getElementById('itemType').value,
                status: document.getElementById('itemStatus').value,
                rating: document.getElementById('itemRating').value ? parseFloat(document.getElementById('itemRating').value) : null,
                year: document.getElementById('itemYear').value ? parseInt(document.getElementById('itemYear').value) : null,
                duration: document.getElementById('itemDuration').value ? parseInt(document.getElementById('itemDuration').value) : null,
                director: document.getElementById('itemDirector').value,
                genres: selectedGenres,
                genre: document.getElementById('itemLegacyGenre').value,
                isTop: document.getElementById('itemIsTop').checked,
                poster: document.getElementById('itemPoster').value,
                kpUrl: document.getElementById('itemKpUrl').value,
                imdbUrl: document.getElementById('itemImdbUrl').value,
                comment: document.getElementById('itemComment').value
            };

            try {
                if (id) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tracker_items', id), newItem);
                else await addDoc(itemsCollection, newItem);
                closeModal();
            } catch (error) { console.error("Ошибка сохранения:", error); }
        });
        
        ytForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isAdmin || !auth.currentUser) return;
            
            const selectedCat = document.querySelector('input[name="ytCategory"]:checked');

            const id = document.getElementById('ytItemId').value;
            const newItem = {
                url: document.getElementById('ytUrl').value,
                title: document.getElementById('ytTitle').value || 'Без названия',
                channel: document.getElementById('ytChannel').value,
                duration: document.getElementById('ytDuration').value,
                thumbnail: document.getElementById('ytThumbnailUrl').value,
                category: selectedCat ? selectedCat.value : null,
                isPriority: document.getElementById('ytIsPriority').value === 'true',
                comment: document.getElementById('ytComment').value,
                addedAt: new Date()
            };

            try {
                if (id) {
                    delete newItem.addedAt; 
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'youtube_items', id), newItem);
                }
                else await addDoc(youtubeCollection, newItem);
                closeYoutubeModal();
            } catch (error) { console.error("Ошибка сохранения YT:", error); }
        });
    }


    // Esc закрывает верхнее открытое окно; клик мимо закрывает выпадающий список жанров
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const open = [['confirmModal','closeConfirmModal'],['passwordModal','closePasswordModal'],['settingsModal','closeSettingsModal'],['youtubeModal','closeYoutubeModal'],['itemModal','closeModal'],['viewModal','closeViewModal']]
            .find(([id]) => !document.getElementById(id).classList.contains('hidden'));
        if (open) window[open[1]]();
    });
    document.addEventListener('click', () => closeAllCustomSelects());


    // ✨ Блик и лёгкий наклон карточки за курсором (стили — css/style.css, раздел 8)
    ['contentGrid', 'youtubeGrid'].forEach(id => document.getElementById(id).addEventListener('pointermove', e => {
        const c = e.target.closest('.card-transition'); if (!c) return;
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty('--mx', x * 100 + '%'); c.style.setProperty('--my', y * 100 + '%');
        c.style.setProperty('--rx', (0.5 - y) * 6 + 'deg'); c.style.setProperty('--ry', (x - 0.5) * 6 + 'deg');
    }));
    document.getElementById('sortSelect').addEventListener('change', e => { currentFilters.sort = e.target.value; currentPage = 1; renderGrid(); });
    // ⌨️ Клавиша «/» — фокус на поиск
    document.addEventListener('keydown', e => {
        if (e.key !== '/' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
        e.preventDefault();
        document.getElementById(innerWidth >= 768 ? 'globalSearchInput' : 'globalSearchInputMobile').focus();
    });

    init();
