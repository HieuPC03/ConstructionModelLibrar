# Pipeline — Image → 3D Gaussian Splat

Scripts chạy tuần tự: **COLMAP SfM** → **Inria 3DGS** → **export `.splat`**.

## Luồng xử lý

```
uploads/          → prepare_images.py → work/images/
work/images/      → COLMAP mapper     → work/sparse/0/
work/sparse/0/    → image_undistorter → work/dataset/ (images/ + sparse/0/)
work/dataset/     → train             → work/inria_model/point_cloud/iteration_*/point_cloud.ply
point_cloud.ply   → export_splat.py   → model.splat
```

## Huấn luyện (fallback chain)

1. **Inria 3DGS** — [graphdeco-inria/gaussian-splatting](https://github.com/graphdeco-inria/gaussian-splatting)  
   Cần biến môi trường `GAUSSIAN_SPLATTING_DIR` trỏ tới repo đã clone.

2. **gsplat** — `pip install gsplat torch` (CUDA)

3. **Stub** — metadata demo khi không có GPU/trainer

## Cài Inria 3DGS

```bash
cd ImageSplatStudio
chmod +x scripts/setup-gaussian-splatting.sh
./scripts/setup-gaussian-splatting.sh ~/gaussian-splatting

# Theo hướng dẫn Inria (conda khuyến nghị):
cd ~/gaussian-splatting
conda env create --file environment.yml
conda activate gaussian_splatting

export GAUSSIAN_SPLATTING_DIR=~/gaussian-splatting
```

## Biến môi trường

| Biến | Mô tả |
|------|--------|
| `GAUSSIAN_SPLATTING_DIR` | Đường dẫn repo Inria (có `train.py`) |
| `TRAINING_QUALITY` | `preview` (7k iter) hoặc `standard` (30k iter) |
| `TRAINING_ITERATIONS` | Ghi đè số iteration (tùy chọn) |
| `COLMAP_BIN` | Đường dẫn `colmap` (mặc định: `colmap`) |
| `INPUT_DIR` / `OUTPUT_DIR` | Do backend truyền khi chạy job |

## Chạy thủ công

```bash
export INPUT_DIR=/path/to/images
export OUTPUT_DIR=/path/to/output
export GAUSSIAN_SPLATTING_DIR=~/gaussian-splatting
export TRAINING_QUALITY=preview

python pipeline/run_pipeline.py
```

## Export PLY → .splat

`export_splat.py` dùng `parse_3dgs_ply()` để đọc PLY chuẩn Inria (`scale_*`, `opacity`, `f_dc_*`, `rot_*`) và ghi định dạng 32-byte `.splat` cho web viewer.
