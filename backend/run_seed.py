import requests
import json

def get_bearer_token():
    """Get bearer token by logging in"""
    login_data = {
        "email": "admin@example.com",  # Replace with your actual admin email
        "password": "admin123"         # Replace with your actual admin password
    }
    
    try:
        response = requests.post("http://localhost:8000/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        else:
            print(f"Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Error during login: {str(e)}")
        return None

def update_seed_script(token):
    """Update the seed script with the bearer token"""
    try:
        with open("seed_transactions.py", "r") as f:
            content = f.read()
        
        # Replace the placeholder token
        content = content.replace('"your_bearer_token_here"', f'"{token}"')
        
        with open("seed_transactions.py", "w") as f:
            f.write(content)
        
        print("✓ Bearer token updated in seed script")
        return True
    except Exception as e:
        print(f"Error updating seed script: {str(e)}")
        return False

if __name__ == "__main__":
    print("Getting bearer token...")
    token = get_bearer_token()
    
    if token:
        print("✓ Bearer token obtained successfully")
        if update_seed_script(token):
            print("\nNow you can run: python seed_transactions.py")
        else:
            print("\nPlease manually update the BEARER_TOKEN in seed_transactions.py")
    else:
        print("✗ Failed to get bearer token")
        print("Please check your admin credentials and update them in this script") 