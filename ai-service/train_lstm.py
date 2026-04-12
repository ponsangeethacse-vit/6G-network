import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
import os

def create_sequences(data, labels, seq_length=5):
    """
    Converts 2D tabular data into 3D time-series sequences required for LSTM.
    """
    X, y = [], []
    for i in range(len(data) - seq_length):
        X.append(data[i : i + seq_length])
        
        # We classify the sequence as an anomaly if the LAST step is an anomaly
        # Alternatively, could be if ANY step in the sequence is an anomaly
        y.append(labels[i + seq_length])
        
    return np.array(X), np.array(y)

def build_and_train_lstm():
    print("Loading preprocessed dataset...")
    data_path = os.path.join("data", "processed_dataset.csv")
    df = pd.read_csv(data_path)
    
    features = ['packet_rate', 'latency', 'bandwidth', 'failed_requests']
    feature_data = df[features].values
    label_data = df['label'].values
    
    # ---------------------------------------------------------
    # 1. EXPLAIN SEQUENCE LENGTH
    # ---------------------------------------------------------
    # Sequence Length (e.g., 5) means the LSTM looks at the last 5 network events
    # simultaneously to make a decision about the current state.
    # 
    # Example: If seq_length = 5
    # Sequence 1: [Traffic at t-4, Traffic at t-3, Traffic at t-2, Traffic at t-1, Traffic at t]
    #
    # While an Autoencoder looks at a snapshot in time (is THIS packet abnormal?),
    # an LSTM looks at temporal patterns (is this SEQUENCE of packets leading up to an attack?).
    # This helps detect slow DDoS attacks that don't spike simultaneously but grow over time.
    
    seq_length = 5
    print(f"Converting dataset into sequences of length {seq_length}...")
    X_seq, y_seq = create_sequences(feature_data, label_data, seq_length)
    
    print(f"Original Data Shape: {feature_data.shape}")
    print(f"Sequence Data Shape: {X_seq.shape}") # -> (samples, time_steps, features)
    
    # Split into train/validation (80/20)
    split_idx = int(len(X_seq) * 0.8)
    X_train, y_train = X_seq[:split_idx], y_seq[:split_idx]
    X_val, y_val = X_seq[split_idx:], y_seq[split_idx:]
    
    # ---------------------------------------------------------
    # 2. BUILD THE LSTM MODEL (TensorFlow/Keras)
    # ---------------------------------------------------------
    input_dim = len(features)
    
    model = Sequential([
        LSTM(16, input_shape=(seq_length, input_dim), return_sequences=False),
        Dropout(0.2), # Prevent overfitting
        Dense(8, activation='relu'),
        Dense(1, activation='sigmoid') # Outputs probability 0.0 - 1.0 (Attack Probability)
    ])
    
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    
    # ---------------------------------------------------------
    # 3. TRAIN THE LSTM
    # ---------------------------------------------------------
    print("Training LSTM for temporal anomaly detection...")
    model.fit(
        X_train, y_train,
        epochs=5,
        batch_size=32,
        validation_data=(X_val, y_val),
        verbose=1
    )
    
    # ---------------------------------------------------------
    # 4. SAVE MODEL (MODEL EXPORT)
    # ---------------------------------------------------------
    model_path = os.path.join("data", "lstm_model.h5")
    model.save(model_path)
    print(f"LSTM Model saved to: {model_path}")
    print("\n✅ Step 5: LSTM Implementation successfully completed.")

if __name__ == "__main__":
    build_and_train_lstm()
