#!/usr/bin/env bash
set -euo pipefail

INPUT_DIR="${INPUT_DIR:?INPUT_DIR required}"
OUTPUT_DIR="${OUTPUT_DIR:?OUTPUT_DIR required}"
WORK_DIR="${OUTPUT_DIR}/work"
COLMAP_DB="${WORK_DIR}/database.db"
SPARSE_DIR="${WORK_DIR}/sparse"
IMAGES_DIR="${WORK_DIR}/images"

mkdir -p "${WORK_DIR}" "${SPARSE_DIR}" "${IMAGES_DIR}"

echo "STAGE:PREPROCESS"
# Normalize images into work folder
python3 "$(dirname "$0")/prepare_images.py" "${INPUT_DIR}" "${IMAGES_DIR}"

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

echo "STAGE:TRAINING"
python3 "$(dirname "$0")/train_gaussian_splat.py" \
  --images "${IMAGES_DIR}" \
  --sparse "${SPARSE_DIR}/0" \
  --output "${WORK_DIR}/point_cloud"

echo "STAGE:EXPORT"
python3 "$(dirname "$0")/export_splat.py" \
  --input "${WORK_DIR}/point_cloud" \
  --output "${OUTPUT_DIR}/model.splat"

echo "STAGE:DONE"
