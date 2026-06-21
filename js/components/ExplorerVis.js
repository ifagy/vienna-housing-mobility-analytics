// js/components/ExplorerVis.js

export default class ExplorerVis {
    constructor(_config, _data, _geoData, _dispatcher) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 580,
            containerHeight: _config.containerHeight || 480,
            margin: _config.margin || { top: 0, right: 0, bottom: 0, left: 0 },
            // DOM element IDs for updating text UI (defaults matching your HTML)
            matchCountElement: _config.matchCountElement || '#match-count',
            matchListElement: _config.matchListElement || '#match-list',
            priceValElement: _config.priceValElement || '#price-range-val',
            jobsValElement: _config.jobsValElement || '#jobs-range-val'
        };
        
        this.data = _data;
        this.geoData = _geoData;
        this.dispatcher = _dispatcher;
        
        this.distMap = new Map(this.data.map(d => [d.id, d]));

        // Default filter states (will be updated via external slider inputs)
        this.maxPrice = Infinity;
        this.minJobs = 0;
        
        // State for matched districts
        this.matchedDistricts = [];
        this.matchedIds = new Set();

        this.initVis();
    }

    initVis() {
        let vis = this;

        // Calculate inner dimensions
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Initialize SVG and group
        vis.svg = d3.select(vis.config.parentElement)
            .append('svg')
            .attr('viewBox', `0 0 ${vis.config.containerWidth} ${vis.config.containerHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('width', '100%')
            .style('height', '100%')
            .style('display', 'block');

        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Projection and Path generator (fitted to the new explorer dimensions)
        vis.projection = d3.geoMercator().fitSize([vis.width - 20, vis.height - 20], vis.geoData);
        vis.path = d3.geoPath().projection(vis.projection);

        // Group containers
        vis.mapG = vis.chart.append('g');
        vis.labelG = vis.chart.append('g');

        // Draw labels once (they don't change based on filters)
        vis.labelG.selectAll('.exp-label')
            .data(vis.geoData.features)
            .join('text')
                .attr('class', 'exp-label')
                .attr('x', f => vis.path.centroid(f)[0])
                .attr('y', f => vis.path.centroid(f)[1] + 4)
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

        vis.updateVis();
    }

    updateVis() {
        let vis = this;

        // Filter the dataset based on current constraints
        vis.matchedDistricts = vis.data.filter(d => 
            d.avg_price <= vis.maxPrice && 
            d.in_commuters >= vis.minJobs
        );
        
        // Create a Set of matched IDs for fast lookup during rendering
        vis.matchedIds = new Set(vis.matchedDistricts.map(d => d.id));

        // Update external DOM text elements related to the explorer tool
        vis.updateUI();

        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        // Tooltip formatting function
        const tooltipHtml = (d) => `
            <div class="tt-title">${d.id}. ${d.name}</div>
            <div class="tt-row"><span class="tt-label">Avg rent</span><span class="tt-val">€${d.avg_price.toFixed(2)}/m²</span></div>
            <div class="tt-row"><span class="tt-label">In-commuters</span><span class="tt-val">${d.in_commuters.toLocaleString()}</span></div>
        `;

        // Draw and update district paths
        vis.mapG.selectAll('.exp-path')
            .data(vis.geoData.features)
            .join('path')
                .attr('class', 'exp-path')
                .attr('d', vis.path)
                .style('cursor', 'pointer')
                .attr('fill', f => {
                    const d = vis.distMap.get(f.properties.BEZNR);
                    if (!d) return '#333';
                    // Highlight green if matched, otherwise dim out
                    return vis.matchedIds.has(d.id) ? '#4ecb8d' : '#3a3b47';
                })
                .attr('stroke', f => {
                    const d = vis.distMap.get(f.properties.BEZNR);
                    return (d && vis.matchedIds.has(d.id)) ? '#2e9c68' : '#0e0f13';
                })
                .attr('stroke-width', f => {
                    const d = vis.distMap.get(f.properties.BEZNR);
                    return (d && vis.matchedIds.has(d.id)) ? 1.5 : 1;
                })
                .on('mouseover', (event, f) => {
                    const d = vis.distMap.get(f.properties.BEZNR);
                    if (!d) return;
                    vis.dispatcher.call('showTooltip', event, event, tooltipHtml(d));
                })
                .on('mousemove', (event) => vis.dispatcher.call('moveTooltip', event, event))
                .on('mouseout', () => vis.dispatcher.call('hideTooltip'));
    }

    // Helper method to update DOM text dynamically
    updateUI() {
        let vis = this;

        // Update Slider value labels
        d3.select(vis.config.priceValElement).text(`€${vis.maxPrice}/m²`);
        d3.select(vis.config.jobsValElement).text(
            vis.minJobs === 0 ? 'Any' : `${(vis.minJobs / 1000)}k+ people`
        );

        // Update Results
        d3.select(vis.config.matchCountElement).text(vis.matchedDistricts.length);
        
        const listText = vis.matchedDistricts.length > 0
            ? vis.matchedDistricts
                .sort((a, b) => a.avg_price - b.avg_price)
                .map(d => `${d.id}. ${d.name} (€${d.avg_price.toFixed(1)}, ${Math.round(d.in_commuters / 1000)}k jobs)`)
                .join(' · ')
            : 'No districts match — try raising the budget or lowering the job requirement.';

        d3.select(vis.config.matchListElement).text(listText);
    }

    // External method called when sliders are moved
    updateFilters(newMaxPrice, newMinJobs) {
        this.maxPrice = newMaxPrice;
        this.minJobs = newMinJobs;
        this.updateVis();
    }
}