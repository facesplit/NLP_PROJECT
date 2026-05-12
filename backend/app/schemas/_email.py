from __future__ import annotations

import re
from typing import Annotated

from pydantic import AfterValidator

# RFC 5322 lite — local part allows alnum, dot, dash, plus, underscore;
# domain allows alnum, dot, dash; permits .local / .test / etc since this is
# a self-hosted product running in private deployments.
_EMAIL_RE = re.compile(
    r"^(?P<local>[A-Za-z0-9._%+-]{1,64})@(?P<domain>[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$"
)


def _validate(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("email must be a string")
    cleaned = value.strip()
    if len(cleaned) > 254:
        raise ValueError("email is too long")
    if not _EMAIL_RE.match(cleaned):
        raise ValueError("not a valid email address")
    return cleaned.lower()


EmailField = Annotated[str, AfterValidator(_validate)]
