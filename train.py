import os
import csv
import random
import json
import math
from datetime import datetime

# --- PURE PYTHON DECISION TREE & RANDOM FOREST IMPLEMENTATION ---

class DecisionTree:
    def __init__(self, max_depth=5, min_samples_split=2, n_features_split=None):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.n_features_split = n_features_split
        self.tree = None

    def gini_impurity(self, groups, classes):
        # Calculate Gini impurity of a split
        total_samples = sum(len(group) for group in groups)
        if total_samples == 0:
            return 0.0
        
        gini = 0.0
        for group in groups:
            size = len(group)
            if size == 0:
                continue
            
            # Count class frequencies
            class_counts = {}
            for row in group:
                lbl = row[-1]
                class_counts[lbl] = class_counts.get(lbl, 0) + 1
            
            score = 0.0
            for lbl in classes:
                p = class_counts.get(lbl, 0) / size
                score += p * p
            
            gini += (1.0 - score) * (size / total_samples)
        return gini

    def test_split(self, index, value, dataset):
        # Split a dataset based on an attribute and an attribute value
        left, right = [], []
        for row in dataset:
            if row[index] <= value:
                left.append(row)
            else:
                right.append(row)
        return left, right

    def get_best_split(self, dataset):
        # Find the best split point for a dataset using Gini impurity
        classes = list(set(row[-1] for row in dataset))
        best_index, best_value, best_score, best_groups = 999, 999, 999, None
        
        # Determine number of features to consider
        n_features = len(dataset[0]) - 1
        features_indices = list(range(n_features))
        if self.n_features_split is not None:
            # Feature bagging: randomly sample a subset of features at each node split
            features_indices = random.sample(features_indices, min(self.n_features_split, n_features))
        
        for index in features_indices:
            # Extract unique values for this feature to test as split points
            values = set(row[index] for row in dataset)
            for value in values:
                groups = self.test_split(index, value, dataset)
                gini = self.gini_impurity(groups, classes)
                if gini < best_score:
                    best_index, best_value, best_score, best_groups = index, value, gini, groups
                    
        return {'index': best_index, 'value': best_value, 'groups': best_groups}

    def to_terminal(self, group):
        # Create a terminal (leaf) node value containing class counts
        classes = list(set(row[-1] for row in group))
        # We store the frequency count of each class in the leaf
        counts = {}
        for row in group:
            lbl = row[-1]
            counts[lbl] = counts.get(lbl, 0) + 1
        return counts

    def split_node(self, node, depth):
        left, right = node['groups']
        del(node['groups'])
        
        # Check for empty children
        if not left or not right:
            node['left'] = node['right'] = self.to_terminal(left + right)
            return
        
        # Check for max depth
        if depth >= self.max_depth:
            node['left'], node['right'] = self.to_terminal(left), self.to_terminal(right)
            return
            
        # Process left child
        if len(left) <= self.min_samples_split:
            node['left'] = self.to_terminal(left)
        else:
            node['left'] = self.get_best_split(left)
            self.split_node(node['left'], depth + 1)
            
        # Process right child
        if len(right) <= self.min_samples_split:
            node['right'] = self.to_terminal(right)
        else:
            node['right'] = self.get_best_split(right)
            self.split_node(node['right'], depth + 1)

    def fit(self, dataset):
        self.tree = self.get_best_split(dataset)
        self.split_node(self.tree, 1)
        return self

    def _serialize_node(self, node, classes):
        if 'left' not in node:  # Leaf node
            # Create standard count array corresponding to order of classes
            val_array = [node.get(c, 0.0) for c in classes]
            return {"type": "leaf", "value": val_array}
        else:
            return {
                "type": "split",
                "feature_idx": int(node['index']),
                "threshold": float(node['value']),
                "left": self._serialize_node(node['left'], classes),
                "right": self._serialize_node(node['right'], classes)
            }

    def serialize(self, classes):
        return self._serialize_node(self.tree, classes)


