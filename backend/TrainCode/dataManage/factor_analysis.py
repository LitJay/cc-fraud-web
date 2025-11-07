import pandas as pd

# 1) 读取数据
df = pd.read_csv('data/fraudTrain.csv', low_memory=False)

# 2) 预处理：时间→小时，生日→年龄
df['trans_date_trans_time'] = pd.to_datetime(df['trans_date_trans_time'], format='%m/%d/%y %H:%M')
df['hour'] = df['trans_date_trans_time'].dt.hour

df['dob'] = pd.to_datetime(df['dob'], format='%m/%d/%y')
TODAY = pd.Timestamp('2025-07-11')
df['age'] = ((TODAY - df['dob']).dt.days // 365).astype(int)

# 3) 定义要分析的分类字段和数值字段
cat_cols = ['merchant','category','street','city','state','hour']
num_cols = ['amt','city_pop','lat','long','merch_lat','merch_long','age']

global_rate = df['is_fraud'].mean()
print(f"总体欺诈率：{global_rate:.2%}\n")

# 4) 分类字段——按取值计算欺诈率，筛选样本量 ≥ 50，取前 10
for col in cat_cols:
    grp = (df.groupby(col)['is_fraud']
             .agg(fraud_rate='mean', n_cases='count')
             .reset_index()
             .query('n_cases >= 50')
             .sort_values('fraud_rate', ascending=False)
             .head(10))
    print(f"—— 特征 `{col}` 欺诈率 Top10 ——")
    print(grp.to_string(index=False))
    print()

# 5) 数值字段——计算皮尔逊相关系数；并按分箱查看欺诈率
print("—— 数值字段相关性 ——")
for col in num_cols:
    corr = df[col].corr(df['is_fraud'])
    print(f"{col:12s}  corr={corr:.3f}")
print()

print("—— 数值字段分箱欺诈率（按分位数） ——")
for col in num_cols:
    df[f'{col}_bin'] = pd.qcut(df[col].rank(method='first'), 10, labels=False)
    grp = (df.groupby(f'{col}_bin')['is_fraud']
             .agg(fraud_rate='mean', n_cases='count')
             .reset_index())
    print(f"{col}:")
    print(grp.to_string(index=False))
    print()
