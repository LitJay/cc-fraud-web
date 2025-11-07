import numpy as np

class EnsembleClassifier:
    def __init__(self, clfs, weights):
        self.clfs = clfs
        self.weights = weights
        self.classes_ = self.clfs[0].classes_ if self.clfs else np.array([0, 1])

    def predict_proba(self, X):
        probs = np.zeros((X.shape[0], 2))
        for clf, w in zip(self.clfs, self.weights):
            probs += w * clf.predict_proba(X)
        return probs