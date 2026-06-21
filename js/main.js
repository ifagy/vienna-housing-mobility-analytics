// js/main.js

import MapVis from './components/MapVis.js';
import ButterflyVis from './components/ButterflyVis.js';
import ScatterVis from './components/ScatterVis.js';
import ExplorerVis from './components/ExplorerVis.js';
import Tooltip from './utils/Tooltip.js';

// Global instances for components
let mapVis, butterflyVis, scatterVis, explorerVis, tooltip;
let dispatcher;

// Animation loop variables
let yearLoopInterval = null;
let loopDirection = 1;
let currentLoopYear = 2012;

/**
 * Main application initialization entry point
 */
function initApp() {
    // Verify that the embedded global data is loaded via index.html scripts
    if (typeof GEO_DATA === 'undefined' || typeof DISTRICTS_DATA === 'undefined') {
        console.error('Data not loaded. Make sure embedded_data.js is included before main.js.');
        return;
    }

    // Initialize the shared central interaction dispatcher
    initDispatcher();

    // Initialize the central tooltip helper
    tooltip = new Tooltip({ parentElement: '#tooltip' });

    // Instantiate visualization components with clean configuration objects
    mapVis = new MapVis({ parentElement: '#viz-map' }, DISTRICTS_DATA, GEO_DATA, dispatcher);
    butterflyVis = new ButterflyVis({ parentElement: '#viz-butterfly' }, DISTRICTS_DATA, dispatcher);
    scatterVis = new ScatterVis({ parentElement: '#viz-scatter' }, DISTRICTS_DATA, dispatcher);
    explorerVis = new ExplorerVis({ parentElement: '#explorer-map' }, DISTRICTS_DATA, GEO_DATA, dispatcher);

    // Bind UI inputs and triggers
    initEventListeners();
    initScrollama(); //for scorytelling
    initInterstitialReveal();
}

/**
 * Initializes D3 dispatchers to decouple cross-component interactions (Brushing & Linking)
 */
function initDispatcher() {
    dispatcher = d3.dispatch('showTooltip', 'moveTooltip', 'hideTooltip', 'linkDistrict', 'unlinkDistrict');

    // Tooltip event handlers forwarded to the central Tooltip instance
    dispatcher.on('showTooltip', (event, htmlContent) => {
        tooltip.show(event, htmlContent);
    });

    dispatcher.on('moveTooltip', (event) => {
        tooltip.move(event);
    });

    dispatcher.on('hideTooltip', () => {
        tooltip.hide();
    });

    // Brushing handler: Highlights the active district across all coordinated views
    dispatcher.on('linkDistrict', (id) => {
        // 1. Scrolly map path highlights
        d3.selectAll('.scrolly-map')
            .attr('opacity', f => f.properties && f.properties.BEZNR !== id ? 0.4 : 1) //hovered one highlighted
            .attr('stroke', f => f.properties && f.properties.BEZNR === id ? 'white' : null)
            .attr('stroke-width', f => f.properties && f.properties.BEZNR === id ? 2 : null);

        // 2. Butterfly chart bar highlights
        d3.selectAll('[data-district]')
            .style('opacity', function() { return +this.dataset.district === id ? 1 : 0.25; });

        // 3. Scatter plot dot highlights
        if (scatterVis && scatterVis.dots) {
            scatterVis.dots
                .attr('r', d => d.id === id ? 12 : (d.id === 1 ? 9 : 7))
                .attr('stroke', d => d.id === id ? 'white' : 'none')
                .attr('stroke-width', d => d.id === id ? 2 : 0);
        }
    });

    // Unbrushing handler: Resets configurations across views to normal states
    dispatcher.on('unlinkDistrict', () => {
        // Reset Map
        d3.selectAll('.scrolly-map').attr('opacity', 1).attr('stroke', null).attr('stroke-width', null);
        
        // Reset Butterfly
        d3.selectAll('[data-district]').style('opacity', 1);
        
        // Reset Scatter
        if (scatterVis && scatterVis.dots) {
            scatterVis.dots.attr('r', d => d.id === 1 ? 9 : 7).attr('stroke', 'none');
        }

        // Maintain the scroll step specific highlights if active
        const currentStep = d3.select('.step.is-active');
        if (!currentStep.empty()) {
            const activeIndex = +currentStep.attr('data-index');
            // Restore Map risers highlight if on step index 2
            if (activeIndex === 2) highlightRisers(true);
            // Restore Butterfly bedroom highlight if on step index 4
            if (activeIndex === 4) highlightBedroomDistricts(true);
        }
    });
}

