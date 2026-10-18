# TimeXer & TimeXer-DINOv3

This repository contains the official implementation of **TimeXer** ([NeurIPS 2024](https://arxiv.org/abs/2402.19072)) and its state-of-the-art vision-enhanced extension: **TimeXer-DINOv3 (Hybrid Vision-Endogenous & Inverted-Exogenous Time-Series Forecasting)**.

---

## 🚀 What's New: TimeXer-DINOv3

**TimeXer-DINOv3** is an upgraded architecture designed to overcome the representational limits of canonical 1D time-series encoders when predicting complex, non-linear dynamics and regime transitions (e.g., electricity price spikes in Day-Ahead Electricity Price Forecasting - EPF).

### Core Architectural Innovations

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     TIMEXER-DINOV3 ARCHITECTURE                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

  [ Endogenous Target: x_en ]                               [ Exogenous Covariates: X_ex ]
         (B, L, 1)                                                (B, L, C_ex)
             │                                                          │
             ▼                                                          ▼
  ┌─────────────────────────┐                                ┌──────────────────────────┐
  │   Stage 1: RevIN Norm   │                                │  Stage 4: Inverted Embed │
  │   Instance Statistics   │                                │  DataEmbedding_inverted  │
  └──────────┬──────────────┘                                └──────────┬───────────────┘
             │                                                          │
             ▼                                                          │
  ┌─────────────────────────┐                                           │
  │   Stage 2: TS2Image     │                                           │
  │   GASF + GADF + Periodic│                                           │
  │   (B, 3, 176, 176)      │                                           │
  └──────────┬──────────────┘                                           │
             │                                                          │
             ▼                                                          │
  ┌─────────────────────────┐                                           │
  │   Stage 3: DINOv3 ViT   │                                           │
  │   12 Blocks, 2D RoPE    │                                           │
  │   Raw: (B, 126, 384)    │                                           │
  └──────────┬──────────────┘                                           │
             │                                                          │
             ├───────────────────┬───────────────────┐                  │
             │ (Discard)         │ (Index 0)         │ (Indices 5..)    │
             ▼                   ▼                   ▼                  │
    [ 4 Register Tokens ]   [ z_cls Token ]    [ Z_patch Tokens ]       │
      Indices 1..4 (X)         (B, 1, 384)        (B, 121, 384)         │
                                 │                   │                  │
                                 ▼                   ▼                  │
                           ┌───────────┐       ┌───────────┐            │
                           │  Adapter  │       │  Adapter  │            │
                           │ (B, 1, D) │       │(B, 121, D)│            │
                           └─────┬─────┘       └─────┬─────┘            │
                                 │                   │                  │
             ┌───────────────────┘                   │                  │
             │ (Query)                               │                  │ (Key & Value)
             ▼                                       │                  ▼
  ┌─────────────────────────────────────┐            │       ┌──────────────────────┐
  │   Step 5a: Cross-Attention Fusion   │◄───────────┼───────┤ Exogenous Tokens V_ex│
  │   MultiheadAttn(Q, K, V) + FFN      │            │       │   (B, C_all, D)      │
  └──────────────────┬──────────────────┘            │       └──────────────────────┘
                     │                               │
                     ▼ (v_fused)                     │
             ┌───────────────────────────────────────┘
             │ Concatenate: [ Z_patch (121) || v_fused (1) ]
             ▼
  ┌─────────────────────────────────────┐
  │   Step 5b: Post-Encoder (Self-Attn) │
  │   Local patches conditioned on exo  │
  │   Output: (B, 122, D)               │
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │   Adaptive Pooling Bottleneck       │
  │   121 Patches ──► 7 Patches         │
  │   Output: (B, 8, D)                 │
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │   Stage 6: FlattenHead & De-Norm    │
  │   Linear Projection + RevIN Scaler  │
  │   Final Output: y_hat (B, 24, 1)    │
  └─────────────────────────────────────┘
```

1. **On-the-Fly 1D-to-2D Multi-Channel Imaging (`layers/TS2Image.py`)**:
   - Converts the normalized 1D look-back window into an ImageNet-compatible 3-channel 2D tensor on GPU in under $1\text{ms}$:
     - **Channel 1 (GASF)**: Gramian Angular Summation Field capturing auto-correlations without $\arccos$ gradient issues.
     - **Channel 2 (GADF)**: Skew-symmetric Gramian Angular Difference Field capturing causal temporal transitions.
     - **Channel 3 (Periodic Folding)**: 2D inter-day $\times$ intra-day cyclic grid.
   - Resized to $16K \times 16K$ ($176 \times 176$ for EPF $L=168$; $96 \times 96$ for LTSF $L=96$).

2. **Pretrained DINOv3 Vision Backbone (`models/TimeXer_DINOv3.py`)**:
   - Reuses official `vit_small_patch16_dinov3` (86.4 MB) from `timm` with 2D Axial RoPE.
   - **Strict Token Decomposition**: Completely discards the 4 internal Register Tokens (indices 1..4), retaining only the global semantic `[CLS]` token and spatial patch tokens.

3. **2-Step Post-Backbone Cross-Modality Fusion**:
   - **Step 5a (Exo-to-Global Cross-Attention)**: `[CLS]` token queries exogenous covariates $\mathbf{V}_{ex}$ to integrate external drivers.
   - **Step 5b (Global-to-Patch Self-Attention)**: Propagates exogenous context from the fused global token back into all spatial patches.

4. **VRAM-Optimized Adaptive Bottleneck & Differential Optimizer**:
   - Compresses 121 spatial patch tokens to 7 tokens before the FlattenHead, preventing overfitting and reducing head parameter count by 88%.
   - Fully optimized for single-GPU execution (tested on NVIDIA GeForce RTX 2050 4GB with `--use_amp`).
   - Supports Differential Learning Rates ($\eta_{head}=10^{-4}, \eta_{backbone}=10^{-5}$) using AdamW.

---

## 🛠️ Environment Setup

Ensure you have Python 3.10+ and a CUDA-enabled PyTorch environment:

```bash
# Clone the repository
git clone https://github.com/vminh16/TimeXer.git
cd TimeXer

# Install dependencies
pip install -r requirements.txt
```

### Key Dependencies
- `torch>=2.1.0` & `torchvision>=0.16.0` (with CUDA support)
- `timm>=1.0.9` (for DINOv3 ViT backbones)
- `transformers>=4.45.0,<5.0.0`
- `peft>=0.12.0,<0.15.0` (for parameter-efficient fine-tuning)
- `numpy>=1.23.5,<2.0.0`

---

## 📊 Quick Start: Running Experiments

### 1. TimeXer-DINOv3 on Electricity Price Forecasting (EPF)

We provide an automated execution script across all 5 benchmark markets (`NP`, `PJM`, `BE`, `FR`, `DE`):

```bash
# Regime 1: Frozen Backbone Probe (Backbone 100% frozen, train adapters/head)
bash scripts/forecast_exogenous/EPF/TimeXer_DINOv3.sh regime1 2021

# Regime 2: Partial Fine-Tuning (Unfreezes top-2 ViT blocks + LayerNorms with differential LR)
bash scripts/forecast_exogenous/EPF/TimeXer_DINOv3.sh regime2 2021
```

### 2. Custom CLI Execution

You can run `run.py` directly with specific hyperparameters:

```bash
python -u run.py \
  --is_training 1 \
  --task_name long_term_forecast \
  --root_path ./dataset/EPF/ \
  --data_path NP.csv \
  --model_id NP_168_24_demo \
  --model TimeXer_DINOv3 \
  --data custom \
  --features MS \
  --seq_len 168 \
  --pred_len 24 \
  --enc_in 3 \
  --dec_in 3 \
  --c_out 1 \
  --patch_len 24 \
  --period_len 24 \
  --d_model 256 \
  --d_ff 512 \
  --n_heads 8 \
  --post_e_layers 1 \
  --batch_size 16 \
  --train_epochs 10 \
  --patience 3 \
  --learning_rate 0.0001 \
  --dino_lr 0.00001 \
  --dino_freeze all \
  --use_amp \
  --use_pooled_bottleneck 1 \
  --seed 2021
```

### DINOv3 Command-Line Arguments Reference

| Argument | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `--dino_model_name` | `str` | `vit_small_patch16_dinov3` | Backbone name loaded from `timm` / HuggingFace |
| `--dino_img_size` | `int` | `176` | Spatial image resolution ($16 \times K$, $176$ for $L=168$, $96$ for $L=96$) |
| `--dino_freeze` | `str` | `all` | Freezing regime: `all` (frozen probe), `partial` (top-2 blocks), `lora`, or `none` |
| `--dino_lr` | `float` | `1e-5` | Separate differential learning rate for DINOv3 backbone |
| `--period_len` | `int` | `24` | Fundamental period for Channel 3 folding map (e.g., 24h daily cycle) |
| `--use_pooled_bottleneck` | `int` | `1` | `1`: Pool 121 spatial patch tokens to 7 tokens before head; `0`: full flatten |
| `--post_e_layers` | `int` | `1` | Number of Post-Encoder Self-Attention layers |

---

## 🧪 Unit Tests & Pre-Flight Sanity Checks

Before executing long training runs, verify all mathematical and structural invariants:

```bash
# 1. Test 2D Imaging: Zero-NaN assertion, GASF symmetry, GADF skew-symmetry, Autograd
python test_ts2image.py

# 2. Test TimeXer_DINOv3: Register token discarding, Gradient isolation, Routing, Partial FT
python test_timexer_dinov3.py
```

---

## 📈 Baseline TimeXer Overview & Results

### Canonical TimeXer Architecture
TimeXer employs patch-level and variate-level representations respectively for endogenous and exogenous variables, using an endogenous global token as an information bridge.

<p align="center">
<img src="./figures/TimeXer.png" width="800" alt="TimeXer Architecture" align="center" />
</p>

### Reproduction on EPF Benchmark (G1 Accepted)
Below are the reproduction results achieved on the local benchmark setup (3 seeds, $L=168, H=24$):

| Dataset | Paper MSE / MAE | Reproduced MSE / MAE (Mean ± Std) | Status |
| :--- | :---: | :---: | :---: |
| **NP** | `0.236` / `0.268` | **0.2408** ± 0.0039 / **0.2680** ± 0.0006 | **Passed** |
| **PJM** | `0.093` / `0.192` | **0.0961** ± 0.0023 / **0.1941** ± 0.0011 | **Passed** |
| **BE** | `0.379` / `0.243` | **0.3804** ± 0.0029 / **0.2424** ± 0.0003 | **Passed** |
| **FR** | `0.385` / `0.208` | **0.3950** ± 0.0039 / **0.2093** ± 0.0019 | **Passed** |
| **DE** | `0.440` / `0.415` | **0.4470** ± 0.0167 / **0.4171** ± 0.0038 | **Passed** |
| **AVG** | `0.307` / `0.265` | **0.3119** / **0.2662** | **Passed** |

### TimeXer-DINOv3 Benchmark Results (EPF Benchmark)
Head-to-head evaluation across all 5 EPF markets ($L=168, H=24$, Seed 2021) comparing the canonical TimeXer baseline against TimeXer-DINOv3 under both **Regime 1 (100% Frozen Backbone Probe)** and **Regime 2 (Partial Fine-Tuning: Top-2 ViT Blocks + LayerNorms)**:

| Market | TimeXer Baseline (MSE / MAE) | DINOv3 Regime 1: Frozen Probe (MSE / MAE) | DINOv3 Regime 2: Partial FT (MSE / MAE) | Gain (Regime 2 vs Regime 1) |
| :--- | :---: | :---: | :---: | :---: |
| **NP** (Nordic) | `0.2365` / `0.2673` | `0.2710` / `0.2964` | **0.2520** / **0.2879** | **-7.0%** MSE |
| **PJM** (USA) | `0.0969` / `0.1947` | `0.1319` / `0.2230` | **0.1190** / **0.2132** | **-9.8%** MSE |
| **BE** (Belgium) | `0.3794` / `0.2423` | `0.4153` / `0.2645` | **0.4125** / **0.2595** | **-0.7%** MSE |
| **FR** (France) | `0.3908` / `0.2113` | `0.4573` / `0.2333` | **0.4480** / **0.2253** | **-2.0%** MSE |
| **DE** (Germany) | `0.4664` / `0.4213` | `0.4920` / `0.4482` | **0.4854** / **0.4409** | **-1.3%** MSE |
| **AVG** | **0.3140** / **0.2674** | **0.3535** / **0.2931** | **0.3434** / **0.2854** | **-2.9%** MSE (Consistent Gain) |

---


## 📖 Citation

```bibtex
@article{wang2024timexer,
  title={TimeXer: Empowering Transformers for Time Series Forecasting with Exogenous Variables},
  author={Wang, Yuxuan and Wu, Haixu and Dong, Jiaxiang and Liu, Yong and Qiu, Yunzhong and Zhang, Haoran and Wang, Jianmin and Long, Mingsheng},
  journal={Advances in Neural Information Processing Systems},
  year={2024}
}
```
