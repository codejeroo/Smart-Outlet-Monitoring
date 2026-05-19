import os
import sys

# Add the execution directory to sys.path so we can import the core runner
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "execution"))

from data_collection_runner import main

if __name__ == "__main__":
    main()
