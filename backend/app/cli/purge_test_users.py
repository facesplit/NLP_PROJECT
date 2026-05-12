"""Delete every user whose email is NOT in the seed allowlist.

Run from the backend container:

    docker compose run --rm backend python -m app.cli.purge_test_users

The allowlist matches the four users created by ``seed_service.py``:

- ``settings.superadmin_email`` (default ``admin@bouquet.local``) — superadmin
- ``flora@bouquet.local`` — floristadmin
- ``lily@bouquet.local`` — floristadmin
- ``client@bouquet.local`` — consumer

Everything else (manual test registrations) is hard-deleted via
``user_service.admin_hard_delete`` so DB-level FK cascades wipe each user's
orders, notifications, ai_generations, refresh_tokens, florist_points (and
the flowers / portfolio_bouquets / orders chained off those points).

Idempotent: re-running on an already-clean DB is a no-op.
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import User
from app.services import user_service


logger = logging.getLogger(__name__)


SEED_FLORIST_EMAILS = ("flora@bouquet.local", "lily@bouquet.local")
SEED_CONSUMER_EMAILS = ("client@bouquet.local",)


def _allowlist() -> set[str]:
    settings = get_settings()
    return {
        settings.superadmin_email.lower(),
        *SEED_FLORIST_EMAILS,
        *SEED_CONSUMER_EMAILS,
    }


async def _purge() -> None:
    allow = _allowlist()
    print(f"Allowlist (preserved): {sorted(allow)}")

    async with SessionLocal() as session:
        async with session.begin():
            # Pick the surviving superadmin to satisfy admin_hard_delete's
            # "no last superadmin" guard. We pass it as the actor `me`.
            actor = (
                await session.execute(
                    select(User).where(User.email == get_settings().superadmin_email.lower())
                )
            ).scalar_one_or_none()
            if actor is None:
                raise RuntimeError(
                    f"superadmin {get_settings().superadmin_email!r} not found — "
                    "run `python -m app.cli.seed` first"
                )

            targets = (
                await session.execute(select(User).where(User.email.notin_(allow)))
            ).scalars().all()

            print(f"Found {len(targets)} test user(s) to delete:")
            for u in targets:
                print(f"  - {u.email}  role={u.role.value}  active={u.is_active}")

            for u in targets:
                try:
                    await user_service.admin_hard_delete(session, actor, u.id)
                    print(f"    deleted: {u.email}")
                except Exception as exc:  # noqa: BLE001
                    # Surface and continue — don't abort the whole purge over one row
                    print(f"    FAILED {u.email}: {exc}")

            survivors = (await session.execute(select(User))).scalars().all()
            print(f"\nSurvivors ({len(survivors)}):")
            for u in survivors:
                print(f"  - {u.email}  role={u.role.value}")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    asyncio.run(_purge())


if __name__ == "__main__":
    main()
