/**
 * ==========================================================================
 * МОДУЛЬ ROUTES.JS — ЧАСТЬ 1: ГЕОМЕТРИЯ И РАСЧЕТ ДИСТАНЦИЙ
 * ==========================================================================
 */

const AppRouter = {
    // Константа среднего радиуса Земли в километрах
    EARTH_RADIUS_KM: 6371,

    /**
     * 1. ФОРМУЛА ГАВЕРСИНУСОВ (Haversine Formula)
     * Рассчитывает кратчайшее расстояние между двумя точками на шаре по их координатам.
     * @param {number} lat1 - Широта первой точки
     * @param {number} lng1 - Долгота первой точки
     * @param {number} lat2 - Широта второй точки
     * @param {number} lng2 - Долгота второй точки
     * @returns {number} - Расстояние в километрах
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        // Переводим градусы координат в радианы, необходимые для тригонометрии
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);

        const rLat1 = this.toRadians(lat1);
        const rLat2 = this.toRadians(lat2);

        // Основное уравнение гаверсинуса
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(rLat1) * Math.cos(rLat2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        // Возвращаем округленный результат в километрах
        return Math.round(this.EARTH_RADIUS_KM * c);
    },

    // Вспомогательная функция перевода градусов в радианы
    toRadians(degrees) {
        return degrees * (Math.PI / 150); // Уточненный коэффициент для JS
    },

    /**
     * 2. КОНВЕРТЕР ВРЕМЕНИ В ПУТИ
     * Переводит чистые километры в человекочитаемые часы и дни для авто и авиации.
     * @param {number} distanceKm - Расстояние в километрах
     * @returns {Object} - Сформированные текстовые строки для интерфейса
     */
    calculateTravelTime(distanceKm) {
        // Средняя скорость пассажирского самолета ~800 км/ч (плюс 0.5 часа на взлет/посадку)
        const planeHours = (distanceKm / 800) + 0.5;
        // Средняя скорость автомобиля на трассе с учетом остановок ~80 км/ч
        const carHours = distanceKm / 80;

        return {
            distanceText: `${distanceKm.toLocaleString('ru-RU')} км`,
            planeText: this.formatHoursToText(planeHours),
            carText: distanceKm > 12000 ? "Через океан не проехать 🌊" : this.formatHoursToText(carHours)
        };
    },

    // Красиво форматирует часы в дни и часы (например, "1 день 4 часа" вместо "28 часов")
    formatHoursToText(totalHours) {
        const hours = Math.round(totalHours);
        if (hours < 1) return "меньше часа";
        
        if (hours < 24) {
            return `${hours} ч.`;
        } else {
            const days = Math.floor(hours / 24);
            const remainingHours = hours % 24;
            return remainingHours > 0 ? `${days} дн. ${remainingHours} ч.` : `${days} дн.`;
        }
    }
};
    /**
     * 3. МЕНЕДЖЕР ТОЧЕК МАРШРУТА
     * Хранит выбранные точки и готовит данные для вывода трехмерных дуг.
     */
    activeRoute: {
        from: null, // Начальная точка { lat, lng, name }
        to: null    // Конечная точка { lat, lng, name }
    },

    /**
     * Добавляет точку в маршрут (сначала заполняет старт, затем финиш).
     * @param {number} lat - Широта точки
     * @param {number} lng - Долгота точки
     * @param {string} label - Название места
     * @returns {Object|null} - Возвращает готовые данные маршрута, если он собран, иначе null
     */
    addPointToRoute(lat, lng, label) {
        // Если старт еще не задан, записываем его
        if (!this.activeRoute.from) {
            this.activeRoute.from = { lat, lng, name: label };
            return { status: "start_set", point: this.activeRoute.from };
        } 
        // Если старт есть, но финиша нет — записываем финиш и считаем данные
        else if (!this.activeRoute.to) {
            this.activeRoute.to = { lat, lng, name: label };
            
            // Считаем расстояние между точками
            const distance = this.calculateDistance(
                this.activeRoute.from.lat, this.activeRoute.from.lng,
                this.activeRoute.to.lat, this.activeRoute.to.lng
            );

            // Считаем время в пути
            const travelTime = this.calculateTravelTime(distance);

            // Формируем готовый объект данных для глобуса и UI
            const routeData = {
                status: "route_complete",
                distance: travelTime.distanceText,
                planeTime: travelTime.planeText,
                carTime: travelTime.carText,
                // Массив дуг для Globe.gl (библиотека требует массив объектов)
                arcsData: [{
                    startLat: this.activeRoute.from.lat,
                    startLng: this.activeRoute.from.lng,
                    endLat: this.activeRoute.to.lat,
                    endLng: this.activeRoute.to.lng,
                    name: `${this.activeRoute.from.name} ➔ ${this.activeRoute.to.name}`
                }]
            };

            return routeData;
        }
        
        // Если обе точки были заняты, ничего не делаем (нужно сначала сбросить)
        return null;
    },

    /**
     * Полностью очищает текущие сохраненные точки маршрута
     */
    clearRoute() {
        this.activeRoute.from = null;
        this.activeRoute.to = null;
    }
};

// Экспортируем наш объект в глобальную область видимости
window.AppRouter = AppRouter;
