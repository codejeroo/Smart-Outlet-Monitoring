import argparse
import json
from datetime import datetime

def main():
    parser = argparse.ArgumentParser(description="A simple ping test for the execution layer.")
    parser.add_argument("--name", type=str, default="World", help="Name to greet")
    args = parser.parse_args()

    result = {
        "status": "success",
        "message": f"Hello, {args.name}! The execution layer is active.",
        "timestamp": datetime.now().isoformat()
    }

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