/**
 * Attaches operational DOM listeners to controls outside individual chart components
 */
function initEventListeners() {
    // Year slider implementation updating MapVis dynamically
    const yearSlider = document.getElementById('map-year-slider');
    if (yearSlider) {
        yearSlider.addEventListener('input', function() {
            const selectedYear = +this.value;
            document.getElementById('map-year-label').textContent = selectedYear;
            mapVis.updateYear(selectedYear);
        });
    }

    // Sorting button events updating ButterflyVis dynamically
    document.querySelectorAll('.butterfly-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.butterfly-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            butterflyVis.changeSortMode(this.dataset.sort);
        });
    });

    // Range slider inputs updating ExplorerVis constraints dynamically
    const priceRange = document.getElementById('price-range');
    const jobsRange = document.getElementById('jobs-range');
    
    if (priceRange && jobsRange) {
        const triggerExplorerUpdate = () => {
            explorerVis.updateFilters(+priceRange.value, +jobsRange.value);
        };
        priceRange.addEventListener('input', triggerExplorerUpdate);
        jobsRange.addEventListener('input', triggerExplorerUpdate);
        
        // Execute initial filter baseline
        triggerExplorerUpdate();
    }
}

/**
 * Manages scrollytelling steps and coordinate panel swapping triggers using Scrollama
 */
function initScrollama() {
    const scroller = scrollama();
    
    d3.selectAll('.step').each(function(_, i) {
        d3.select(this).attr('data-index', i);
    });

    scroller.setup({ step: '.step', offset: 0.5 }) //after the half
        .onStepEnter(({ element, index }) => {
            // Manage active state classes across narrative step text containers
            document.querySelectorAll('.step').forEach(s => s.classList.remove('is-active'));
            element.classList.add('is-active');

            // Determine panel focus based on scroll story milestones
            const panelMap = { 
                0: 'panel-map', 1: 'panel-map', 2: 'panel-map', 
                3: 'panel-butterfly', 4: 'panel-butterfly', 
                5: 'panel-scatter' 
            };
            
            document.querySelectorAll('.viz-panel').forEach(p => p.classList.remove('active'));
            const targetPanel = document.getElementById(panelMap[index] || 'panel-map');
            if (targetPanel) targetPanel.classList.add('active');

            // Show slider wrapper on steps 1 and 2
            const sliderWrap = document.getElementById('year-slider-wrap');
            if (sliderWrap) sliderWrap.style.display = (index === 1 || index === 2) ? 'flex' : 'none';

            // DYNAMIC MODE SWITCHING based on current scroll index
            if (mapVis) {
                const isGlobal = (index === 0);
                
                // Toggle map internal state
                mapVis.setMode(isGlobal);
                mapVis.toggleOutlier(isGlobal);

                // Dynamically update the map's visual title in the DOM
                const mapTitle = document.querySelector('#panel-map .viz-title');
                if (mapTitle) {
                    mapTitle.textContent = isGlobal 
                        ? "Average rent per m² by district (€) — 2025" //title based on global or not
                        : "Relative rent affordability by district — Yearly Trend";
                }
            }

            // Highlight the top risers and manage the infinite loop (Step index 2)
            highlightRisers(index === 2);
            
            if (index === 2) {
                startYearLoop();
            } else {
                stopYearLoop();
            }

            // AUTOMATIC BUTTERFLY SORT & HIGHLIGHT (Step index 4)
            if (index === 4) {
                // Auto-sort butterfly chart to "Most out"
                if (butterflyVis) butterflyVis.changeSortMode('out');
                
                // Sync the UI buttons to show "Most out" as active
                document.querySelectorAll('.butterfly-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.sort === 'out');
                });
                
                highlightBedroomDistricts(true);
            } 
            // Revert back to default "Balance" if user scrolls up to intro butterfly step
            else if (index === 3) {
                if (butterflyVis) butterflyVis.changeSortMode('balance');
                
                document.querySelectorAll('.butterfly-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.sort === 'balance');
                });
                
                highlightBedroomDistricts(false);
            } 
            else {
                highlightBedroomDistricts(false);
            }

            // Trigger scatter plot entry animation
            if (index === 5 && scatterVis) {
                scatterVis.animateDots();
            }
        });

    window.addEventListener('resize', scroller.resize);
}

