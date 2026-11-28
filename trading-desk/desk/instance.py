"""One desk per database: two of them would trade the same money twice."""

from __future__ import annotations

import os
import sys
from pathlib import Path


class AlreadyRunning(Exception):
    pass


def claim(db_path: Path) -> int:
    """Lock a file next to the database for as long as this process lives.

    The operating system drops the lock when the process ends, however it ends, so a
    crash never leaves the desk locked out. Raises AlreadyRunning if another process
    holds it. Keep the returned descriptor open: closing it releases the lock.
    """
    path = db_path.with_suffix(".lock")
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_RDWR | os.O_CREAT, 0o644)
    try:
        if sys.platform == "win32":
            import msvcrt

            msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError as e:
        os.close(fd)
        raise AlreadyRunning(str(path)) from e
    return fd