class RandomForest:
    def __init__(self, n_estimators=10, max_depth=5, min_samples_split=2):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.trees = []
        self.classes = []

    def get_bootstrap_sample(self, dataset):
        # Random sampling with replacement
        n_samples = len(dataset)
        sample = [random.choice(dataset) for _ in range(n_samples)]
        return sample

    def fit(self, dataset):
        self.classes = sorted(list(set(row[-1] for row in dataset)))
        self.trees = []
        
        # Use all features for splits to prevent dropping highly deterministic features (like realPower)
        # This turns the Random Forest into a Bagged Decision Trees ensemble, eliminating powerFactor overlap bias.
        n_features = len(dataset[0]) - 1
        n_features_split = n_features
            
        print(f"Training Random Forest with {self.n_estimators} trees (max_depth={self.max_depth}, feature_subset_size={n_features_split})...")
        
        for i in range(self.n_estimators):
            bootstrap = self.get_bootstrap_sample(dataset)
            tree = DecisionTree(
                max_depth=self.max_depth,
                min_samples_split=self.min_samples_split,
                n_features_split=n_features_split
            )
            tree.fit(bootstrap)
            self.trees.append(tree)
            if (i + 1) % 5 == 0 or (i + 1) == self.n_estimators:
                print(f"  Tree {i+1}/{self.n_estimators} trained.")
        return self

    def _predict_tree_node(self, node, row):
        if node["type"] == "leaf":
            return node["value"]
        
        val = row[node["feature_idx"]]
        if val <= node["threshold"]:
            return self._predict_tree_node(node["left"], row)
        else:
            return self._predict_tree_node(node["right"], row)

    def predict_proba(self, row, serialized_trees):
        # Predict class probabilities for a single row
        total_counts = [0.0] * len(self.classes)
        for tree_json in serialized_trees:
            node_counts = self._predict_tree_node(tree_json, row)
            sum_counts = sum(node_counts)
            if sum_counts > 0:
                prob = [c / sum_counts for c in node_counts]
            else:
                prob = [1.0 / len(self.classes)] * len(self.classes)
            for idx, p in enumerate(prob):
                total_counts[idx] += p
                
        # Normalize by number of trees
        return [tc / len(serialized_trees) for tc in total_counts]

    def predict(self, row, serialized_trees):
        probs = self.predict_proba(row, serialized_trees)
        max_idx = probs.index(max(probs))
        return self.classes[max_idx]

    def export_json(self):
        return {
            "classes": self.classes,
            "features": ["vrms", "irms", "realPower", "powerFactor"],
            "trees": [tree.serialize(self.classes) for tree in self.trees]
        }


# --- DATA UTILITIES & SYNTHETIC DATA GENERATION ---

def load_csv_data(file_path):
    print(f"Loading data from: {file_path}")
    dataset = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        headers = next(reader)
        
        # Get column indices
        v_idx = headers.index('vrms')
        i_idx = headers.index('irms')
        p_idx = headers.index('realPower')
        pf_idx = headers.index('powerFactor')
        lbl_idx = headers.index('device_label')
        
        for row in reader:
            if not row:
                continue
            try:
                v = float(row[v_idx])
                i = float(row[i_idx])
                p = float(row[p_idx])
                pf = float(row[pf_idx])
                label = row[lbl_idx].strip()
                
                # Simple outlier check (physical spikes)
                if v > 300.0 or i > 10.0 or p > 1000.0:
                    continue
                    
                dataset.append([v, i, p, pf, label])
            except ValueError:
                continue # skip bad parsed rows
    return dataset

def generate_synthetic_other_devices(num_samples=200):
    # Generates synthetic data representing various household appliances that are NOT phone chargers
    # Features: [vrms, irms, realPower, powerFactor, 'other']
    synthetic = []
    
    # We will simulate three popular appliance profiles:
    # 1. Medium Resistive loads (e.g. Incandescent/LED lamps, iron): high power factor, medium power
    # 2. Inductive/capacitive loads (e.g. Desk Fan, small air purifier, motor): lower power factor, medium power
    # 3. High power appliances (e.g. electric kettle, heater, coffee maker): high power factor, very high power
    # 4. Laptop charger: medium power (45W-90W), high power factor (0.85-0.95 due to active PFC)
    
    for _ in range(num_samples):
        profile = random.choice(['lamp', 'fan', 'heater', 'laptop'])
        vrms = round(random.uniform(215.0, 235.0), 1)
        
        if profile == 'lamp':
            # 25W to 120W, highly resistive (PF near 1.0)
            real_power = round(random.uniform(25.0, 120.0), 1)
            pf = round(random.uniform(0.95, 1.00), 2)
            irms = round(real_power / (vrms * pf), 2)
            
        elif profile == 'fan':
            # 30W to 150W, inductive motor (PF around 0.65-0.85)
            real_power = round(random.uniform(30.0, 150.0), 1)
            pf = round(random.uniform(0.65, 0.85), 2)
            irms = round(real_power / (vrms * pf), 2)
            
        elif profile == 'heater':
            # 500W to 1800W, highly resistive (PF near 1.0)
            real_power = round(random.uniform(500.0, 1800.0), 1)
            pf = round(random.uniform(0.98, 1.00), 2)
            irms = round(real_power / (vrms * pf), 2)
            
        elif profile == 'laptop':
            # 45W to 95W, switching power supply with active PFC (PF around 0.85-0.95)
            real_power = round(random.uniform(45.0, 95.0), 1)
            pf = round(random.uniform(0.85, 0.95), 2)
            irms = round(real_power / (vrms * pf), 2)
            
        synthetic.append([vrms, irms, real_power, pf, 'other'])
        
    return synthetic


