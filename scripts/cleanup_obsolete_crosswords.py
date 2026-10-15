"""Apply explicit, hash-guarded removals carried by the differential ZIP."""
import hashlib,json,pathlib

def cleanup(root):
    root=pathlib.Path(root).resolve()
    manifest=root/'scripts/obsolete-crossword-files.json'
    for item in json.loads(manifest.read_text(encoding='utf-8')):
        path=root/item['path']
        # Never follow a replaced path, symlink or changed local file.
        if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root):continue
        if hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256']:
            path.unlink()
