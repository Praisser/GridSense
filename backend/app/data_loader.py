import pandas as pd
import os

class DataLoader:
    def __init__(self):
        self.meters_df = None
        self.feeder_df = None

    def load_data(self):
        data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../data'))
        meters_path = os.path.join(data_dir, 'meters.csv')
        feeder_path = os.path.join(data_dir, 'feeder_input.csv')
        
        if os.path.exists(meters_path):
            self.meters_df = pd.read_csv(meters_path)
        else:
            self.meters_df = pd.DataFrame()
            
        if os.path.exists(feeder_path):
            self.feeder_df = pd.read_csv(feeder_path)
        else:
            self.feeder_df = pd.DataFrame()

data_loader = DataLoader()
