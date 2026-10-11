#!/usr/bin/env python3
"""Local MRC publication; Dropbox working files remain authoritative."""
from pathlib import Path
import argparse
import datetime
import subprocess
import sys

ROOT = Path(__file__).resolve().parent


def git(*args, root=ROOT, capture=False):
    return subprocess.run(['git', *args], cwd=root, check=True, text=True,
                          stdout=subprocess.PIPE if capture else None).stdout


def align_history(root=ROOT):
    if git('branch', '--show-current', root=root, capture=True).strip() != 'main':
        raise ValueError('Pubblicazione consentita solo dal branch main.')
    if git('ls-files', '-u', root=root, capture=True).strip():
        raise ValueError('Conflitti Git non risolti: pubblicazione annullata.')
    git('fetch', 'origin', 'main', root=root)
    git('rev-parse', '--verify', 'origin/main', root=root, capture=True)
    git('merge-base', 'HEAD', 'origin/main', root=root, capture=True)
    remote_only = int(git('rev-list', '--count', 'HEAD..origin/main', root=root, capture=True))
    if remote_only:
        local_only = int(git('rev-list', '--count', 'origin/main..HEAD', root=root, capture=True))
        if local_only:
            stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S-%f')
            git('branch', 'mrc-history-before-sync-' + stamp, 'HEAD', root=root)
        # No checkout, pull, hard reset or stash application: never replace Dropbox files.
        git('reset', '--mixed', 'origin/main', root=root)
        print('Cronologia allineata a origin/main. File Dropbox conservati; differenze locali da pubblicare.')


def restore_automation_files(root=ROOT):
    """Stage only missing local automation files; never overwrite existing remote files."""
    tracked = set(git('ls-tree', '-r', '--name-only', 'HEAD', '--', '.github', 'scripts',
                      root=root, capture=True).splitlines())
    new_files = []
    for dirname in ('.github', 'scripts'):
        directory = root / dirname
        if not directory.is_dir():
            print(f'Ripristino: {dirname}/ non presente localmente, ignorata.')
            continue
        for file in sorted(directory.rglob('*')):
            if not file.is_file() or file.is_symlink():
                continue
            rel = file.relative_to(root).as_posix()
            if any(p in ('__pycache__', '.DS_Store') for p in file.parts) or file.suffix == '.pyc':
                continue
            if rel not in tracked:
                new_files.append(rel)
    if new_files:
        git('add', '-f', '--', *new_files, root=root)
        print(f'Ripristino: {len(new_files)} file nuovi di .github/ e scripts/ aggiunti al commit.')
    else:
        print('Ripristino: nessun file di automazione mancante da caricare.')


def publish(message, root=ROOT, restore_automation=False):
    align_history(root)
    subprocess.run([sys.executable, str(root / 'build.py')], cwd=root, check=True)
    # Automation folders are managed separately: never upload or delete them here.
    git('add', '-A', root=root)
    staged_protected = git('diff', '--cached', '--name-only', '--', '.github', 'scripts', root=root, capture=True)
    if staged_protected.strip():
        git('reset', '-q', 'HEAD', '--', '.github', 'scripts', root=root)
    if restore_automation:
        restore_automation_files(root)
    ignored = subprocess.run(['git', 'ls-files', '-ci', '--exclude-standard', '-z'], cwd=root, check=True, stdout=subprocess.PIPE).stdout
    if ignored:
        names = [name for name in ignored.decode().rstrip('\0').split('\0')
                 if name and name.split('/', 1)[0] not in ('.github', 'scripts')]
        if names:
            git('rm', '--cached', '--ignore-unmatch', '--', *names, root=root)
    changed = subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=root).returncode
    if changed not in (0, 1):
        raise ValueError('Impossibile verificare le modifiche staged.')
    if changed:
        git('commit', '-m', message, root=root)
    # Also retry an existing local commit after a failed push. No synthetic empty commits.
    git('push', 'origin', 'HEAD:main', root=root)
    git('fetch', 'origin', 'main', root=root)
    if git('rev-parse', 'HEAD', root=root, capture=True) != git('rev-parse', 'origin/main', root=root, capture=True):
        raise ValueError('HEAD e origin/main non allineati dopo il push.')
    status = git('status', '--porcelain', '--untracked-files=all', root=root, capture=True)
    remaining = [line for line in status.splitlines()
                 if line[3:].split('/', 1)[0] not in ('.github', 'scripts')]
    if remaining:
        raise ValueError('Push eseguito, ma il repository contiene modifiche successive: non dichiarato pulito.')
    print('Repository pulito e allineato. Cloudflare Pages pubblicherà il commit: https://marcoruisi.pages.dev/')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--message', default='Update MRC website')
    parser.add_argument('--restore-automation', action='store_true',
                        help='Ripristina su GitHub soltanto file locali mancanti in .github/ e scripts/')
    args = parser.parse_args()
    try:
        publish(args.message, restore_automation=args.restore_automation)
    except (subprocess.CalledProcessError, ValueError, OSError) as exc:
        print(f'Pubblicazione interrotta: {exc}', file=sys.stderr)
        sys.exit(1)
