// js/utils/Tooltip.js

export default class Tooltip {
    constructor(_config) {
        this.config = {
            parentElement: _config.parentElement || '#tooltip',
            offsetX: _config.offsetX || 15,
            offsetY: _config.offsetY || 15,
            tooltipWidth: _config.tooltipWidth || 200,
            tooltipHeight: _config.tooltipHeight || 130
        };

        this.initTooltip();
    }

    /**
     * Initializes the tooltip selection using D3
     */
    initTooltip() {
        let vis = this;
        vis.tooltip = d3.select(vis.config.parentElement);
    }

    /**
     * Shows the tooltip and updates its content
     * @param {MouseEvent} event - The mouse event triggered by D3
     * @param {string} htmlContent - The raw HTML string to inject into the tooltip
     */
    show(event, htmlContent) {
        let vis = this;
        
        vis.tooltip
            .style('display', 'block')
            .html(htmlContent);
            
        // Immediately position it based on current mouse coordinates
        vis.move(event);
    }

    /**
     * Moves the tooltip dynamically tracking the cursor while performing boundary checks
     * @param {MouseEvent} event - The mouse event triggered by D3
     */
    move(event) {
        let vis = this;
        const x = event.clientX;
        const y = event.clientY;

        // Boundary check for horizontal axis (prevent tooltip from clipping off screen right)
        const left = x + vis.config.offsetX + vis.config.tooltipWidth > window.innerWidth 
            ? x - vis.config.tooltipWidth - vis.config.offsetX 
            : x + vis.config.offsetX;

        // Boundary check for vertical axis (prevent tooltip from clipping off screen bottom)
        const top = y + vis.config.offsetY + vis.config.tooltipHeight > window.innerHeight 
            ? y - vis.config.tooltipHeight 
            : y + vis.config.offsetY;

        // Apply calculated absolute positioning styles
        vis.tooltip
            .style('left', `${left}px`)
            .style('top', `${top}px`);
    }

    /**
     * Hides the tooltip element from the DOM view
     */
    hide() {
        let vis = this;
        vis.tooltip.style('display', 'none');
    }
}