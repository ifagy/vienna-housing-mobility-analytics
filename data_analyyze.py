import json
import math
from scipy.stats import spearmanr

def get_net_balance_value(district, year):
    """
    Calculates the Net Balance (In - Out) value for a specified year.
    If the year is 2024 or 2025, it returns the historical average net balance 
    calculated from the 2009-2023 dataset.
    """
    ts_key = "commute_ts"
    
    if ts_key in district and isinstance(district[ts_key], list):
        # 1. If direct data exists for the year (between 2009 and 2023)
        record = next((item for item in district[ts_key] if item.get('year') == year), None)
        if record and 'in' in record and 'out' in record:
            return record['in'] - record['out']
            
        # 2. Extrapolation for 2024 and 2025 using the historical average
        if year in [2024, 2025]:
            historical_balances = [
                (item['in'] - item['out']) 
                for item in district[ts_key] 
                if 2009 <= item.get('year', 0) <= 2023 and 'in' in item and 'out' in item
            ]
            if historical_balances:
                return sum(historical_balances) / len(historical_balances)
                
    return None

def analyze_net_balance_significance(filepath):
    print(f"=== [{filepath}] Rent ↔ Net Balance Spatial Analysis ===")
    print("Note: Years 2024 and 2025 are simulated using the 2009-2023 average.\n")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            districts = json.load(f)
    except FileNotFoundError:
        print(f"Error: The file '{filepath}' could not be found.")
        return
    except Exception as e:
        print(f"File read error: {e}")
        return

    # Extract years where rent price data is available (2012 - 2025)
    years = set()
    for d in districts:
        for p in d.get('price_ts', []):
            years.add(p['year'])
            
    sorted_years = sorted(list(years))
    
    print(f"{'Year':<5} | {'Obs (n)':<8} | {'Net Balance (ρ)':<17} | {'p-value':<10} | {'Statistical Significance'}")
    print("-" * 75)

    for year in sorted_years:
        rents = []
        net_balances = []
        
        for d in districts:
            # Find the rent price record for the specific year
            price_record = next((p for p in d.get('price_ts', []) if p['year'] == year), None)
            
            if price_record:
                # Retrieve the true or simulated net balance value
                net_val = get_net_balance_value(d, year)
                
                if net_val is not None:
                    rents.append(price_record['price'])
                    net_balances.append(net_val)
        
        n = len(rents)
        if n > 2:
            # Calculate Spearman Rank Correlation and exact p-value via SciPy
            rho, p_val = spearmanr(rents, net_balances)
            
            # Significance interpretation (Academic standard: alpha = 0.05)
            if p_val < 0.01:
                status = "Highly Significant (p<0.01)"
            elif p_val < 0.05:
                status = "Significant (p<0.05)"
            elif p_val < 0.10:
                status = "Marginal/Trend (p<0.10)"
            else:
                status = "Not Significant"
                
            print(f"{year:<5} | {n:<8} | {rho:>15.4f}  | {p_val:<10.4f} | {status}")
        else:
            print(f"{year:<5} | Not enough matching data points.")

if __name__ == "__main__":
    # Adjust your file path here if necessary
    analyze_net_balance_significance('data/ddistricts_data.json')