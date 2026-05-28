/**
 * ==========================================================================
 * ГЛАВНЫЙ СУПЕР-СКРИПТ APP.JS — ЧАСТЬ 1: ЗАПУСК 3D ДВИЖКА И КАРТЫ МИРА
 * ==========================================================================
 */

// Глобальные переменные для управления состояниями приложения
let worldGlobe = null;       // Ссылка на объект 3D-глобуса Globe.gl
let currentMap2D = null;     // Ссылка на объект плоской 2D-карты Leaflet
let isRouteMode = false;     // Флаг: включен ли сейчас режим построения маршрутов
let isISSTracking = false;   // Флаг: включено ли отслеживание МКС в реальном времени
let issIntervalId = null;    // ID таймера для ежесекундного обновления МКС

// Конфигурационные ссылки на официальные, стабильные текстуры Земли и космоса
const GLOBE_TEXTURES = {
    daySurface: 'https://unpkg.com',
    topologyBump: 'https://unpkg.com',
    nightLights: 'https://unpkg.com',
    spaceBackground: 'https://unpkg.com',
    geoJsonCountries: 'https://githubusercontent.com'
};

// Запускаем инициализацию проекта сразу после полной загрузки страницы браузером
document.addEventListener('DOMContentLoaded', () => {
    init3DGlobe();
    setupDOMEventListeners();
});

/**
 * 1. НАСТРОЙКА И ИНИЦИАЛИЗАЦИЯ 3D-ГЛОБУСА
 */
function init3DGlobe() {
    const container = document.getElementById('globe-container');
    
    // Создаем экземпляр глобуса и привязываем его к HTML-блоку
    worldGlobe = Globe()(container)
        .globeImageUrl(GLOBE_TEXTURES.daySurface)       // Дневная карта Земли
        .bumpImageUrl(GLOBE_TEXTURES.topologyBump)       // Карта высот (рельефность гор)
        .backgroundImageUrl(GLOBE_TEXTURES.spaceBackground) // Задний фон звездного космоса
        .showAtmosphere(true)                            // Включаем свечение атмосферы
        .atmosphereColor('#00f2fe')                      // Цвет атмосферы (кибер-синий)
        .atmosphereAltitude(0.15);                       // Толщина атмосферного слоя

    // Настраиваем встроенный контроллер управления камерой (мышь / тачпад)
    const controls = worldGlobe.controls();
    controls.autoRotate = true;          // Включаем автоматическое вращение планеты
    controls.autoRotateSpeed = 0.4;      // Задаем комфортную, неторопливую скорость
    controls.enableDamping = true;       // Плавное торможение камеры при ручном вращении
    controls.dampingFactor = 0.05;
    controls.minDistance = 140;          // Максимальное приближение камеры (чтобы не провалиться внутрь Земли)
    controls.maxDistance = 500;          // Максимальное отдаление в космос

    // Загружаем векторную сетку границ стран (GeoJSON)
    fetch(GLOBE_TEXTURES.geoJsonCountries)
        .then(res => res.json())
        .then(geoJsonData => {
            // Передаем границы стран в 3D движок
            worldGlobe.polygonsData(geoJsonData.features)
                // Цвет заливки стран изнутри (светло-синий прозрачный)
                .polygonCapColor(() => 'rgba(79, 172, 254, 0.06)')
                // Цвет тонких линий границ между странами
                .polygonStrokeColor(() => 'rgba(0, 242, 254, 0.35)')
                .polygonLineWidth(0.8)
                // Настройка интерактивной подсветки при наведении курсора мыши
                .polygonHoverSideColor(() => 'rgba(0, 255, 150, 0.18)')
                .polygonCapColor(d => d === worldGlobe.hoveredPolygon() ? 'rgba(0, 255, 150, 0.12)' : 'rgba(79, 172, 254, 0.06)')
                // Логика клика на полигон (страну)
                .onPolygonClick((polygon, event) => {
                    handleGlobeClick(polygon, event);
                });
        })
        .catch(err => console.error("Критическая ошибка загрузки карты мира GeoJSON:", err));

    // Адаптируем 3D сцену под размеры экрана при изменении окна браузера
    window.addEventListener('resize', () => {
        worldGlobe.width(window.innerWidth);
        worldGlobe.height(window.innerHeight);
    });
}
/**
 * ==========================================================================
 * ГЛАВНЫЙ СУПЕР-СКРИПТ APP.JS — ЧАСТЬ 2: ЛОГИКА КЛИКОВ И ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
 * ==========================================================================
 */

