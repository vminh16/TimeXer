export CUDA_VISIBLE_DEVICES=0

model_name=TimeXer
des='Timexer-MS'

# Build the dataset first:
#   python solar/prepare_solar_data.py --demo-faults              (offline sample)
#   python solar/prepare_solar_data.py --source openmeteo --pv-csv inverter.csv --out ./dataset/Solar/solar.csv

python3 -u run.py \
  --is_training 1 \
  --task_name long_term_forecast \
  --root_path ./dataset/Solar/ \
  --data_path solar_demo.csv \
  --model_id Solar_168_24 \
  --model $model_name \
  --data custom \
  --features MS \
  --target OT \
  --freq h \
  --seq_len 168 \
  --label_len 48 \
  --pred_len 24 \
  --e_layers 2 \
  --enc_in 6 \
  --dec_in 6 \
  --c_out 1 \
  --des $des \
  --patch_len 24 \
  --d_model 256 \
  --d_ff 512 \
  --batch_size 32 \
  --itr 1
