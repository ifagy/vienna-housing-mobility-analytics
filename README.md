# Vienna: The True Cost of Your District

An interactive scrollytelling/data visualization project exploring the relationship between rent prices and commuting patterns across Vienna's 23 districts. This project aims to show flat seekers that the cheapest apartment is not always the best deal when factoring in commuting time and costs.

## Overview
This project uses a scrollytelling format to guide users through the data step by step, from a broad city overview to a personal conclusion. It highlights the hidden trade-offs of housing decisions by combining real estate prices with official commuter flows.

## Features
* **Price Map:** A choropleth map showing the average rent per square meter across districts.
* **Commuting Flow:** A butterfly chart comparing incoming workers versus outgoing residents for each district.
* **The Connection:** A scatter plot revealing the correlation between average rent and commuter influx.
* **Interactive Explorer:** A custom tool allowing users to set personal constraints (max rent, job opportunities, and maximum travel time) to highlight districts that practically match their lifestyle.

## Data Sources
* [Real Estate Prices in Vienna (Immopreise.at)](https://www.immopreise.at/Preisentwicklung)
* [Commuting Data for Vienna (data.gv.at)](https://www.data.gv.at/datasets/8dfd943f-6d86-497c-8566-1639a0b9884f?locale=de)

## Tech Stack
* Vanilla JavaScript (ES6 Modules)
* D3.js (v7)
* Scrollama.js
* HTML5 / CSS3

## Running Locally
Due to ES6 module imports and local data loading, this project requires a local web server to run correctly.

1. Clone the repository.
2. Start a local server in the root directory (e.g., `python -m http.server` or `npx serve`).
3. Open the provided localhost port in your browser.
