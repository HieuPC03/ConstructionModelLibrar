"""Download faster-whisper model into a Hugging Face hub-style cache folder."""

from __future__ import annotations

import argparse
import os


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, help="download_root directory")
    parser.add_argument(
        "--model",
        default="small",
        choices=("tiny", "base", "small", "medium"),
    )
    args = parser.parse_args()
    os.makedirs(args.root, exist_ok=True)
    from faster_whisper import WhisperModel

    print(f"Downloading faster-whisper-{args.model} -> {args.root}")
    WhisperModel(
        args.model,
        device="cpu",
        compute_type="int8",
        download_root=args.root,
    )
    print("Done.")


if __name__ == "__main__":
    main()