/**
 * 2. ОБРАБОТЧИК КЛИКА ПО СТРАНЕ НА ГЛОБУСЕ
 */
function handleGlobeClick(polygon, event) {
    // Получаем международное название страны из свойств полигона GeoJSON
    const countryNameEn = polygon.properties.NAME || polygon.properties.NAME_LONG;
    const countryNameRu = polygon.properties.NAME_RU || countryNameEn;

    // Если включен режим маршрутов, передаем координаты в роутер и прерываем обычный показ
    if (isRouteMode) {
        processRouteSelection(event.lat, event.lng, countryNameRu);
        return;
    }

    // Выключаем авто-вращение Земли, чтобы пользователь мог спокойно изучить место
    worldGlobe.controls().autoRotate = false;

    // Плавный подлет камеры к точке клика (Широта, Долгота, Высота камеры 1.3, Время полета 2 секунды)
    worldGlobe.pointOfView({ lat: event.lat, lng: event.lng, altitude: 1.3 }, 2000);

    // Показываем пользователю заглушку «Загрузка...» в сайдбаре перед запросами к серверам
    showSidebarLoading(countryNameRu);

    // Запускаем асинхронный параллельный сбор данных из всех API
    Promise.all([
        window.AppAPI.getCountryData(countryNameEn),
        window.AppAPI.getWikipediaSummary(countryNameRu)
    ]).then(([countryData, wikiSummary]) => {
        
        // Формируем поисковый запрос для картинок Unsplash (Название страны + достопримечательности)
        const photoQuery = `${countryNameEn} landmarks`;
        const galleryPhotos = window.AppAPI.getImagesForGallery(photoQuery, 4);

        // Обновляем все элементы интерфейса боковой панели реальными данными
        updateSidebarUI({
            title: countryNameRu,
            subtitle: countryData?.nameRu ? `Официально: ${countryData.nameRu}` : "Информация о государстве",
            flag: countryData?.flagUrl || "",
            description: wikiSummary,
            photos: galleryPhotos,
            capital: countryData?.capital || "—",
            population: countryData?.population || "—",
            currency: countryData?.currency || "—",
            time: calculateLocalTime(countryData?.latlng) // Рассчитываем примерное время
        });
    });
}

/**
 * 3. ФУНКЦИИ ОБНОВЛЕНИЯ UI БОКОВОЙ ПАНЕЛИ
 */
function showSidebarLoading(title) {
    document.getElementById('place-title').innerText = title;
    document.getElementById('place-subtitle').innerText = "Синхронизация с серверами данных...";
    document.getElementById('country-flag').style.display = 'none';
    document.getElementById('wiki-text').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Загрузка справки из Википедии...';
    document.getElementById('photo-gallery').innerHTML = '';
    
    // Сбрасываем карточки статистики в статус ожидания
    document.getElementById('stat-capital').innerText = "⏱️";
    document.getElementById('stat-population').innerText = "⏱️";
    document.getElementById('stat-currency').innerText = "⏱️";
    document.getElementById('stat-time').innerText = "⏱️";

    // Выдвигаем панель на экран
    document.getElementById('info-sidebar').classList.add('open');
}

function updateSidebarUI(data) {
    document.getElementById('place-title').innerText = data.title;
    document.getElementById('place-subtitle').innerText = data.subtitle;

    // Выводим флаг
    const flagImg = document.getElementById('country-flag');
    if (data.flag) {
        flagImg.src = data.flag;
        flagImg.style.display = 'block';
    } else {
        flagImg.style.display = 'none';
    }

    // Текст Википедии
    document.getElementById('wiki-text').innerText = data.description;

    // Заполняем статистику
    document.getElementById('stat-capital').innerText = data.capital;
    document.getElementById('stat-population').innerText = data.population;
    document.getElementById('stat-currency').innerText = data.currency;
    document.getElementById('stat-time').innerText = data.time;

    // Строим сетку легальных картинок в галерее
    const galleryContainer = document.getElementById('photo-gallery');
    galleryContainer.innerHTML = ''; // Очищаем старые
    
    data.photos.forEach(url => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `<img src="${url}" alt="Локация" onerror="this.src='https://unsplash.com'">`;
        galleryContainer.appendChild(item);
    });
}

