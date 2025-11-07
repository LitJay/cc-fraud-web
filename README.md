# Identity Theft Analysis in Distributed Machine Learning with an Effective Prevention Scheme

This application implements an effective prevention scheme against identity theft by using a distributed machine learning (Federated Learning) framework. The system is designed to analyze patterns, detect fraudulent activity, and preserve data privacy.



## 🛠️ Tech Stack

* **Frontend:** React, Next.js
* **Backend:** FastAPI (Python), Federated Learning
* **Database:** MongoDB
* **Styling:** [e.g., Tailwind CSS, Material-UI, etc.]

---

## 📋 Prerequisites

Before you begin, ensure you have the following software installed on your system.
* [Node.js](https://nodejs.org/) (v18 or newer)
* [Python](https://www.python.org/) (v3.9 or newer)
* [Git](https://git-scm.com/)
* [Git LFS](https://git-lfs.github.com/) (Git Large File Storage, for models/data)
* [MongoDB Community Server](https://www.mongodb.com/try/download/community)
* [MongoDB Compass](https://www.mongodb.com/products/compass) (Optional, but recommended GUI)

---

## ⚙️ Setup & Installation

Follow these steps to get your development environment set up and running.

### 1. Clone the Repository

First, clone the project from GitHub. This project uses **Git LFS** for large model/data files.

```bash
# Clone the repository
git clone [https://github.com/LitJay/cc-fraud-web.git](https://github.com/LitJay/cc-fraud-web.git)
cd cc-fraud-web

# Pull all the large files (models, CSVs) from LFS
git lfs pull
```

### 2. Install & Start MongoDB

This project requires a running MongoDB instance.

1.  **Install MongoDB Community Server:**
    Follow the official guide for your operating system.
    * [Install on macOS](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-os-x/)
    * [Install on Ubuntu (Linux)](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/)
    * [Install on Windows](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows/)

2.  **Start the MongoDB Service:**
    After installation, start the database service. **This is the recommended way.**
    * **On macOS (using Homebrew):** `brew services start mongodb-community`
    * **On Linux (using `systemd`):** `sudo systemctl start mongod`
    * **On Windows (as a service):** It should start automatically.

3.  **Verify It's Running:**
    Open **MongoDB Compass** and connect to `mongodb://127.0.0.1:27017`. If it connects, you are ready.

### 3. Set Up the Backend (FastAPI & FL Model)

This is the main API server (`api.py`) located in the `/backend` folder.

```bash
# Navigate to the backend's directory
cd backend

# Create a virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Create your environment file (from the example)
cp .env.example .env
```
> **Important:** Open the new `.env` file. You must add a secure `JWT_SECRET`. The other values (`DB_URL`, `DB_NAME`) should already be correct for a local setup.

### 4. Set Up the Frontend (Next.js Web App)

This is the user interface (at the root of the project).

```bash
# Navigate back to the root directory
cd ..

# Install Node.js dependencies
npm install
# or
yarn install

# Create your local environment file (from the example)
cp .env.local.example .env.local
```
> **Important:** The `.env.local` file is already set up to connect to your local FastAPI server at `http://127.0.0.1:8000`.

---

## ▶️ Running the Application

You must start the components in order. Open **three separate terminal windows**.

### Terminal 1: Start MongoDB (If not running)

```bash
# Check if MongoDB is already running (from brew services)
brew services list

# If it's not 'started', run:
brew services start mongodb-community
```
> Your database is now running in the background.

### Terminal 2: Run the Backend (FastAPI)

```bash
# Go to the backend folder
cd backend

# Activate the Python environment
source .venv/bin/activate

# Run the FastAPI server
uvicorn api:app --reload 
```
> Your backend is now running at `http://127.0.0.1:8000`.
> You will see logs like "✅ MongoDB connection successful".
> You can see all your API endpoints at `http://127.0.0.1:8000/docs`.

### Terminal 3: Run the Frontend (Next.js)

```bash
# Go to the root project folder
# (If you are in 'backend', type 'cd ..')

# Run the Next.js app
npm run dev
```
> Your web application is now running at `http://localhost:3000`.

---

### **⚠️ First-Time Setup: Populate the Database**

When you first run the app, the database is **empty**. You must run the setup script to create the 6 collections and add the initial data.

**You only need to do this ONCE.**

1.  Make sure your FastAPI server (Terminal 2) is running.
2.  Open a **new (fourth) terminal** and run the following `curl` command:

```bash
curl -X POST [http://127.0.0.1:8000/setup-database](http://127.0.0.1:8000/setup-database)
```

> **Done!** Your API has now created all the necessary collections (`all_transaction`, `cases`, `counters`, `staff_user`, etc.) and inserted the default data. You can refresh MongoDB Compass to see them.