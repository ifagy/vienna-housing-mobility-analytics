import { TRAVEL_MATRIX } from '../../data/travel_matrix.js';

export default class ExplorerVis {
    constructor(_config, _data, _geoData, _dispatcher) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 580,
            containerHeight: _config.containerHeight || 480,
            margin: _config.margin || { top: 0, right: 0, bottom: 0, left: 0 },
            matchCountElement: _config.matchCountElement || '#match-count',
            matchListElement: _config.matchListElement || '#match-list',
            priceValElement: _config.priceValElement || '#price-range-val',
            jobsValElement: _config.jobsValElement || '#jobs-range-val'
        };
        
        this.data = _data;
        this.geoData = _geoData;
        this.dispatcher = _dispatcher;
        
        this.distMap = new Map(this.data.map(d => [d.id, d]));

        this.maxPrice = Infinity;
        this.minJobs = 0;
        this.maxTravelTime = 30; 
        this.hoveredDistrictId = null;

       
        this.centroids = new Map();

        this.initVis();
    }

    initVis() {
        let vis = this;

        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        vis.svg = d3.select(vis.config.parentElement)
            .append('svg')
            .attr('viewBox', `0 0 ${vis.config.containerWidth} ${vis.config.containerHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('width', '100%')
            .style('height', '100%')
            .style('display', 'block');

        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        vis.projection = d3.geoMercator().fitSize([vis.width - 20, vis.height - 20], vis.geoData);
        vis.path = d3.geoPath().projection(vis.projection);

       
        vis.geoData.features.forEach(f => {
            vis.centroids.set(f.properties.BEZNR, vis.path.centroid(f));
        });

        
        vis.mapG = vis.chart.append('g');
        vis.labelG = vis.chart.append('g');
        vis.circleG = vis.chart.append('g').attr('class', 'isochrone-circle-g');

       
        vis.labelG.selectAll('.exp-label')
            .data(vis.geoData.features)
            .join('text')
                .attr('class', 'exp-label')
                .attr('x', f => vis.centroids.get(f.properties.BEZNR)[0])
                .attr('y', f => vis.centroids.get(f.properties.BEZNR)[1] + 4)
                .attr('text-anchor', 'middle')
                .attr('fill', '#ffffff')
                .attr('font-size', '11px')
                .attr('font-weight', '700')
                .attr('font-family', 'Space Grotesk, sans-serif')
                .attr('paint-order', 'stroke')
                .attr('stroke', '#0e0f13')
                .attr('stroke-width', '2.5px')
                .attr('stroke-linejoin', 'round')
                .attr('pointer-events', 'none')
                .text(f => f.properties.BEZNR);

       
        vis.isochroneCircle = vis.circleG.append('circle')
            .attr('class', 'isochrone-circle')
            .style('fill', 'rgba(78, 203, 141, 0.12)') 
            .style('stroke', '#4ecb8d')
            .style('stroke-width', '1.5px')
            .style('stroke-dasharray', '4 4')
            .style('pointer-events', 'none')
            .style('opacity', 0);

        
        vis.paths = vis.mapG.selectAll('.exp-path')
            .data(vis.geoData.features)
            .join('path')
                .attr('class', 'exp-path')
                .attr('d', vis.path)
                .style('cursor', 'pointer')
                .attr('stroke', '#0e0f13')
                .attr('stroke-width', 1);

        vis.updateVis();
    }

    updateVis() {
        let vis = this;

        vis.matchedDistricts = vis.data.filter(d => 
            d.avg_price <= vis.maxPrice && 
            d.in_commuters >= vis.minJobs
        );
        vis.matchedIds = new Set(vis.matchedDistricts.map(d => d.id));

        vis.updateUI();
        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        const tooltipHtml = (d) => {
            let reachableCount = 0;
            const row = TRAVEL_MATRIX[d.id];
            if (row) {
                // Tooltip'teki sayı artık 3 filtrenin kesişimini sayıyor!
                Object.entries(row).forEach(([targetId, time]) => {
                    if (time <= vis.maxTravelTime && vis.matchedIds.has(Number(targetId))) {
                        reachableCount++;
                    }
                });
            }

            return `
                <div class="tt-title">${d.id}. ${d.name}</div>
                <div class="tt-row"><span class="tt-label">Avg rent</span><span class="tt-val">€${d.avg_price.toFixed(2)}/m²</span></div>
                <div class="tt-row"><span class="tt-label">In-commuters</span><span class="tt-val">${d.in_commuters.toLocaleString()}</span></div>
                <div class="tt-row"><span class="tt-label">Matches in Reach</span><span class="tt-val" style="color: #4ecb8d">${reachableCount} Bezirke</span></div>
            `;
        };

        vis.paths
            .attr('fill', f => {
                const d = vis.distMap.get(f.properties.BEZNR);
                if (!d) return '#333';
                return vis.matchedIds.has(d.id) ? '#4ecb8d' : '#3a3b47';
            })
            .attr('opacity', 1)
            .on('mouseover', function(event, f) {
                const d = vis.distMap.get(f.properties.BEZNR);
                if (!d) return;

                vis.hoveredDistrictId = f.properties.BEZNR;
                const originCentroid = vis.centroids.get(vis.hoveredDistrictId);

                let maxRadius = 0;
                
                vis.paths.each(function(targetFeature) {
                    const targetId = targetFeature.properties.BEZNR;
                    const travelTime = TRAVEL_MATRIX[vis.hoveredDistrictId][targetId];
                    
                    let targetColor = '#2a2b35'; // Varsayılan: Süre yetmiyor (Koyu)
                    let targetOpacity = 0.3;     // Varsayılan: Süre yetmiyor (Saydam)

                    if (targetId === vis.hoveredDistrictId) {
                        // Kendi ilçesi
                        targetColor = '#5b9cf6'; 
                        targetOpacity = 1;
                    } else if (travelTime <= vis.maxTravelTime) {
                        // Süre YETİYOR, opacity tam. Ama yeşil mi olacak?
                        targetOpacity = 1;

                        if (vis.matchedIds.has(targetId)) {
                            // Hem süre yetiyor HEM DE bütçe/iş filtresinden geçti (YEŞİL)
                            targetColor = '#4ecb8d'; 
                            
                            // Çemberi sadece uyan ilçeleri kapsayacak şekilde büyüt
                            const targetCentroid = vis.centroids.get(targetId);
                            const dx = targetCentroid[0] - originCentroid[0];
                            const dy = targetCentroid[1] - originCentroid[1];
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > maxRadius) maxRadius = dist;
                        } else {
                            
                            targetColor = '#2a2b35'; 
                            targetOpacity = 0.3;
                        }
                    }

                    d3.select(this)
                        .attr('fill', targetColor)
                        .attr('opacity', targetOpacity)
                        .attr('stroke', targetId === vis.hoveredDistrictId ? '#ffffff' : '#0e0f13')
                        .attr('stroke-width', targetId === vis.hoveredDistrictId ? 2 : 1);
                });

            
                vis.isochroneCircle
                    .attr('cx', originCentroid[0])
                    .attr('cy', originCentroid[1])
                    .attr('r', maxRadius > 0 ? maxRadius + 15 : 15)
                    .style('opacity', 1);

                // --- 3. İSTEK: YAN PANELİ DİNAMİK OLARAK GÜNCELLE ---
                vis.updateUI(vis.hoveredDistrictId);

                vis.dispatcher.call('showTooltip', event, event, tooltipHtml(d));
                vis.dispatcher.call('linkDistrict', event, d.id);
            })
            .on('mousemove', (event) => vis.dispatcher.call('moveTooltip', event, event))
            .on('mouseout', function() {
                vis.hoveredDistrictId = null;
                vis.isochroneCircle.style('opacity', 0);
                
                // Mouse çekilince haritayı eski haline getir
                vis.paths
                    .attr('fill', f => {
                        const d = vis.distMap.get(f.properties.BEZNR);
                        return (d && vis.matchedIds.has(d.id)) ? '#4ecb8d' : '#3a3b47';
                    })
                    .attr('opacity', 1)
                    .attr('stroke', '#0e0f13')
                    .attr('stroke-width', 1);

                // --- 3. İSTEK: YAN PANELİ ESKİ (GLOBAL) HALİNE GETİR ---
                vis.updateUI();

                vis.dispatcher.call('hideTooltip');
                vis.dispatcher.call('unlinkDistrict');
            });
    }

    // YENİ updateUI FONKSİYONU (hoveredId parametresi eklendi)
    updateUI(hoveredId = null) {
        let vis = this;
        
        // Slider etiketlerini güncelle
        d3.select(vis.config.priceValElement).text(`€${vis.maxPrice}/m²`);
        d3.select(vis.config.jobsValElement).text(
            vis.minJobs === 0 ? 'Any' : `${(vis.minJobs / 1000)}k+ people`
        );

        // Dinamik filtreleme: Eğer hover yapıldıysa, sadece süreye uyan match'leri göster
        let displayDistricts = vis.matchedDistricts;
        
        if (hoveredId !== null) {
            displayDistricts = vis.matchedDistricts.filter(d => {
                // Seçilen ilçeden hedef ilçeye olan süre <= seçilen süre mi?
                return TRAVEL_MATRIX[hoveredId][d.id] <= vis.maxTravelTime;
            });
        }

        // Metinleri Güncelle
        d3.select(vis.config.matchCountElement).text(displayDistricts.length);
        
        const listText = displayDistricts.length > 0
            ? displayDistricts
                .sort((a, b) => a.avg_price - b.avg_price)
                .map(d => `${d.id}. ${d.name}`)
                .join(' · ')
            : 'No districts match criteria.';
            
        d3.select(vis.config.matchListElement).text(listText);
    }

    updateFilters(newMaxPrice, newMinJobs) {
        this.maxPrice = newMaxPrice;
        this.minJobs = newMinJobs;
        this.updateVis();
    }

    updateTravelTime(newTime) {
        this.maxTravelTime = newTime;
        this.renderVis(); 
    }
}