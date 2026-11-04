"""Frozen entry point for the desktop distribution's bundled Python runtime."""
import sys

command = sys.argv.pop(1) if len(sys.argv) > 1 else ""
if command == "guided":
    import guided  # noqa: F401
elif command == "stamps":
    import stamps  # noqa: F401
elif command == "check":
    import cv2
    import numpy
    print("OpenCV " + cv2.__version__ + "; NumPy " + numpy.__version__)
else:
    raise SystemExit("Unknown processing command")
