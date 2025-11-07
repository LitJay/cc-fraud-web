import pandas as pd
from sklearn.preprocessing import LabelEncoder

# Load the data from the uploaded CSV file
df = pd.read_csv('./data/fraudTrain.csv')

# Ensure the 'trans_date_trans_time' column is treated as a string and convert to datetime
df['trans_date_trans_time'] = pd.to_datetime(df['trans_date_trans_time'], format='%m/%d/%y %H:%M')

# Extract the time in 24-hour format and store it in a new column
df['trans_time_24h'] = df['trans_date_trans_time'].dt.strftime('%H:%M:%S')

# Convert 'HH:MM:SS' format to '0 days HH:MM:SS' to be compatible with timedelta
df['trans_time_24h'] = '0 days ' + df['trans_time_24h']

# Convert to timedelta format
df['trans_time_24h'] = pd.to_timedelta(df['trans_time_24h'], errors='coerce')

# Check if there are any NaT (Not a Time) values
if df['trans_time_24h'].isna().any():
    print("There are NaT values in the 'trans_time_24h' column.")

# Optionally, drop the original 'trans_date_trans_time' column if you only want to keep the time
df.drop(columns=['trans_date_trans_time'], inplace=True)

# Convert to timedelta64[ns] if needed
df['trans_time_24h'] = df['trans_time_24h'].astype('timedelta64[ns]')

# Define columns to encode
columns_to_encode = ['merchant', 'category', 'gender', 'job', 'city', 'state', 'street']

# Create a LabelEncoder object
label_encoder = LabelEncoder()

# Apply label encoding for each column in the columns_to_encode list
for col in columns_to_encode:
    df[col] = label_encoder.fit_transform(df[col])

# Display the modified data to check
print(df[['merchant', 'category', 'gender', 'job', 'city', 'state', 'street']].head())
print(df[['trans_time_24h']].head())  # Check only the time column

# Optionally, save the modified DataFrame
df.to_csv('modified_fraudTrain.csv', index=False)
