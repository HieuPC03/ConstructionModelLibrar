#!/usr/bin/env bash
set -euo pipefail

INPUT_DIR="${INPUT_DIR:?INPUT_DIR required}"
OUTPUT_DIR="${OUTPUT_DIR:?OUTPUT_DIR required}"
WORK_DIR="${OUTPUT_DIR}/work"
COLMAP_DB="${WORK_DIR}/database.db"
SPARSE_DIR="${WORK_DIR}/sparse"
IMAGES_DIR="${WORK_DIR}/images"
DATASET_DIR="${WORK_DIR}/dataset"
MODEL_DIR="${WORK_DIR}/inria_model"
PIPELINE_DIR="$(dirname "$0")"

mkdir -p "${WORK_DIR}" "${SPARSE_DIR}" "${IMAGES_DIR}"

echo "STAGE:PREPROCESS"
python3 "${PIPELINE_DIR}/prepare_images.py" "${INPUT_DIR}" "${IMAGES_DIR}"

echo "STAGE:COLMAP"
if ! command -v colmap >/dev/null 2>&1; then
  echo "COLMAP not found. Install: https://colmap.github.io/install.html"
  exit 1
fi

colmap feature_extractor \
  --database_path "${COLMAP_DB}" \
  --image_path "${IMAGES_DIR}" \
  --ImageReader.single_camera 1 \
  --SiftExtraction.use_gpu 1

colmap exhaustive_matcher \
  --database_path "${COLMAP_DB}" \
  --SiftMatching.use_gpu 1

mkdir -p "${SPARSE_DIR}/0"
colmap mapper \
  --database_path "${COLMAP_DB}" \
  --image_path "${IMAGES_DIR}" \
  --output_path "${SPARSE_DIR}"

echo "STAGE:COLMAP_UNDISTORT"
colmap image_undistorter \
  --image_path "${IMAGES_DIR}" \
  --input_path "${SPARSE_DIR}/0" \
  --output_path "${DATASET_DIR}" \
  --output_type COLMAP

echo "STAGE:TRAINING"
python3 "${PIPELINE_DIR}/train_gaussian_splat.py" \
  --dataset "${DATASET_DIR}" \
  --images "${DATASET_DIR}/images" \
  --sparse "${DATASET_DIR}/sparse/0" \
  --output "${MODEL_DIR}"

echo "STAGE:EXPORT"
python3 "${PIPELINE_DIR}/export_splat.py" \
  --input "${MODEL_DIR}" \
  --output "${OUTPUT_DIR}/model.splat"

echo "STAGE:DONE"
