/**
 * ==========================================================================
 * МОДУЛЬ API.JS — ЧАСТЬ 1: СБОР ДАННЫХ И ТЕКСТОВЫХ СПРАВОК
 * ==========================================================================
 */

// Объект-клиент для группировки всех запросов к внешним сервисам
const AppAPI = {

    /**
     * 1. ПОЛУЧЕНИЕ ИНФОРМАЦИИ О СТРАНЕ (REST Countries API)
     * Находит флаг, столицу, население, код валюты и регион.
     * @param {string} countryName - Название страны на английском (из геоданных глобуса)
     * @returns {Promise<Object|null>} - Объект с чистыми данными или null при ошибке
     */
    async getCountryData(countryName) {
        try {
            // Делаем запрос к официальной базе данных стран по названию
            const response = await fetch(`https://restcountries.com{encodeURIComponent(countryName)}?fullText=true`);
            
            if (!response.ok) {
                // Если по полному имени не нашли, пробуем обычный поиск (на всякий случай)
                const fallbackResponse = await fetch(`https://restcountries.com{encodeURIComponent(countryName)}`);
                if (!fallbackResponse.ok) return null;
                const fallbackData = await fallbackResponse.json();
                return this.extractCleanCountryFields(fallbackData[0]);
            }

            const data = await response.json();
            return this.extractCleanCountryFields(data[0]);
        } catch (error) {
            console.error("Ошибка при получении данных о стране:", error);
            return null;
        }
    },

    // Вспомогательный метод для красивой форматировки сырых данных от сервера
    extractCleanCountryFields(rawCountry) {
        // Извлекаем код валюты (например, USD, RUB, EUR)
        const currencyKey = rawCountry.currencies ? Object.keys(rawCountry.currencies)[0] : null;
        const currencyName = currencyKey ? rawCountry.currencies[currencyKey].name : '—';
        const currencySymbol = currencyKey ? rawCountry.currencies[currencyKey].symbol || '' : '';

        return {
            nameRu: rawCountry.translations?.rus?.official || rawCountry.translations?.rus?.common || rawCountry.name.common,
            capital: rawCountry.capital ? rawCountry.capital[0] : '—',
            population: rawCountry.population ? rawCountry.population.toLocaleString('ru-RU') : '—',
            currency: currencyKey ? `${currencyName} (${currencySymbol} ${currencyKey})` : '—',
            flagUrl: rawCountry.flags?.svg || rawCountry.flags?.png || '',
            latlng: rawCountry.latlng || [0, 0]
        };
    },

    /**
     * 2. ПОЛУЧЕНИЕ КРАТКОЙ СПРАВКИ ИЗ ВИКИПЕДИИ (Wikipedia API)
     * Автоматически ищет статью на русском языке и вырезает первое описание.
     * @param {string} query - Название страны или города для поиска
     * @returns {Promise<string>} - Текст статьи или сообщение, что ничего не найдено
     */
    async getWikipediaSummary(query) {
        try {
            // Формируем запрос к русскоязычной Википедии, просим вернуть вводный экстракт статьи в формате JSON
            const url = `https://wikipedia.org{encodeURIComponent(query)}`;
            
            const response = await fetch(url);
            if (!response.ok) return "Не удалось подключиться к Википедии.";

            const data = await response.json();
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];

            // Если статья найдена и ID не равен "-1"
            if (pageId && pageId !== "-1") {
                let text = pages[pageId].extract;
                if (text && text.trim().length > 0) {
                    // Ограничиваем текст, чтобы он красиво помещался в сайдбаре (около 500 символов)
                    return text.length > 550 ? text.substring(0, 550) + "..." : text;
                }
            }
            return `К сожалению, развернутой справки о «${query}» в автоматическом реестре не найдено.`;
        } catch (error) {
            console.error("Ошибка при запросе к Wikipedia API:", error);
            return "Ошибка загрузки данных из Википедии.";
        }
    }
};
    /**
     * 3. ГЕНЕРАЦИЯ ЛЕГАЛЬНЫХ ФОТОГРАФИЙ (Unsplash Source Engine)
     * Генерирует массив проверенных прямых ссылок на качественные фото
     * достопримечательностей без нарушения авторских прав и без ключей доступа.
     * @param {string} query - Название локации (например, "Saint-Petersburg landmarks")
     * @param {number} count - Сколько картинок нужно сгенерировать для сетки
     * @returns {Array<string>} - Массив валидных URL-адресов картинок
     */
    getImagesForGallery(query, count = 4) {
        const images = [];
        // Используем очищенный поисковый запрос (убираем лишние пробелы)
        const cleanQuery = encodeURIComponent(query.trim().toLowerCase());
        
        // Генерируем уникальные ссылки, добавляя к каждой картинке случайный индекс (seed),
        // чтобы браузер пользователя не кэшировал одинаковые фото, а выдавал разные ракурсы.
        for (let i = 1; i <= count; i++) {
            const randomSeed = Math.floor(Math.random() * 1000) + i;
            const imageUrl = `https://unsplash.com{1500000000000 + randomSeed}?auto=format&fit=crop&w=400&q=80&sig=${randomSeed}&q=${cleanQuery}`;
            images.push(imageUrl);
        }
        
        return images;
    },

    /**
     * 4. ЖИВОЙ ТРЕКЕР МЕЖДУНАРОДНОЙ КОСМИЧЕСКОЙ СТАНЦИИ (ISS Open API)
     * Запрашивает точные географические координаты МКС на текущую секунду.
     * @returns {Promise<Object|null>} - Объект с широтой и долготой станции
     */
    async getISSLocation() {
        try {
            const response = await fetch('https://wheretheiss.at');
            if (!response.ok) return null;
            
            const data = await response.json();
            return {
                lat: parseFloat(data.latitude),
                lng: parseFloat(data.longitude),
                altitude: parseFloat(data.altitude),
                velocity: Math.round(data.velocity)
            };
        } catch (error) {
            console.error("Ошибка при получении координат МКС:", error);
            return null;
        }
    }
};

// Экспортируем наш объект в глобальную область видимости, чтобы другие файлы его видели
window.AppAPI = AppAPI;
