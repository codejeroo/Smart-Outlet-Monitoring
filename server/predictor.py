import os
import json

class LightweightRF:
    def __init__(self, model_path=None):
        if model_path is None:
            # Default to model.json in the same directory as this file
            model_path = os.path.join(os.path.dirname(__file__), "model.json")
            
        self.model_path = model_path
        self._last_mtime = 0
        self._load_model()

    def _load_model(self):
        """Load or reload the model from disk."""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model file not found at: {self.model_path}")
            
        with open(self.model_path, 'r', encoding='utf-8') as f:
            model_data = json.load(f)
            
        self.classes = model_data["classes"]
        self.features = model_data["features"]
        self.trees = model_data["trees"]
        self._last_mtime = os.path.getmtime(self.model_path)
        print(f"[MODEL] Loaded model.json with classes: {self.classes} ({len(self.trees)} trees)")

    def _check_reload(self):
        """Hot-reload model.json if it has been modified since last load."""
        try:
            current_mtime = os.path.getmtime(self.model_path)
            if current_mtime > self._last_mtime:
                print("[MODEL] model.json changed on disk — hot-reloading...")
                self._load_model()
        except Exception:
            pass  # If file check fails, just use the cached model

    def _predict_tree_node(self, node, features):
        if node["type"] == "leaf":
            return node["value"]
        
        val = features[node["feature_idx"]]
        if val <= node["threshold"]:
            return self._predict_tree_node(node["left"], features)
        else:
            return self._predict_tree_node(node["right"], features)

    def predict_proba(self, vrms: float, irms: float, real_power: float, power_factor: float):
        """Calculates probability distribution over the classes."""
        self._check_reload()
        features = [vrms, irms, real_power, power_factor]
        total_counts = [0.0] * len(self.classes)
        
        for tree in self.trees:
            node_counts = self._predict_tree_node(tree, features)
            sum_counts = sum(node_counts)
            if sum_counts > 0:
                prob = [c / sum_counts for c in node_counts]
            else:
                prob = [1.0 / len(self.classes)] * len(self.classes)
            for idx, p in enumerate(prob):
                total_counts[idx] += p
                
        # Average probability across all trees
        return [tc / len(self.trees) for tc in total_counts]

    def predict(self, vrms: float, irms: float, real_power: float, power_factor: float) -> str:
        """Predicts the active device class ('Idle', 'phone', 'fan', 'laptop')."""
        probs = self.predict_proba(vrms, irms, real_power, power_factor)
        max_idx = probs.index(max(probs))
        return self.classes[max_idx]