/**
 * Highlights structural bedroom/fast-rising districts (10. Favoriten & 21. Floridsdorf) on the map step
 * @param {boolean} active - Flag stating if highlighting state needs execution or restoration
 */
function highlightRisers(active) {
    if (!mapVis || !mapVis.mapG) return;
    
    // Targeting Brigittenau (20) and Neubau (7) based on data analysis
    const risers = new Set([20, 7]); 
    
    if (active) { //chapter 2 -> active = true
        mapVis.mapG.selectAll('.scrolly-map')
            .attr('opacity', f => risers.has(f.properties.BEZNR) ? 1 : 0.25)
            .attr('stroke', f => risers.has(f.properties.BEZNR) ? '#4ecb8d' : null)
            .attr('stroke-width', f => risers.has(f.properties.BEZNR) ? 2.5 : null);
    } else {
        mapVis.mapG.selectAll('.scrolly-map')
            .attr('opacity', 1).attr('stroke', null).attr('stroke-width', null);
    }
}

/**
 * Highlights specific bedroom communities (10, 21, 22) on the butterfly chart step
 * @param {boolean} active - Flag stating if highlighting state needs execution or restoration
 */
function highlightBedroomDistricts(active) {
    // 10: Favoriten, 21: Floridsdorf, 22: Donaustadt
    const bedrooms = new Set([10, 21, 22]); 
    
    if (active) {
        d3.selectAll('[data-district]')
            .style('opacity', function() {
                const id = +this.dataset.district; //transform to integer
                return bedrooms.has(id) ? 1 : 0.25;
            });
    } else {
        d3.selectAll('[data-district]').style('opacity', 1);
    }
}

/**
 * Sets up intersection checks for revealing the 'Favoriten' standalone paragraph smoothly
 */
function initInterstitialReveal() {
    const revealElement = document.querySelector('.of-reveal');
    if (!revealElement) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                revealElement.classList.add('revealed');
                observer.disconnect();
            }
        });
    }, { threshold: 0.4 }); //threshold
    
    observer.observe(revealElement);
}

/**
 * Starts an infinite ping-pong animation of the year slider (2012 -> 2025 -> 2012)
 */
function startYearLoop() {
    if (yearLoopInterval) clearInterval(yearLoopInterval);
    
    const slider = document.getElementById('map-year-slider');
    const label = document.getElementById('map-year-label');
    
    currentLoopYear = 2012; // Start from beginning for dramatic effect
    loopDirection = 13;
    
    yearLoopInterval = setInterval(() => {
        currentLoopYear += loopDirection;
        
        // Reverse direction at the boundaries
        if (currentLoopYear >= 2025) {
            currentLoopYear = 2025;
            loopDirection = -13; 
        } else if (currentLoopYear <= 2012) {
            currentLoopYear = 2012;
            loopDirection = 13; 
        }
        
        // Sync UI and Map Vis
        if (slider) slider.value = currentLoopYear;
        if (label) label.textContent = currentLoopYear;
        if (mapVis) mapVis.updateYear(currentLoopYear);
        
    }, 1000); // 1000ms per year jump
}

/**
 * Stops the year animation loop
 */
function stopYearLoop() {
    if (yearLoopInterval) {
        clearInterval(yearLoopInterval);
        yearLoopInterval = null;
    }
}

// Coordinate window loaded checks to safely bootstrap scripts
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}