# --- EVALUATION AND MAIN PIPELINE ---

def evaluate_model(rf, test_set, serialized_trees):
    # Evaluates the model on test_set and prints standard metrics
    y_true = [row[-1] for row in test_set]
    y_pred = [rf.predict(row[:-1], serialized_trees) for row in test_set]
    
    classes = rf.classes
    correct = sum(1 for t, p in zip(y_true, y_pred) if t == p)
    accuracy = correct / len(test_set)
    
    print("\n=================== MODEL VALIDATION REPORT ===================")
    print(f"Overall Accuracy: {accuracy * 100:.2f}% ({correct}/{len(test_set)} correct)")
    print("---------------------------------------------------------------")
    print(f"{'Class':<12} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10}")
    print("---------------------------------------------------------------")
    
    for cls in classes:
        # Precision = TP / (TP + FP)
        tp = sum(1 for t, p in zip(y_true, y_pred) if t == cls and p == cls)
        fp = sum(1 for t, p in zip(y_true, y_pred) if t != cls and p == cls)
        fn = sum(1 for t, p in zip(y_true, y_pred) if t == cls and p != cls)
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        
        print(f"{cls:<12} | {precision * 100:8.1f}% | {recall * 100:8.1f}% | {f1 * 100:8.1f}%")
    print("===============================================================\n")

def main():
    print("Starting Pure-Python Random Forest Data Preparation...")
    
    # 1. Load data from all three cleaned files
    files = {
        "phone": "phone_result.csv",
        "fan": "Fan_result.csv",
        "laptop": "Laptop_result.csv"
    }
    
    full_dataset = []
    for device, filename in files.items():
        if os.path.exists(filename):
            device_data = load_csv_data(filename)
            print(f"Loaded {len(device_data)} data points from {filename}")
            full_dataset.extend(device_data)
        else:
            print(f"WARNING: File {filename} not found! Skipping...")
            
    if not full_dataset:
        print("ERROR: No data loaded! Cannot train.")
        return
    
    # Augment phone class with synthetic samples to cover PF drift (0.50-0.75)
    # Live ESP32 shows the phone PF can drift up to ~0.60 depending on voltage/charge state,
    # but the training data only captured PF 0.44-0.51. Without this, PF=0.57 gets misclassified.
    # Phone signature: low power (5-12W), low current (0.05-0.12A), mid PF (0.45-0.75)
    phone_augmented = 0
    for _ in range(80):
        vrms = round(random.uniform(215.0, 230.0), 1)
        irms = round(random.uniform(0.05, 0.12), 2)
        real_power = round(random.uniform(5.0, 12.0), 1)
        pf = round(random.uniform(0.45, 0.75), 2)
        full_dataset.append([vrms, irms, real_power, pf, 'phone'])
        phone_augmented += 1
    print(f"Augmented phone class with {phone_augmented} synthetic samples (PF 0.45-0.75)")
    
    random.shuffle(full_dataset)
    
    # Analyze classes count
    class_counts = {}
    for row in full_dataset:
        lbl = row[-1]
        class_counts[lbl] = class_counts.get(lbl, 0) + 1
    print(f"Combined Dataset Classes distribution: {class_counts}")
    
    # 2. Train-Test Split (80% Train, 20% Val)
    split_idx = int(len(full_dataset) * 0.8)
    train_set = full_dataset[:split_idx]
    test_set = full_dataset[split_idx:]
    print(f"Dataset split: {len(train_set)} train samples, {len(test_set)} validation samples.")
    
    # 3. Train Random Forest model
    rf = RandomForest(n_estimators=30, max_depth=10)
    rf.fit(train_set)
    
    # Serialize for validation test
    serialized = rf.export_json()
    
    # 4. Evaluate
    evaluate_model(rf, test_set, serialized["trees"])
    
    # 5. Retrain final model on 100% data for best accuracy
    print("Retraining final Random Forest model on 100% of data...")
    final_rf = RandomForest(n_estimators=30, max_depth=10)
    final_rf.fit(full_dataset)
    final_serialized = final_rf.export_json()
    
    # Ensure destination folder exists
    os.makedirs("server", exist_ok=True)
    model_output_path = os.path.join("server", "model.json")
    
    # 6. Export Model JSON
    print(f"Saving serialized Random Forest model to: {model_output_path}")
    with open(model_output_path, 'w', encoding='utf-8') as f:
        json.dump(final_serialized, f, indent=2)
        
    print("\n[SUCCESS] Random Forest model trained & serialized successfully! [SUCCESS]")

if __name__ == "__main__":
    # Fix random seed for reproducibility
    random.seed(42)
    main()
