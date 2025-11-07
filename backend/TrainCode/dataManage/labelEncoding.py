from sklearn.preprocessing import LabelEncoder
import pandas as pd

# 创建数据
df = pd.read_csv('modified_fraudTrain.csv')
print(df['trans_time_24h'].head()) 
print(df['trans_time_24h'].dtype)