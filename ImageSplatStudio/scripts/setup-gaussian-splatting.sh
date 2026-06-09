#!/usr/bin/env bash
# Clone and prepare Inria 3D Gaussian Splatting for ImageSplat Studio.
# Requires: git, conda (recommended), NVIDIA GPU + CUDA
#
# Usage:
#   ./scripts/setup-gaussian-splatting.sh [install_dir]
#
# Then set:
#   export GAUSSIAN_SPLATTING_DIR=/path/to/gaussian-splatting

set -euo pipefail

INSTALL_DIR="${1:-${GAUSSIAN_SPLATTING_DIR:-$HOME/gaussian-splatting}}"

echo "==> Cloning graphdeco-inria/gaussian-splatting into ${INSTALL_DIR}"
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  echo "    Repository already exists — pulling latest"
  git -C "${INSTALL_DIR}" pull --ff-only
  git -C "${INSTALL_DIR}" submodule update --init --recursive
else
  git clone --recursive https://github.com/graphdeco-inria/gaussian-splatting.git "${INSTALL_DIR}"
fi

echo ""
echo "==> Create conda environment (recommended by Inria)"
echo "    cd ${INSTALL_DIR}"
echo "    conda env create --file environment.yml"
echo "    conda activate gaussian_splatting"
echo ""
echo "==> Or install PyTorch + submodules manually:"
echo "    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121"
echo "    pip install submodules/diff-gaussian-rasterization submodules/simple-knn"
echo ""
echo "==> Set environment variable for ImageSplat Studio:"
echo "    export GAUSSIAN_SPLATTING_DIR=${INSTALL_DIR}"
echo ""
echo "Done. Restart backend after setting GAUSSIAN_SPLATTING_DIR."
