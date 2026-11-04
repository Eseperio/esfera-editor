"""Copy the bundled Python components' distribution notices into the app."""
import importlib.metadata
from pathlib import Path
import shutil
import sysconfig

root = Path('build/licenses')
root.mkdir(parents=True, exist_ok=True)
shutil.copyfile(Path(sysconfig.get_path('stdlib')) / 'LICENSE.txt', root / 'Python-LICENSE.txt')
for name in ('numpy', 'opencv-python-headless', 'pyinstaller'):
    dist = importlib.metadata.distribution(name)
    for item in dist.files or []:
        if any(word in item.name.upper() for word in ('LICENSE', 'COPYING', 'NOTICE')):
            source = Path(dist.locate_file(item))
            if source.is_file():
                target = root / name / str(item).replace('..', '_')
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, target)