// Вспомогательный расчет примерного времени на основе долготы (15 градусов = 1 час часового пояса)
function calculateLocalTime(latlng) {
    if (!latlng || latlng.length < 2) return "—";
    const lng = latlng[1];
    const utcOffset = Math.round(lng / 15);
    const date = new Date();
    const utcHours = date.getUTCHours();
    let localHours = (utcHours + utcOffset) % 24;
    if (localHours < 0) localHours += 24;
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${localHours.toString().padStart(2, '0')}:${minutes} (UTC${utcOffset >= 0 ? '+' : ''}${utcOffset})`;
}
/**
 * ==========================================================================
 * ГЛАВНЫЙ СУПЕР-СКРИПТ APP.JS — ЧАСТЬ 3: КНОПКИ УПРАВЛЕНИЯ, МАРШРУТЫ И МКС
 * ==========================================================================
 */

/**
 * 4. ПРИВЯЗКА СОБЫТИЙ К КНОПКАМ ИНТЕРФЕЙСА (DOM Event Listeners)
 */
function setupDOMEventListeners() {
    // Кнопка закрытия боковой панели
    document.getElementById('close-sidebar-btn').addEventListener('click', () => {
        document.getElementById('info-sidebar').classList.remove('open');
        // Если мы не в режиме МКС или маршрутов, возвращаем авто-вращение
        if (!isRouteMode && !isISSTracking) {
            worldGlobe.controls().autoRotate = true;
        }
    });

    // Кнопка режима построения маршрутов
    const routeBtn = document.getElementById('route-mode-btn');
    routeBtn.addEventListener('click', () => {
        isRouteMode = !isRouteMode;
        routeBtn.classList.toggle('active', isRouteMode);
        
        const instructions = document.getElementById('route-instructions');
        const routeSection = document.getElementById('route-info-section');
        
        if (isRouteMode) {
            // Отключаем трекер МКС, если он был включен, чтобы не путать маркеры
            if (isISSTracking) document.getElementById('iss-btn').click();
            
            instructions.style.display = 'flex';
            instructions.querySelector('span').innerText = "Режим маршрута: выберите ПЕРВУЮ точку на глобусе";
            worldGlobe.controls().autoRotate = false;
        } else {
            instructions.style.display = 'none';
            routeSection.style.display = 'none';
            window.AppRouter.clearRoute();
            worldGlobe.arcsData([]); // Стираем дуги с глобуса
            worldGlobe.controls().autoRotate = true;
        }
    });

    // Кнопка сброса текущего маршрута
    document.getElementById('clear-route-btn').addEventListener('click', () => {
        window.AppRouter.clearRoute();
        worldGlobe.arcsData([]);
        document.getElementById('route-info-section').style.display = 'none';
        document.getElementById('route-instructions').querySelector('span').innerText = "Режим маршрута: выберите ПЕРВУЮ точку на глобусе";
    });

    // Кнопка трекера Международной Космической Станции (МКС)
    const issBtn = document.getElementById('iss-btn');
    issBtn.addEventListener('click', () => {
        isISSTracking = !isISSTracking;
        issBtn.classList.toggle('active', isISSTracking);

        if (isISSTracking) {
            // Если был включен режим маршрута — выключаем его
            if (isRouteMode) document.getElementById('route-mode-btn').click();
            
            worldGlobe.controls().autoRotate = false;
            // Сразу запускаем первый поиск станции
            trackISS();
            // Настраиваем ежесекундное обновление координат МКС (1000 миллисекунд)
            issIntervalId = setInterval(trackISS, 1000);
        } else {
            clearInterval(issIntervalId);
            worldGlobe.labelsData([]); // Удаляем метку МКС с глобуса
            worldGlobe.controls().autoRotate = true;
        }
    });

    // Кнопка телепортации в «Случайную страну»
    document.getElementById('random-country-btn').addEventListener('click', () => {
        const features = worldGlobe.polygonsData();
        if (features && features.length > 0) {
            // Выбираем случайный полигон из массива стран мира
            const randomPolygon = features[Math.floor(Math.random() * features.length)];
            
            // Чтобы найти координаты, берем первую точку границ полигона
            let lat = 0, lng = 0;
            if (randomPolygon.geometry.type === "Polygon") {
                lng = randomPolygon.geometry.coordinates[0][0][0];
                lat = randomPolygon.geometry.coordinates[0][0][1];
            } else if (randomPolygon.geometry.type === "MultiPolygon") {
                lng = randomPolygon.geometry.coordinates[0][0][0][0];
                lat = randomPolygon.geometry.coordinates[0][0][0][1];
            }
            
            // Имитируем клик, запуская наш стандартный обработчик полета камеры и API
            handleGlobeClick(randomPolygon, { lat, lng });
        }
    });
}

/**
 * 5. ЛОГИКА ОБРАБОТКИ ТОЧЕК МАРШРУТА
 */
function processRouteSelection(lat, lng, placeName) {
    const result = window.AppRouter.addPointToRoute(lat, lng, placeName);
    const instructionsText = document.getElementById('route-instructions').querySelector('span');
    
    if (!result) return;

    if (result.status === "start_set") {
        instructionsText.innerText = `Старт: ${result.point.name}. Выберите ВТОРУЮ точку для расчета пути.`;
    } 
    else if (result.status === "route_complete") {
        instructionsText.innerText = "Маршрут успешно построен!";
        
        // Передаем массив дуг в Globe.gl для трехмерной отрисовки в космосе
        worldGlobe.arcsData(result.arcsData)
            .arcColor(() => '#00f2fe')                   // Цвет светящейся дуги
            .arcAltitude(() => 0.4)                       // Высота выгиба дуги в космос
            .arcStroke(1.5)                               // Толщина линии дуги
            .arcDashLength(0.4)                           // Длина пунктира для бегущего импульса
            .arcDashGap(0.1)
            .arcDashAnimateTime(1500);                    // Скорость движения светового импульса
        
        // Заполняем карточку пути в боковой панели
        document.getElementById('route-distance').innerHTML = `<strong>Дистанция:</strong> ${result.distance}`;
        document.getElementById('route-time-plane').innerHTML = `<i class="fa-solid fa-plane"></i> <strong>На самолете:</strong> ${result.planeTime}`;
        document.getElementById('route-time-car').innerHTML = `<i class="fa-solid fa-car"></i> <strong>На машине:</strong> ${result.carTime}`;
        
        // Открываем блок карточки пути в сайдбаре
        document.getElementById('route-info-section').style.display = 'block';
        document.getElementById('place-title').innerText = "Карта полета";
        document.getElementById('place-subtitle').innerText = `${window.AppRouter.activeRoute.from.name} ➔ ${window.AppRouter.activeRoute.to.name}`;
        document.getElementById('info-sidebar').classList.add('open');
    }
}

/**
 * 6. ОНЛАЙН-ОТСЛЕЖИВАНИЕ МКС
 */
function trackISS() {
    window.AppAPI.getISSLocation().then(coords => {
        if (!coords) return;

        // Формируем объект метки для отображения на глобусе
        const issMarker = [{
            lat: coords.lat,
            lng: coords.lng,
            text: `🛰️ МКС (Скорость: ${coords.velocity.toLocaleString('ru-RU')} км/ч)`,
            color: '#ff4a4a'
        }];

        // Рисуем текстовую неоновую плашку МКС на глобусе над планетой
        worldGlobe.labelsData(issMarker)
            .labelLat(d => d.lat)
            .labelLng(d => d.lng)
            .labelText(d => d.text)
            .labelColor(() => '#ff4a4a')
            .labelSize(1.5)
            .labelDotRadius(0.8)
            .labelResolution(3);

        // Плавно центрируем камеру глобуса на МКС, чтобы она всегда была в фокусе (без изменения высоты)
        const currentPOV = worldGlobe.pointOfView();
        worldGlobe.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: currentPOV.altitude }, 300);
    });
}
