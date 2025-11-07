import sys
import subprocess
import pkg_resources

# Check Python version
print(f"Python version: {sys.version}")
print(f"Executable: {sys.executable}")

# Check required packages
required = {
    'torch',
    'torchvision',
    'opencv-python',
    'Pillow',
    'ultralytics',
    'numpy',
    'scipy',
    'matplotlib'
}

print("\nChecking installed packages:")
installed = {pkg.key for pkg in pkg_resources.working_set}
missing = required - installed

if missing:
    print(f"\nMissing packages: {', '.join(missing)}")
    print("\nInstall them using:")
    print(f"{sys.executable} -m pip install {' '.join(missing)}")
else:
    print("\nAll required packages are installed!")
