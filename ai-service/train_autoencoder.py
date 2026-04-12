import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, Dense
import os
import json

def build_and_train_autoencoder():
    print("Loading preprocessed dataset...")
    data_path = os.path.join("data", "processed_dataset.csv")
    df = pd.read_csv(data_path)
    
    features = ['packet_rate', 'latency', 'bandwidth', 'failed_requests']
    
    # ---------------------------------------------------------
    # 1. TRAIN ONLY ON NORMAL (BENIGN) DATA
    # ---------------------------------------------------------
    # An Autoencoder learns to perfectly reconstruct normal data.
    # If we feed it attack data later, it will fail to reconstruct it well,
    # giving us a high "Reconstruction Error," which we use as our Anomaly Score!
    
    # Filter only Benign data (label == 0) for training
    train_df = df[df['label'] == 0]
    X_train = train_df[features].values
    
    print(f"Training Autoencoder on {len(X_train)} BENIGN samples...")
    
    # ---------------------------------------------------------
    # 2. BUILD A SIMPLE AUTOENCODER (TensorFlow/Keras)
    # ---------------------------------------------------------
    input_dim = len(features)
    
    input_layer = Input(shape=(input_dim,))
    # Encoder
    encoded = Dense(8, activation='relu')(input_layer)
    encoded = Dense(2, activation='relu')(encoded) # Bottleneck layer
    # Decoder
    decoded = Dense(8, activation='relu')(encoded)
    output_layer = Dense(input_dim, activation='linear')(decoded)
    
    autoencoder = Model(inputs=input_layer, outputs=output_layer)
    autoencoder.compile(optimizer='adam', loss='mse')
    
    # ---------------------------------------------------------
    # 3. TRAIN THE MODEL
    # ---------------------------------------------------------
    autoencoder.fit(
        X_train, X_train,
        epochs=10,
        batch_size=32,
        validation_split=0.1,
        shuffle=True,
        verbose=1
    )
    
    # ---------------------------------------------------------
    # 4. EXPLAIN RECONSTRUCTION ERROR & SET THRESHOLD
    # ---------------------------------------------------------
    # Let's see how much error the model makes on normal data.
    X_train_pred = autoencoder.predict(X_train)
    # MSE across features
    train_mae_loss = np.mean(np.abs(X_train_pred - X_train), axis=1)
    
    # We set our threshold to the 99th percentile of normal error.
    # Anything strictly above this error will be flagged as an Anomaly!
    threshold = np.percentile(train_mae_loss, 99)
    print(f"\n--- ANOMALY DETECTION THRESHOLD ---")
    print(f"Reconstruction Error Threshold set to: {threshold:.4f}")
    
    # ---------------------------------------------------------
    # 5. SAVE MODEL & THRESHOLD TO DISK (MODEL EXPORT)
    # ---------------------------------------------------------
    model_path = os.path.join("data", "autoencoder.h5")
    autoencoder.save(model_path)
    print(f"Model saved to: {model_path}")
    
    # Save the threshold so FastAPI can load it later
    threshold_path = os.path.join("data", "autoencoder_threshold.json")
    with open(threshold_path, 'w') as f:
        json.dump({"threshold": threshold}, f)
        
    print("\n✅ Step 4: Autoencoder Implementation successfully completed.")

if __name__ == "__main__":
    build_and_train_autoencoder()
