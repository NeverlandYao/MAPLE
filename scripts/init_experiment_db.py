#!/usr/bin/env python3
import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    env_path = root / "backend" / ".env"
    schema_path = root / "backend" / "app" / "database" / "experiments_schema.sql"

    load_dotenv(dotenv_path=env_path)
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is missing in backend/.env")

    sql = schema_path.read_text(encoding="utf-8")

    with psycopg2.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()

    print("Experiment schema initialized successfully.")


if __name__ == "__main__":
    main()
