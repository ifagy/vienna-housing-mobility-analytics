// js/components/MapVis.js

export default class MapVis {
    constructor(_config, _data, _geoData, _dispatcher) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 520,
            containerHeight: _config.containerHeight || 360,
            margin: _config.margin || { top: 0, right: 0, bottom: 0, left: 0 },
            priceColors: ['#f5d76e', '#f5a623', '#e07b3a', '#c94040', '#8b1a1a'],
            outlierColor: '#a855f7'
        };
        
        this.data = _data;
        this.geoData = _geoData;
        this.dispatcher = _dispatcher; // For brushing & linking interactions
        
        // Fallback to the latest available year in the dataset
        this.mapYear = d3.max(this.data[0].price_ts, p => p.year);
        this.distMap = new Map(this.data.map(d => [d.id, d]));

        // State variables for map behaviors
        this.highlightOutlier = true;
        this.isGlobalMode = true; // True: absolute min/max prices. False: yearly relative prices.

        this.initVis();
    }

    initVis() {
        let vis = this;

        // Dimensions configuration
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // SVG Setup
        vis.svg = d3.select(vis.config.parentElement)
            .append('svg')
            .attr('viewBox', `0 0 ${vis.config.containerWidth} ${vis.config.containerHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('width', '100%')
            .style('height', '100%')
            .style('display', 'block');

        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Projection and Path generator
        vis.projection = d3.geoMercator().fitSize([vis.width - 20, vis.height - 50], vis.geoData);
        vis.path = d3.geoPath().projection(vis.projection);

        // Color Scale / Gradient definition for the Legend
        vis.defs = vis.svg.append('defs');
        vis.grad = vis.defs.append('linearGradient').attr('id', 'price-grad').attr('x1', '0%').attr('x2', '100%');
        
        vis.config.priceColors.forEach((c, i) => {
            vis.grad.append('stop')
                .attr('offset', (i / (vis.config.priceColors.length - 1) * 100) + '%')
                .attr('stop-color', c);
        });

        // Legend setup: Create text placeholders for dynamic updating later
        vis.legendG = vis.chart.append('g')
            .attr('transform', `translate(${vis.width / 2 - 110}, ${vis.height - 38})`);
            
        vis.legendG.append('rect')
            .attr('width', 220).attr('height', 9).attr('rx', 3)
            .style('fill', 'url(#price-grad)');
            
        vis.legendMinText = vis.legendG.append('text')
            .attr('x', 0).attr('y', 22)
            .attr('fill', '#7a7a8c').attr('font-size', '10px');
            
        vis.legendMaxText = vis.legendG.append('text')
            .attr('x', 220).attr('y', 22)
            .attr('fill', '#7a7a8c').attr('font-size', '10px')
            .attr('text-anchor', 'end');

        // Group container for district paths
        vis.mapG = vis.chart.append('g');

        // Pre-compute the absolute minimum and maximum prices across ALL years
        vis.computeGlobalPriceExtent();

        vis.updateVis();
    }

    /**
     * Calculates the lowest and highest prices across the entire 2012-2025 dataset.
     */
    computeGlobalPriceExtent() {
        let vis = this;
        let lo = Infinity, hi = -Infinity;
        vis.data.forEach(d => {
            if (d.id === 1) return; // Exclude District 1 (outlier) from scale
            d.price_ts.forEach(p => { 
                if (p.price < lo) lo = p.price; 
                if (p.price > hi) hi = p.price; 
            });
        });
        
        // Use the absolute minimum and maximum from the time series
        vis.globalMin = lo; 
        vis.globalMax = hi;
    }

    /**
     * Calculates the lowest and highest prices strictly for the CURRENT selected year.
     */
    computeYearlyPriceExtent() {
        let vis = this;
        let lo = Infinity, hi = -Infinity;
        vis.data.forEach(d => {
            if (vis.highlightOutlier && d.id === 1) return; 
            const currentPrice = vis.priceFor(d);
            if (currentPrice < lo) lo = currentPrice;
            if (currentPrice > hi) hi = currentPrice;
        });
        vis.yearlyMin = lo; 
        vis.yearlyMax = hi;
    }

    /**
     * Extracts dynamic price data matching the slider year.
     */
    priceFor(d) {
        let vis = this;
        const ts = d.price_ts.find(p => p.year === vis.mapYear);
        return ts ? ts.price : d.avg_price;
    }

    /**
     * Extracts dynamic commuter data matching the slider year.
     * Maps years 2024 and 2025 to 2023 due to dataset limits.
     */
    commutersFor(d) {
        let vis = this;
        // Commuter flows data only goes up to 2023, so we cap the target year at 2023
        const targetYear = vis.mapYear > 2023 ? 2023 : vis.mapYear;
        
        if (d.commute_ts) {
            const ts = d.commute_ts.find(c => c.year === targetYear);
            if (ts) {
                // Map the exact property names from the dataset: "in" and "out"
                return { inC: ts.in, outC: ts.out };
            }
        }
        
        // Fallback to static properties if time-series commuter data isn't found
        return { inC: d.in_commuters, outC: d.out_commuters };
    }

    priceColor(price, districtId) {
        let vis = this;
        if (vis.highlightOutlier && districtId === 1) return vis.config.outlierColor;
        
        // Determine color based on active bounds (global vs yearly)
        const t = (price - vis.priceMin) / (vis.priceMax - vis.priceMin);
        return d3.interpolateYlOrRd(Math.max(0, Math.min(1, t)) * 0.9);
    }

    updateVis() {
        let vis = this;
        
        // Decide which scale bounds to apply based on the current active mode
        if (vis.isGlobalMode) {
            vis.priceMin = vis.globalMin;
            vis.priceMax = vis.globalMax;
        } else {
            vis.computeYearlyPriceExtent();
            vis.priceMin = vis.yearlyMin;
            vis.priceMax = vis.yearlyMax;
        }
        
        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        // Ensure smooth transitions matching the interval duration
        const t = vis.chart.transition().duration(700).ease(d3.easeLinear);

        // Update Legend Text based on the mode
        if (vis.isGlobalMode) {
            vis.legendMinText.text(`€${vis.priceMin.toFixed(1)}/m²`);
            vis.legendMaxText.text(`€${vis.priceMax.toFixed(1)}/m²`);
        } else {
            vis.legendMinText.text('Affordable');
            vis.legendMaxText.text('Expensive');
        }

        // Tooltip formatting function now accepts dynamic commuter data
        const tooltipHtml = (d, currentYear, currentPrice, currentCommuters) => `
            <div class="tt-title">${d.id}. ${d.name}</div>
            <div class="tt-row"><span class="tt-label">Avg rent (${currentYear})</span><span class="tt-val">€${currentPrice.toFixed(2)}/m²</span></div>
            <div class="tt-row"><span class="tt-label">In-commuters</span><span class="tt-val">${currentCommuters.inC.toLocaleString()}</span></div>
            <div class="tt-row"><span class="tt-label">Out-commuters</span><span class="tt-val">${currentCommuters.outC.toLocaleString()}</span></div>
        `;

        // Draw and update District polygons
        const paths = vis.mapG.selectAll('.district-path')
            .data(vis.geoData.features)
            .join('path')
                .attr('class', 'district-path scrolly-map')
                .attr('d', vis.path);

        // Bind interactions
        paths.on('mouseover', (event, f) => {
            const d = vis.distMap.get(f.properties.BEZNR);
            if (!d) return;
            
            const currentPrice = vis.priceFor(d);
            const currentCommuters = vis.commutersFor(d); // Fetch dynamic commuters capped at 2023
            
            vis.dispatcher.call('showTooltip', event, event, tooltipHtml(d, vis.mapYear, currentPrice, currentCommuters));
            vis.dispatcher.call('linkDistrict', event, d.id);
        })
        .on('mousemove', (event) => vis.dispatcher.call('moveTooltip', event, event))
        .on('mouseout', () => {
            vis.dispatcher.call('hideTooltip');
            vis.dispatcher.call('unlinkDistrict');
        });

        // Apply dynamic color fill transitions
        paths.transition(t).attr('fill', f => {
            const d = vis.distMap.get(f.properties.BEZNR);
            return d ? vis.priceColor(vis.priceFor(d), d.id) : '#333';
        });

        // District ID labels
        vis.mapG.selectAll('.dist-label')
            .data(vis.geoData.features)
            .join('text')
                .attr('class', 'dist-label')
                .attr('x', f => vis.path.centroid(f)[0])
                .attr('y', f => vis.path.centroid(f)[1] + 4)
                .attr('text-anchor', 'middle')
                .attr('fill', '#ffffff')
                .attr('font-size', '10px')
                .attr('font-weight', '700')
                .attr('font-family', 'Space Grotesk, sans-serif')
                .attr('paint-order', 'stroke')
                .attr('stroke', '#1a1b22')
                .attr('stroke-width', '2.5px')
                .attr('stroke-linejoin', 'round')
                .attr('pointer-events', 'none')
                .text(f => f.properties.BEZNR);
    }

    /**
     * External method to toggle between Global (absolute) and Yearly (relative) modes.
     */
    setMode(isGlobal) {
        let vis = this;
        if (vis.isGlobalMode !== isGlobal) {
            vis.isGlobalMode = isGlobal;
            vis.updateVis();
        }
    }

    /**
     * External method to toggle the outlier state for District 1.
     */
    toggleOutlier(isActive) {
        let vis = this;
        if (vis.highlightOutlier !== isActive) {
            vis.highlightOutlier = isActive;
            vis.updateVis(); 
        }
    }

    /**
     * External method to trigger year updates via sliders or loops.
     */
    updateYear(newYear) {
        this.mapYear = newYear;
        this.updateVis();
    }
}