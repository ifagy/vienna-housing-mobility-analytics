// js/components/ButterflyVis.js

export default class ButterflyVis {
    constructor(_config, _data, _dispatcher) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 520,
            containerHeight: _config.containerHeight || 460,
            margin: _config.margin || { top: 20, right: 60, bottom: 30, left: 30 }
        };
        
        this.data = _data;
        this.dispatcher = _dispatcher;
        this.sortMode = 'balance'; // Default sort mode ('in', 'out', or 'balance')

        this.initVis();
    }

    initVis() {
        let vis = this;

        // Calculate inner dimensions
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;
        vis.midX = vis.width / 2;

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

        // Initialize scales
        vis.xL = d3.scaleLinear().range([vis.midX, 0]);
        vis.xR = d3.scaleLinear().range([vis.midX, vis.width]);
        vis.yScale = d3.scaleBand().range([0, vis.height]).padding(0.15);

        // Draw center dividing line
        vis.chart.append('line')
            .attr('x1', vis.midX).attr('x2', vis.midX)
            .attr('y1', 0).attr('y2', vis.height)
            .attr('stroke', '#2a2b35')
            .attr('stroke-width', 1);

        // Column headers (static positions, dynamic styling will be in renderVis)
        vis.headerLeft = vis.svg.append('text')
            .attr('x', vis.config.margin.left + vis.width / 4)
            .attr('y', 13)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('font-family', 'Space Grotesk, sans-serif')
            .text('← Working here (in)');

        vis.headerRight = vis.svg.append('text')
            .attr('x', vis.config.margin.left + vis.width * 3 / 4)
            .attr('y', 13)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('font-family', 'Space Grotesk, sans-serif')
            .text('Living here, working out →');

        // Axis groups
        vis.xAxisLeftG = vis.chart.append('g')
            .attr('class', 'axis x-axis-left')
            .attr('transform', `translate(0,${vis.height})`);
            
        vis.xAxisRightG = vis.chart.append('g')
            .attr('class', 'axis x-axis-right')
            .attr('transform', `translate(0,${vis.height})`);

        vis.updateVis();
    }

    updateVis() {
        let vis = this;

        // Format and copy data for sorting to prevent mutating the original global dataset
        vis.displayData = vis.data.map(d => ({
            id: d.id, 
            name: d.name,
            inC: d.in_commuters, 
            outC: d.out_commuters
        }));

        // Apply sorting based on the current sortMode
        if (vis.sortMode === 'in') {
            vis.displayData.sort((a, b) => b.inC - a.inC);
        } else if (vis.sortMode === 'out') {
            vis.displayData.sort((a, b) => b.outC - a.outC);
        } else { 
            // Default: balance (net commuters)
            vis.displayData.sort((a, b) => (b.inC - b.outC) - (a.inC - a.outC));
        }

        // Update scale domains
        const maxVal = d3.max(vis.displayData, d => Math.max(d.inC, d.outC));
        vis.xL.domain([0, maxVal]);
        vis.xR.domain([0, maxVal]);
        vis.yScale.domain(vis.displayData.map(d => d.id));

        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        const inActive = vis.sortMode === 'in';
        const outActive = vis.sortMode === 'out';

        const t = vis.chart.transition().duration(1000);

        // Update header styling based on active sort mode
        vis.headerLeft
            .attr('fill', inActive ? '#8fc0ff' : '#5b9cf6')
            .attr('font-weight', inActive ? '700' : '600');
            
        vis.headerRight
            .attr('fill', outActive ? '#ffa494' : '#f5705b')
            .attr('font-weight', outActive ? '700' : '600');

        // Tooltip formatting function
        const tooltipHtml = (d) => `
            <div class="tt-title">${d.id}. ${d.name}</div>
            <div class="tt-row"><span class="tt-label">Working here (in)</span><span class="tt-val" style="color:#5b9cf6">${d.inC.toLocaleString()}</span></div>
            <div class="tt-row"><span class="tt-label">Living here, working out</span><span class="tt-val" style="color:#f5705b">${d.outC.toLocaleString()}</span></div>
            <div class="tt-row"><span class="tt-label">Net balance</span><span class="tt-val">${(d.inC - d.outC).toLocaleString()}</span></div>
        `;

        // Draw left bars (In-commuters) using the Enter-Update-Exit pattern with transitions
        vis.chart.selectAll('.bar-in')
            .data(vis.displayData, d => d.id)
            .join(
                enter => enter.append('rect')
                    .attr('class', 'bar-in')
                    .attr('data-district', d => d.id)
                    .attr('fill', '#5b9cf6')
                    .attr('rx', 1)
                    .attr('x', vis.midX) // Start animation from center
                    .attr('y', d => vis.yScale(d.id))
                    .attr('width', 0)
                    .attr('height', vis.yScale.bandwidth())
                    .attr('opacity', outActive ? 0.45 : 1)
                    .on('mouseover', (event, d) => {
                        vis.dispatcher.call('showTooltip', event, event, tooltipHtml(d));
                        vis.dispatcher.call('linkDistrict', event, d.id);
                    })
                    .on('mousemove', (event) => vis.dispatcher.call('moveTooltip', event, event))
                    .on('mouseout', () => {
                        vis.dispatcher.call('hideTooltip');
                        vis.dispatcher.call('unlinkDistrict');
                    })
                    .call(enter => enter.transition(t)
                        .attr('x', d => vis.xL(d.inC))
                        .attr('width', d => vis.midX - vis.xL(d.inC))
                    ),
                update => update
                    .call(update => update.transition(t)
                        .attr('y', d => vis.yScale(d.id)) // Smoothly slide to new vertical position
                        .attr('x', d => vis.xL(d.inC))
                        .attr('width', d => vis.midX - vis.xL(d.inC))
                        .attr('height', vis.yScale.bandwidth())
                        .attr('opacity', outActive ? 0.45 : 1)
                    ),
                exit => exit
                    .call(exit => exit.transition(t)
                        .attr('x', vis.midX)
                        .attr('width', 0)
                        .remove()
                    )
            );

        // Draw right bars (Out-commuters) using the Enter-Update-Exit pattern
        vis.chart.selectAll('.bar-out')
            .data(vis.displayData, d => d.id)
            .join(
                enter => enter.append('rect')
                    .attr('class', 'bar-out')
                    .attr('data-district', d => d.id)
                    .attr('fill', '#f5705b')
                    .attr('rx', 1)
                    .attr('x', vis.midX)
                    .attr('y', d => vis.yScale(d.id))
                    .attr('width', 0) // Start width at 0 for entrance
                    .attr('height', vis.yScale.bandwidth())
                    .attr('opacity', inActive ? 0.45 : 1)
                    .on('mouseover', (event, d) => {
                        vis.dispatcher.call('showTooltip', event, event, tooltipHtml(d));
                        vis.dispatcher.call('linkDistrict', event, d.id);
                    })
                    .on('mousemove', (event) => vis.dispatcher.call('moveTooltip', event, event))
                    .on('mouseout', () => {
                        vis.dispatcher.call('hideTooltip');
                        vis.dispatcher.call('unlinkDistrict');
                    })
                    .call(enter => enter.transition(t)
                        .attr('width', d => vis.xR(d.outC) - vis.midX)
                    ),
                update => update
                    .call(update => update.transition(t)
                        .attr('y', d => vis.yScale(d.id))
                        .attr('width', d => vis.xR(d.outC) - vis.midX)
                        .attr('height', vis.yScale.bandwidth())
                        .attr('opacity', inActive ? 0.45 : 1)
                    ),
                exit => exit
                    .call(exit => exit.transition(t)
                        .attr('width', 0)
                        .remove()
                    )
            );

        // Draw center labels (District IDs) and transition their positions
        vis.chart.selectAll('.y-label')
            .data(vis.displayData, d => d.id)
            .join(
                enter => enter.append('text')
                    .attr('class', 'y-label')
                    .attr('x', vis.midX)
                    .attr('y', d => vis.yScale(d.id) + vis.yScale.bandwidth() / 2 + 3)
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#ffffff')
                    .attr('font-size', '8px')
                    .attr('font-weight', '700')
                    .attr('font-family', 'Space Grotesk, sans-serif')
                    .attr('paint-order', 'stroke')
                    .attr('stroke', '#181920')
                    .attr('stroke-width', '2px')
                    .attr('stroke-linejoin', 'round')
                    .attr('pointer-events', 'none')
                    .text(d => d.id)
                    .style('opacity', 0)
                    .call(enter => enter.transition(t).style('opacity', 1)),
                update => update
                    .call(update => update.transition(t)
                        .attr('y', d => vis.yScale(d.id) + vis.yScale.bandwidth() / 2 + 3)
                    ),
                exit => exit
                    .call(exit => exit.transition(t)
                        .style('opacity', 0)
                        .remove()
                    )
            );

        // Update Axes
        const tickFormat = d => d >= 1000 ? Math.round(d / 1000) + 'k' : d;
        const ticks = vis.xL.ticks(4);

        vis.xAxisLeftG.call(d3.axisBottom(vis.xL).tickValues(ticks).tickFormat(tickFormat))
            .call(ax => { 
                ax.select('.domain').remove(); 
                ax.selectAll('text').attr('fill', '#7a7a8c').attr('font-size', '9px'); 
                ax.selectAll('line').attr('stroke', '#2a2b35'); 
            });

        vis.xAxisRightG.call(d3.axisBottom(vis.xR).tickValues(ticks).tickFormat(tickFormat))
            .call(ax => { 
                ax.select('.domain').remove(); 
                ax.selectAll('text').attr('fill', '#7a7a8c').attr('font-size', '9px'); 
                ax.selectAll('line').attr('stroke', '#2a2b35'); 
            });
    }

    // External method to handle sort button clicks
    changeSortMode(newMode) {
        this.sortMode = newMode;
        this.updateVis();
    }
}