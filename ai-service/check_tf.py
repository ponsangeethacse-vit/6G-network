try:
    import tensorflow as tf
    print("TF successfully installed. Version:", tf.__version__)
    exit(0)
except ImportError:
    print("TF not installed yet.")
    exit(1)
