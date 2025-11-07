# ==============================================================================
# Federated Learning Automation Script (with Progress Logging)
#
# How to use:
# 1. Place this script in the same directory as 'server.py' and 'client.py'.
# 2. Make sure your federated data is prepared in the 'data/clean/fed/' directory.
# 3. Run the script from your terminal: python run_federated_training.py
#
# This version will now print all logs from the server and clients to your console
# so you can monitor the training progress in real-time.
# ==============================================================================

import subprocess
import time
from pathlib import Path
import os
import signal

# --- Configuration ---
CLIENT_SCRIPT = "client.py"
SERVER_SCRIPT = "server.py"
FED_DATA_DIR = Path("data/clean/fed")
# You can set the batch size here. For your case, it's 20.
BATCH_SIZE = 20

def run_client_batch(states):
    """
    Starts a batch of client processes for the given states and waits for all of them to complete.
    """
    processes = []
    for state_code in states:
        # Command to run each client script
        command = ["python", CLIENT_SCRIPT, state_code]
        print(f"--- Starting client for state: {state_code} ---")
        # Start the client process
        # MODIFICATION: Removed output redirection (stdout=DEVNULL, stderr=DEVNULL)
        # This will now print all client logs to the console.
        process = subprocess.Popen(command)
        processes.append(process)

    print("\n--- All clients in this batch have been launched. Waiting for them to complete... ---")
    # Wait for all client processes in the current batch to finish
    for p in processes:
        p.wait()
    print(f"\n--- Batch of {len(states)} clients finished successfully. ---\n")

def main():
    """
    Main function to orchestrate the server start, batched client execution, and server shutdown.
    """
    # 1. Get a list of all state codes from the filenames in the federated data directory
    all_states = sorted([p.stem for p in FED_DATA_DIR.glob("*.parquet")])
    if not all_states:
        print(f"Error: No state data files found in {FED_DATA_DIR}.")
        print("Please ensure you have run the 'prepare_data.py' script first.")
        return

    print(f"Found {len(all_states)} states to process in total.")

    # 2. Start the Flower server as a background process
    print("--- Starting Flower server in the background... ---")
    server_command = ["python", SERVER_SCRIPT]
    # MODIFICATION: Removed output redirection to see server logs.
    server_process = subprocess.Popen(
        server_command,
        preexec_fn=os.setsid if os.name != 'nt' else None
    )
    print(f"Server started with PID: {server_process.pid}")
    time.sleep(10)  # Wait a few seconds to ensure the server is fully initialized

    try:
        # 3. Split the list of states into batches and run them sequentially
        num_batches = (len(all_states) + BATCH_SIZE - 1) // BATCH_SIZE
        for i in range(0, len(all_states), BATCH_SIZE):
            batch = all_states[i:i + BATCH_SIZE]
            print(f"--- Starting Batch {i//BATCH_SIZE + 1} / {num_batches} with {len(batch)} clients ---")
            run_client_batch(batch)
            print(f"--- Completed Batch {i//BATCH_SIZE + 1} ---")
            time.sleep(5) # Optional: a small delay between batches

    finally:
        # 4. Ensure the server is terminated after all batches are done or if an error occurs
        print("--- All client batches have completed. Terminating server... ---")
        if os.name == 'nt': # For Windows
            server_process.terminate()
        else: # For Linux/macOS
            os.killpg(os.getpgid(server_process.pid), signal.SIGTERM)
        
        server_process.wait() # Wait for the process to actually terminate
        print("--- Server terminated successfully. Federated training process finished. ---")

if __name__ == "__main__":
    main()
