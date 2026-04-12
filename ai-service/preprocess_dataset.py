import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
import os
import pickle

def preprocess_and_map_dataset(input_csv_path, output_csv_path):
    print(f"Loading dataset from: {input_csv_path}")
    # Read dataset, stripping whitespace from column names just in case
    df = pd.read_csv(input_csv_path)
    df.columns = df.columns.str.strip()
    
    # 3. FEATURE MAPPING AND FEATURE SELECTION
    print("Selecting and mapping relevant features...")
    # Mapping CICIDS2017 columns to 6G Network format
    feature_mapping = {
        'Flow Packets/s': 'packet_rate',
        'Flow IAT Mean': 'latency',
        'Flow Bytes/s': 'bandwidth',
        'RST Flag Count': 'failed_requests',
        'Label': 'label'
    }
    
    # Keep only the columns we need
    required_cols = list(feature_mapping.keys())
    
    # Ensure all required columns exist (handling potential typos in standard CSV)
    for col in required_cols:
        if col not in df.columns:
            # Attempt case-insensitive or partial match if exact match fails
            matching_cols = [c for c in df.columns if col.lower() in c.lower()]
            if matching_cols:
                print(f"Warning: '{col}' not found. Using '{matching_cols[0]}' instead.")
                feature_mapping[matching_cols[0]] = feature_mapping.pop(col)
            else:
                raise ValueError(f"Column '{col}' not found in the dataset.")

    df = df[list(feature_mapping.keys())]
    df = df.rename(columns=feature_mapping)
    
    # 2. DATA PREPROCESSING
    print("Handling missing and infinity values...")
    # Convert obvious infinity/NaN values to pandas NaN
    df = df.replace([np.inf, -np.inf], np.nan)
    
    # Drop rows with missing values (alternatively, we could fill them)
    df = df.dropna()
    print(f"Rows after dropping missing/infinity values: {len(df)}")
    
    # Handling outliers (capping at 99th percentile to prevent extreme anomalies from skewing scaler)
    numerical_cols = ['packet_rate', 'latency', 'bandwidth', 'failed_requests']
    for col in numerical_cols:
        upper_limit = df[col].quantile(0.99)
        df[col] = np.where(df[col] > upper_limit, upper_limit, df[col])
        
    print("Converting labels...")
    # Convert Labels: BENIGN -> 0, Any Attack -> 1
    # Ensure it's string type first
    df['label'] = df['label'].astype(str).str.strip().str.upper()
    df['label'] = df['label'].apply(lambda x: 0 if x == 'BENIGN' else 1)
    
    print(f"Attack samples: {sum(df['label'] == 1)}, Benign samples: {sum(df['label'] == 0)}")
    
    print("Normalizing data using MinMaxScaler...")
    scaler = MinMaxScaler()
    df[numerical_cols] = scaler.fit_transform(df[numerical_cols])
    
    # Save the processed dataset
    print(f"Saving cleaned dataset to: {output_csv_path}")
    os.makedirs(os.path.dirname(output_csv_path), exist_ok=True)
    df.to_csv(output_csv_path, index=False)
    
    # Save the scaler so we can use it in FastAPI for live input scaling
    scaler_path = os.path.join(os.path.dirname(output_csv_path), 'scaler.pkl')
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
    print(f"Saved MinMaxScaler to: {scaler_path}")
    
    return df

if __name__ == "__main__":
    # Define paths
    input_file = r"d:\Games\Project\ponsangeetha mam project 6gnetwork\6G-network\MachineLearningCVE\Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv"
    output_file = r"d:\Games\Project\ponsangeetha mam project 6gnetwork\6G-network\ai-service\data\processed_dataset.csv"
    
    preprocess_and_map_dataset(input_file, output_file)
    print("Step 2 and 3 Preprocessing Complete.")
