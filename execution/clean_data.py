import os
import csv

def clean_dataset(file_path):
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' does not exist.")
        return

    print(f"Reading dataset from: {os.path.abspath(file_path)}")

    # Statistics counters
    total_original = 0
    removed_spikes = 0
    updated_to_active = 0
    updated_to_idle = 0
    unchanged = 0

    cleaned_rows = []
    headers = []

    # Determine active label based on the file name
    lower_path = os.path.basename(file_path).lower()
    if 'fan' in lower_path:
        active_label = 'fan'
    elif 'laptop' in lower_path:
        active_label = 'laptop'
    else:
        active_label = 'phone'

    with open(file_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        try:
            headers = next(reader)
        except StopIteration:
            print("Error: CSV file is empty.")
            return

        # Find column indices
        try:
            v_idx = headers.index('vrms')
            i_idx = headers.index('irms')
            p_idx = headers.index('realPower')
            pf_idx = headers.index('powerFactor')
            lbl_idx = headers.index('device_label')
        except ValueError as e:
            print(f"Error: Missing required column in CSV headers. {e}")
            return

        for row in reader:
            if not row:
                continue
            total_original += 1

            # Extract and parse telemetry values
            try:
                vrms = float(row[v_idx])
                irms = float(row[i_idx])
                real_power = float(row[p_idx])
                pf = float(row[pf_idx])
                original_label = row[lbl_idx].strip()
            except ValueError:
                # Skip invalid rows
                removed_spikes += 1
                continue

            # Identify big data voltage spikes
            # Outlier thresholds: vrms > 300V, or current > 10A, or power > 1000W
            if vrms > 300.0 or irms > 10.0 or real_power > 1000.0:
                removed_spikes += 1
                continue

            # Decide label based on active power/current draw
            is_active = real_power > 0.05 or irms > 0.005
            
            if is_active:
                new_label = active_label
                if original_label != active_label:
                    updated_to_active += 1
                else:
                    unchanged += 1
            else:
                new_label = 'Idle'
                if original_label != 'Idle':
                    updated_to_idle += 1
                else:
                    unchanged += 1

            # Build the cleaned row
            cleaned_row = list(row)
            cleaned_row[lbl_idx] = new_label
            cleaned_rows.append(cleaned_row)

    # Save the cleaned dataset back to the same file
    temp_file = file_path + ".tmp"
    with open(temp_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(cleaned_rows)

    os.replace(temp_file, file_path)

    # Print results summary
    print(f"================ DATA CLEANING SUMMARY: {os.path.basename(file_path)} ================")
    print(f"Total original data points:   {total_original}")
    print(f"Removed voltage spikes/errors: {removed_spikes}")
    print(f"Labels updated to '{active_label}':     {updated_to_active}")
    print(f"Labels updated to 'Idle':      {updated_to_idle}")
    print(f"Unchanged rows:                {unchanged}")
    print(f"Total cleaned data points:     {len(cleaned_rows)}")
    print("=======================================================================\n")

if __name__ == "__main__":
    # Clean all available telemetry files in the project root
    for filename in ["phone_result.csv", "Fan_result.csv", "Laptop_result.csv"]:
        if os.path.exists(filename):
            clean_dataset(filename)
