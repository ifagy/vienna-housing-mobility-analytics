import json

def calculate_average_of_minimums(filepath):
    print(f"Analyzing data from '{filepath}'...\n")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            districts = json.load(f)
    except Exception as e:
        print(f"File read error: {e}")
        return

    min_prices_list = []

    print(f"{'District Name':<22} | {'Lowest Price Across All Years'}")
    print("-" * 55)

    for d in districts:
        prices = d.get('price_ts', [])
        if not prices:
            continue

        # 1. Find the lowest historical price for this specific district
        min_price_for_district = min(p['price'] for p in prices)
        min_prices_list.append(min_price_for_district)

        print(f"{d['name']:<22} | €{min_price_for_district:.2f}/m²")

    # 2. Compute the arithmetic mean of all districts' minimum baseline values
    if min_prices_list:
        overall_avg_of_mins = sum(min_prices_list) / len(min_prices_list)
        
        print("-" * 55)
        print(f"Number of Districts Analyzed : {len(min_prices_list)}")
        print(f"Vienna Overall Baseline Rent Avg: €{overall_avg_of_mins:.2f}/m²")
    else:
        print("No sufficient data found for analysis.")

if __name__ == "__main__":
    # Adjust your file path here if necessary
    calculate_average_of_minimums('data/ddistricts_data.json')