// js/components/ScatterVis.js

export default class ScatterVis {
    constructor(_config, _data, _dispatcher) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 520,
            containerHeight: _config.containerHeight || 380,
            margin: _config.margin || { top: 20, right: 30, bottom: 55, left: 70 }
        };
        
        this.data = _data;
        this.dispatcher = _dispatcher;

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

        // Helper functions for data extraction (using Net Balance)
        vis.xValue = d => d.avg_price;
        vis.yValue = d => d.in_commuters - d.out_commuters;

        // Initialize scales covering both negative and positive net balances
        vis.xScale = d3.scaleLinear()
            .domain([d3.min(vis.data, vis.xValue) * 0.97, d3.max(vis.data, vis.xValue) * 1.03])
            .range([0, vis.width]);
            
        vis.yScale = d3.scaleLinear()
            .domain([d3.min(vis.data, vis.yValue) * 1.1, d3.max(vis.data, vis.yValue) * 1.1])
            .range([vis.height, 0]);

        // Draw background grid lines (y-axis grid)
        vis.chart.append('g')
            .call(d3.axisLeft(vis.yScale).ticks(7).tickSize(-vis.width).tickFormat(''))
            .call(ax => { 
                ax.select('.domain').remove(); 
                ax.selectAll('line').attr('stroke', '#2a2b35'); 
            });

        // Draw Zero-Balance reference line
        vis.chart.append('line')
            .attr('class', 'zero-line')
            .attr('x1', 0).attr('x2', vis.width)
            .attr('y1', vis.yScale(0)).attr('y2', vis.yScale(0))
            .attr('stroke', '#4ecb8d')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4 4')
            .attr('opacity', 0.8);

        // Label for Zero-line
        vis.chart.append('text')
            .attr('x', vis.width - 5)
            .attr('y', vis.yScale(0) - 5)
            .attr('text-anchor', 'end')
            .attr('fill', '#4ecb8d')
            .attr('font-size', '9px')
            .text('Zero Balance (In = Out)');

        // Initialize Axes groups
        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${vis.height})`);
            
        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis');

        // Axis Titles
        vis.chart.append('text')
            .attr('x', vis.width / 2)
            .attr('y', vis.height + 44)
            .attr('text-anchor', 'middle')
            .attr('fill', '#7a7a8c')
            .attr('font-size', '11px')
            .text('Average rent (€/m²)');
            
        vis.chart.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -vis.height / 2)
            .attr('y', -54)
            .attr('text-anchor', 'middle')
            .attr('fill', '#7a7a8c')
            .attr('font-size', '11px')
            .text('Net Commuter Balance');

        vis.updateVis();
    }

    updateVis() {
        let vis = this;

        // Calculate linear regression (trend line) based on Net Balance
        const mx = d3.mean(vis.data, vis.xValue);
        const my = d3.mean(vis.data, vis.yValue);
        
        vis.slope = d3.sum(vis.data, d => (vis.xValue(d) - mx) * (vis.yValue(d) - my)) /
                    d3.sum(vis.data, d => (vis.xValue(d) - mx) ** 2);
        vis.intercept = my - vis.slope * mx;
        
        vis.x0 = d3.min(vis.data, vis.xValue);
        vis.x1 = d3.max(vis.data, vis.xValue);

        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        // Draw trend line
        vis.chart.selectAll('.trend-line')
            .data([1])
            .join('line')
                .attr('class', 'trend-line')
                .attr('x1', vis.xScale(vis.x0))
                .attr('y1', vis.yScale(vis.slope * vis.x0 + vis.intercept))
                .attr('x2', vis.xScale(vis.x1))
                .attr('y2', vis.yScale(vis.slope * vis.x1 + vis.intercept))
                .attr('stroke', '#f5a623')
                .attr('stroke-width', 1.5)
                .attr('stroke-dasharray', '5 4')
                .attr('opacity', 0.6);

        // Tooltip formatting function highlighting Net Balance
        const tooltipHtml = (d) => {
            const net = vis.yValue(d);
            const netColor = net >= 0 ? '#5b9cf6' : '#f5705b';
            const netSign = net >= 0 ? '+' : '';
            return `
                <div class="tt-title">${d.id}. ${d.name}</div>
                <div class="tt-row"><span class="tt-label">Avg rent</span><span class="tt-val">€${d.avg_price.toFixed(2)}/m²</span></div>
                <div class="tt-row"><span class="tt-label">Net Balance</span><span class="tt-val" style="color:${netColor}">${netSign}${net.toLocaleString()}</span></div>
            `;
        };

        // Draw scatter dots
        vis.dots = vis.chart.selectAll('.scatter-dot')
            .data(vis.data, d => d.id)
            .join('circle')
                .attr('class', 'scatter-dot')
                .attr('data-district', d => d.id)
                .attr('cx', d => vis.xScale(vis.xValue(d)))
                .attr('cy', d => vis.yScale(vis.yValue(d)))
                .attr('r', d => d.id === 1 ? 9 : 7)
                .attr('fill', d => d.id === 1 ? '#a855f7' : (vis.yValue(d) >= 0 ? '#5b9cf6' : '#f5705b'))
                .attr('fill-opacity', 0.8)
                .on('mouseover', (event, d) => {
                    vis.dispatcher.call('showTooltip', event, event, tooltipHtml(d));
                    vis.dispatcher.call('linkDistrict', event, d.id);
                })
                .on('mousemove', (event) => vis.dispatcher.call('moveTooltip', event, event))
                .on('mouseout', () => {
                    vis.dispatcher.call('hideTooltip');
                    vis.dispatcher.call('unlinkDistrict');
                });

        // Add static text labels for key districts (e.g., 1, 10, 22)
        const highlightIds = new Set([1, 10, 22]);
        vis.chart.selectAll('.dot-label')
            .data(vis.data.filter(d => highlightIds.has(d.id)), d => d.id)
            .join('text')
                .attr('class', 'dot-label')
                .attr('x', d => vis.xScale(vis.xValue(d)) + 11)
                .attr('y', d => vis.yScale(vis.yValue(d)) + 4)
                .attr('fill', '#e8e6df')
                .attr('font-size', '9px')
                .attr('font-family', 'Space Grotesk, sans-serif')
                .attr('pointer-events', 'none')
                .text(d => `${d.id}. ${d.name.split('-')[0].split('–')[0]}`);

        // Update Axes formatting
        vis.xAxisG.call(d3.axisBottom(vis.xScale).ticks(6).tickFormat(d => `€${d.toFixed(0)}`))
            .call(ax => { 
                ax.selectAll('text').attr('fill', '#7a7a8c').attr('font-size', '10px'); 
                ax.selectAll('line,path').attr('stroke', '#2a2b35'); 
            });

        // Format Y axis to show 'k' (thousands) and keep negative signs
        const formatY = d => {
            const val = Math.round(d / 1000);
            return val === 0 ? '0' : val + 'k';
        };

        vis.yAxisG.call(d3.axisLeft(vis.yScale).ticks(6).tickFormat(formatY))
            .call(ax => { 
                ax.selectAll('text').attr('fill', '#7a7a8c').attr('font-size', '10px'); 
                ax.selectAll('line,path').attr('stroke', '#2a2b35'); 
            });
    }

    // Method to trigger entrance animation when scrolled into view
    animateDots() {
        let vis = this;
        vis.dots.attr('r', 0)
            .transition().duration(600).delay((_, i) => i * 25)
            .attr('r', d => d.id === 1 ? 9 : 7);
    }
}