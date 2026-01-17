class BusTracker {
    constructor() {
        this.map = null;
        this.currentRoute = null;
        this.stops = [];
        this.etas = {};
        this.language = 'zh';
        this.mapboxToken = 'pk.eyJ1IjoibmFuNm9rIiwiYSI6ImNtazB2bTYxMTdhNnkzZHB1cXN4bTRmb3UifQ.c6BNgPAE-3qtewe22CGvyQ';
        
        this.init();
    }
    
    init() {
        // 初始化地图
        mapboxgl.accessToken = this.mapboxToken;
        this.map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [114.1772, 22.3027], // 香港中心坐标
            zoom: 12
        });
        
        // 添加地图控件
        this.map.addControl(new mapboxgl.NavigationControl());
        
        // 绑定事件
        document.getElementById('search-btn').addEventListener('click', () => this.searchRoute());
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchLanguage(e.target.dataset.lang));
        });
        
        // 初始语言设置
        this.updateLanguage();
    }
    
    async searchRoute() {
        const start = document.getElementById('start').value;
        const end = document.getElementById('end').value;
        
        if (!start || !end) {
            alert(this.language === 'zh' ? '請輸入起點和終點' : 'Please enter start and end points');
            return;
        }
        
        try {
            // 1. 获取路线规划
            const routeData = await this.fetchRoutePlan(start, end);
            this.displayRoute(routeData);
            
            // 2. 获取巴士站点
            const busSegment = this.extractBusSegment(routeData);
            if (busSegment) {
                await this.fetchBusStops(busSegment);
            }
            
            // 3. 定期更新ETA
            this.startETAUpdates();
            
        } catch (error) {
            console.error('Search error:', error);
            alert(this.language === 'zh' ? '搜索失敗，請重試' : 'Search failed, please try again');
        }
    }
    
    async fetchRoutePlan(start, end) {
        const response = await fetch('http://localhost:3000/api/route-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: start, to: end })
        });
        
        if (!response.ok) throw new Error('Route planning failed');
        return await response.json();
    }
    
    displayRoute(routeData) {
        // 清空地图上的现有标记
        this.clearMap();
        
        // 绘制路线
        const coordinates = this.extractRouteCoordinates(routeData);
        if (coordinates.length > 0) {
            this.map.addSource('route', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: coordinates
                    }
                }
            });
            
            this.map.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#007cbf',
                    'line-width': 4,
                    'line-opacity': 0.75
                }
            });
            
            // 调整地图视图以适应路线
            const bounds = coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
            
            this.map.fitBounds(bounds, { padding: 50 });
        }
    }
    
    async fetchBusStops(busInfo) {
        const { company, route, direction } = busInfo;
        
        try {
            const response = await fetch(
                `http://localhost:3000/api/bus-stops/${company}/${route}?dir=${direction}`
            );
            const stopsData = await response.json();
            
            this.stops = this.processStopsData(stopsData);
            this.displayBusStops();
            
        } catch (error) {
            console.error('Failed to fetch bus stops:', error);
        }
    }
    
    displayBusStops() {
        // 在地图上标记巴士站点
        this.stops.forEach((stop, index) => {
            const popupContent = this.language === 'zh' 
                ? `<strong>${stop.name_zh}</strong><br>序號: ${index + 1}`
                : `<strong>${stop.name_en}</strong><br>Sequence: ${index + 1}`;
            
            const marker = new mapboxgl.Marker({
                color: '#ff0000',
                draggable: false
            })
            .setLngLat([stop.lng, stop.lat])
            .setPopup(new mapboxgl.Popup().setHTML(popupContent))
            .addTo(this.map);
            
            // 在侧边栏显示站点列表
            this.addStopToSidebar(stop, index + 1);
        });
    }
    
    async fetchETA(stopId) {
        if (!this.currentRoute) return;
        
        const { company, route } = this.currentRoute;
        
        try {
            const response = await fetch(
                `http://localhost:3000/api/eta/${company}/${route}/${stopId}`
            );
            const etaData = await response.json();
            
            // 处理ETA数据
            if (etaData && etaData.estimatedArrival) {
                this.etas[stopId] = etaData.estimatedArrival;
                this.updateStopETA(stopId, etaData.estimatedArrival);
            }
            
        } catch (error) {
            console.error(`Failed to fetch ETA for stop ${stopId}:`, error);
        }
    }
    
    startETAUpdates() {
        // 每30秒更新一次ETA
        if (this.etaInterval) clearInterval(this.etaInterval);
        
        this.etaInterval = setInterval(() => {
            if (this.stops.length > 0) {
                this.stops.forEach(stop => {
                    this.fetchETA(stop.id);
                });
            }
        }, 30000); // 30秒
        
        // 立即获取一次
        this.stops.forEach(stop => {
            this.fetchETA(stop.id);
        });
    }
    
    switchLanguage(lang) {
        this.language = lang;
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
        this.updateLanguage();
    }
    
    updateLanguage() {
        // 更新界面文本
        const translations = {
            zh: {
                startLabel: '起點:',
                endLabel: '終點:',
                searchBtn: '搜索路線',
                routeDetails: '路線詳情',
                busStops: '巴士站點'
            },
            en: {
                startLabel: 'Start:',
                endLabel: 'End:',
                searchBtn: 'Search Route',
                routeDetails: 'Route Details',
                busStops: 'Bus Stops'
            }
        };
        
        const t = translations[this.language];
        document.querySelector('label[for="start"]').textContent = t.startLabel;
        document.querySelector('label[for="end"]').textContent = t.endLabel;
        document.getElementById('search-btn').textContent = t.searchBtn;
        
        // 更新其他界面元素...
    }
    
    clearMap() {
        // 清除地图上的图层和标记
        if (this.map.getSource('route')) {
            this.map.removeLayer('route');
            this.map.removeSource('route');
        }
        
        // 这里需要清除所有标记...
    }
    
    // 其他辅助方法...
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.busTracker = new BusTracker();
});
