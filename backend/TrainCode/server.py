import flwr as fl
from flwr.server import ServerConfig
from flwr.server.strategy import FedAvg

# 1) Define aggregation strategy  (no num_rounds here!)
strategy = FedAvg(
    fraction_fit     = 0.5,   # sam ple 50 % of clients each round
    min_fit_clients  = 11,
    min_available_clients = 11,
    # Optional: metrics aggregation, eval_fn, etc.
)

# 2) Start the server on port 8080, run for 20 rounds
if __name__ == "__main__":
    fl.server.start_server(
        server_address="0.0.0.0:8080",
        config=ServerConfig(num_rounds=10),   # ← set rounds here
        strategy=strategy,
    )

