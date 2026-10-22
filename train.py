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

def generate_synthetic_fan(num_samples=300):
    # Physics-grounded synthetic fan class. The collected "fan" CSV turned out
    # to be a 7-10W PF~0.9 load (functionally a phone charger), so a real fan
    # has no live recordings; synthesise one from motor physics instead.
    # The only fan observed in this household measures 8-15W (PF 0.62-0.72).
    # Laptop bricks occupy 34-101W at PF 0.73-0.89 (mid-charge dips to ~34W),
    # and the two feature sets overlap everywhere above ~25W — so the fan
    # band is capped at 25W and PF 0.75 to stop it claiming the laptop's
    # mid-charge region. A genuinely larger fan will need real recorded
    # data to reclaim its region.
    synthetic = []
    for _ in range(num_samples):
        vrms = round(random.uniform(215.0, 235.0), 1)
        real_power = round(random.uniform(8.0, 25.0), 1)
        pf = round(random.uniform(0.62, 0.75), 2)
        irms = round(real_power / (vrms * pf), 2)
        synthetic.append([vrms, irms, real_power, pf, 'fan'])
    return synthetic

def generate_synthetic_idle_energized(num_samples=150):
    # "Powered socket, nothing plugged in": mains voltage present, no load
    # current. The collected CSVs never contained this state, which is why it
    # used to read as 'fan'. Teach the model that it is Idle.
    synthetic = []
    for _ in range(num_samples):
        vrms = round(random.uniform(215.0, 235.0), 1)
        irms = round(random.uniform(0.0, 0.004), 3)
        real_power = round(random.uniform(0.0, 0.1), 2)
        pf = round(random.uniform(0.85, 1.00), 2)
        synthetic.append([vrms, irms, real_power, pf, 'Idle'])
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
    
    # 1. Load data from the collected recordings
    files = {
        "phone": "phone_result.csv",
        "fan_csv": "Fan_result.csv",
        "laptop": "Laptop_result.csv"
    }

    full_dataset = []
    for device, filename in files.items():
        if os.path.exists(filename):
            device_data = load_csv_data(filename)
            print(f"Loaded {len(device_data)} data points from {filename}")
            full_dataset.extend(device_data)
        else:
            print(f"WARNING: File {filename} not found! Skipping!")

    if not full_dataset:
        print("ERROR: No data loaded! Cannot train.")
        return

    # The Fan_result.csv live rows were physically a 7-10W PF~0.9 load (a
    # phone-class charger), so they now carry the 'phone' label in the CSV
    # itself. A real fan has no live recording; synthesise the class from
    # motor physics so the model can distinguish it from laptop bricks
    # (overlapping power, but PF 0.65-0.85 vs 0.85-0.95).
    fan_synthetic = generate_synthetic_fan(300)
    full_dataset.extend(fan_synthetic)
    print(f"Synthesised {len(fan_synthetic)} physics-grounded 'fan' samples (30-150W, PF 0.65-0.85)")

    # Powered-but-empty sockets (mains present, no current) have no live
    # recording either; synthesise them as Idle so a live socket with nothing
    # plugged in stops reading as 'fan'.
    idle_energized = generate_synthetic_idle_energized(150)
    full_dataset.extend(idle_energized)
    print(f"Synthesised {len(idle_energized)} energized-idle samples (Vrms>0, no load)")

    # Augment phone class with synthetic samples to cover PF drift. Collected
    # phone data spans PF 0.40-0.51 (rectifier-capacitor chargers); extend to
    # 0.60. Do NOT claim PF above 0.60 at any wattage: the PD fast-charger
    # band (14-25W, PF 0.60-0.72) physically overlaps small fans and the two
    # cannot be separated by these features — guessing there mislabels one
    # side or the other. Users whose fast-charger genuinely reads PF>0.60
    # should record a session and let real data own that region.
    phone_augmented = 0
    for _ in range(180):
        vrms = round(random.uniform(215.0, 230.0), 1)
        irms = round(random.uniform(0.05, 0.15), 2)
        real_power = round(random.uniform(5.0, 25.0), 1)
        pf = round(random.uniform(0.40, 0.60), 2)
        full_dataset.append([vrms, irms, real_power, pf, 'phone'])
        phone_augmented += 1
    print(f"Augmented phone class with {phone_augmented} synthetic samples (5-25W, PF 0.40-0.60)")

    # Augment laptop class with mid-charge samples (30-75W, PF 0.73-0.89).
    # The collected session only captured heavy charge (77-101W); a laptop
    # early in its charge cycle sits at 34-61W with PF 0.72-0.81, a region
    # the collected data never saw and that used to fall to the fan band.
    laptop_augmented = 0
    for _ in range(100):
        vrms = round(random.uniform(215.0, 230.0), 1)
        real_power = round(random.uniform(30.0, 75.0), 1)
        pf = round(random.uniform(0.73, 0.89), 2)
        irms = round(real_power / (vrms * pf), 2)
        full_dataset.append([vrms, irms, real_power, pf, 'laptop'])
        laptop_augmented += 1
    for _ in range(80):
        vrms = round(random.uniform(215.0, 230.0), 1)
        real_power = round(random.uniform(10.0, 25.0), 1)
        pf = round(random.uniform(0.85, 0.97), 2)
        irms = round(real_power / (vrms * pf), 2)
        full_dataset.append([vrms, irms, real_power, pf, 'laptop'])
        laptop_augmented += 1
    print(f"Augmented laptop class with {laptop_augmented} synthetic samples (mid-charge 36-75W PF 0.73-0.89; trickle 10-25W PF 0.85-0.97)")

    # Augment fan class near its low-power edge (8-25W) so small/low-speed
    # fans have coverage instead of being claimed by the phone augmentation.
    # Cap at 25W / PF 0.75: above that the region belongs to laptop bricks
    # (mid-charge dips to ~34W at PF 0.73).
    fan_augmented = 0
    for _ in range(80):
        vrms = round(random.uniform(215.0, 235.0), 1)
        real_power = round(random.uniform(8.0, 14.0), 1)
        pf = round(random.uniform(0.62, 0.72), 2)
        irms = round(real_power / (vrms * pf), 2)
        full_dataset.append([vrms, irms, real_power, pf, 'fan'])
        fan_augmented += 1
    for _ in range(80):
        vrms = round(random.uniform(215.0, 235.0), 1)
        real_power = round(random.uniform(14.0, 25.0), 1)
        pf = round(random.uniform(0.62, 0.75), 2)
        irms = round(real_power / (vrms * pf), 2)
        full_dataset.append([vrms, irms, real_power, pf, 'fan'])
        fan_augmented += 1
    print(f"Augmented fan class with {fan_augmented} synthetic low-power samples (8-25W, PF 0.62-0.75)")
    
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
