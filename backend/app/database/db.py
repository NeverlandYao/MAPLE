import json
import os
from typing import Any, Dict, List, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import load_backend_env
from app.paths import APP_DIR

load_backend_env()

DATABASE_URL = os.getenv("DATABASE_URL", "")
engine = None
SessionLocal = None


def _is_valid_db_url(url: str) -> bool:
    return bool(url and (url.startswith("postgresql://") or url.startswith("postgres://")))


def _schema_sql() -> str:
    schema_path = APP_DIR / "database" / "experiments_schema.sql"
    return schema_path.read_text(encoding="utf-8")


def init_db() -> None:
    global engine
    global SessionLocal

    if not _is_valid_db_url(DATABASE_URL):
        print("DATABASE_URL not configured. Cloud persistence is disabled.")
        return

    try:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

        with engine.begin() as conn:
            conn.execute(text(_schema_sql()))

        print("Cloud PostgreSQL persistence enabled.")
    except Exception as exc:
        engine = None
        SessionLocal = None
        print(f"Failed to initialize cloud persistence: {exc}")


def _db_ready() -> bool:
    return SessionLocal is not None


def _ensure_db_ready() -> bool:
    if _db_ready():
        return True
    init_db()
    return _db_ready()


def ensure_session_db(session_id: str, user_name: str = "Learner", source: str = "chatbot") -> bool:
    if not _ensure_db_ready():
        return False
    try:
        with SessionLocal.begin() as db:
            db.execute(
                text(
                    """
                    insert into public.maple_sessions (session_id, user_name, source)
                    values (:session_id, :user_name, :source)
                    on conflict (session_id)
                    do update set user_name = excluded.user_name
                    """
                ),
                {"session_id": session_id, "user_name": user_name, "source": source},
            )
        return True
    except Exception as exc:
        print(f"Failed to ensure session: {exc}")
        try:
            init_db()
            if not _db_ready():
                return False
            with SessionLocal.begin() as db:
                db.execute(
                    text(
                        """
                        insert into public.maple_sessions (session_id, user_name, source)
                        values (:session_id, :user_name, :source)
                        on conflict (session_id)
                        do update set user_name = excluded.user_name
                        """
                    ),
                    {"session_id": session_id, "user_name": user_name, "source": source},
                )
            return True
        except Exception as retry_exc:
            print(f"Retry failed to ensure session: {retry_exc}")
        return False


def upsert_interaction_log_db(
    session_id: str,
    round_no: int,
    role: str,
    content: str,
    expert_role: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    if not _ensure_db_ready():
        return False
    try:
        with SessionLocal.begin() as db:
            db.execute(
                text(
                    """
                    insert into public.maple_interaction_logs
                      (session_id, round_no, role, expert_role, content, metadata)
                    values
                      (:session_id, :round_no, :role, :expert_role, :content, cast(:metadata as jsonb))
                    on conflict (session_id, round_no, role)
                    do update set
                      expert_role = excluded.expert_role,
                      content = excluded.content,
                      metadata = excluded.metadata,
                      logged_at = now()
                    """
                ),
                {
                    "session_id": session_id,
                    "round_no": round_no,
                    "role": role,
                    "expert_role": expert_role,
                    "content": content,
                    "metadata": json.dumps(metadata or {}, ensure_ascii=False),
                },
            )
        return True
    except Exception as exc:
        print(f"Failed to upsert interaction log: {exc}")
        try:
            init_db()
            if not _db_ready():
                return False
            with SessionLocal.begin() as db:
                db.execute(
                    text(
                        """
                        insert into public.maple_interaction_logs
                          (session_id, round_no, role, expert_role, content, metadata)
                        values
                          (:session_id, :round_no, :role, :expert_role, :content, cast(:metadata as jsonb))
                        on conflict (session_id, round_no, role)
                        do update set
                          expert_role = excluded.expert_role,
                          content = excluded.content,
                          metadata = excluded.metadata,
                          logged_at = now()
                        """
                    ),
                    {
                        "session_id": session_id,
                        "round_no": round_no,
                        "role": role,
                        "expert_role": expert_role,
                        "content": content,
                        "metadata": json.dumps(metadata or {}, ensure_ascii=False),
                    },
                )
            return True
        except Exception as retry_exc:
            print(f"Retry failed to upsert interaction log: {retry_exc}")
        return False


def sync_session_messages_db(
    session_id: str,
    user_name: str,
    messages: List[Dict[str, Any]],
    source: str = "chatbot_sync",
) -> bool:
    if not _ensure_db_ready():
        return False
    try:
        if not ensure_session_db(session_id=session_id, user_name=user_name or "Learner", source=source):
            return False

        round_no = 0
        user_messages: List[str] = []
        for msg in messages:
            role_raw = str(msg.get("role", "")).strip().lower()
            content = str(msg.get("content", "")).strip()
            expert_role = str(msg.get("agent_id") or msg.get("expert_role") or "").strip().lower()
            if expert_role not in {"general", "tech", "pedagogy", "ethics"}:
                expert_role = None
            if not content:
                continue

            if role_raw == "user":
                round_no += 1
                role = "user"
                user_messages.append(content)
            elif role_raw in {"assistant", "ai", "expert"}:
                if round_no == 0:
                    round_no = 1
                role = "expert"
            else:
                continue

            ok = upsert_interaction_log_db(
                session_id=session_id,
                round_no=round_no,
                role=role,
                content=content,
                expert_role=expert_role if role in {"assistant", "expert"} else None,
                metadata={"source": source},
            )
            if not ok:
                return False

        title = (user_messages[0] if user_messages else "").strip()[:80]
        preview = (user_messages[-1] if user_messages else "").strip()[:200]
        _ = update_session_snapshot_db(
            session_id=session_id,
            title=title,
            last_message_preview=preview,
            message_count=len([m for m in messages if str(m.get("role", "")).strip().lower() in {"user", "assistant", "ai"}]),
        )
        return True
    except Exception as exc:
        print(f"Failed to sync session messages: {exc}")
        return False


def update_session_snapshot_db(
    session_id: str,
    title: Optional[str] = None,
    last_message_preview: Optional[str] = None,
    message_count: Optional[int] = None,
) -> bool:
    if not _ensure_db_ready():
        return False
    try:
        with SessionLocal.begin() as db:
            db.execute(
                text(
                    """
                    update public.maple_sessions
                    set
                      title = coalesce(:title, title),
                      last_message_preview = coalesce(:last_message_preview, last_message_preview),
                      message_count = coalesce(:message_count, message_count),
                      last_activity_at = now()
                    where session_id = :session_id
                    """
                ),
                {
                    "session_id": session_id,
                    "title": (title or "").strip()[:120] if title is not None else None,
                    "last_message_preview": (last_message_preview or "").strip()[:300] if last_message_preview is not None else None,
                    "message_count": max(int(message_count), 0) if message_count is not None else None,
                },
            )
        return True
    except Exception as exc:
        print(f"Failed to update session snapshot: {exc}")
        return False


def load_conversation_log_db(session_id: str) -> Optional[List[Dict[str, Any]]]:
    if not _ensure_db_ready():
        return None
    try:
        with SessionLocal() as db:
            rows = db.execute(
                text(
                    """
                    select role, content
                         , expert_role
                    from public.maple_interaction_logs
                    where session_id = :session_id
                    order by round_no asc,
                             case when role = 'user' then 1 else 2 end asc,
                             logged_at asc
                    """
                ),
                {"session_id": session_id},
            ).mappings().all()
        result: List[Dict[str, Any]] = []
        for row in rows:
            item = {"role": row["role"], "content": row["content"]}
            if row.get("expert_role"):
                item["agentId"] = row["expert_role"]
            result.append(item)
        return result
    except Exception as exc:
        print(f"Failed to load conversation: {exc}")
        return None


def load_session_detail_db(session_id: str) -> Optional[Dict[str, Any]]:
    if not _ensure_db_ready():
        return None
    try:
        with SessionLocal() as db:
            session_row = db.execute(
                text(
                    """
                    select session_id, user_name, title, started_at
                    from public.maple_sessions
                    where session_id = :session_id
                    """
                ),
                {"session_id": session_id},
            ).mappings().first()
            if not session_row:
                return None

            messages = load_conversation_log_db(session_id) or []
            return {
                "session_id": session_row["session_id"],
                "user_name": session_row["user_name"],
                "title": session_row.get("title") or "",
                "timestamp": session_row["started_at"].timestamp() if session_row["started_at"] else 0,
                "message_count": len(messages),
                "messages": messages,
            }
    except Exception as exc:
        print(f"Failed to load session detail: {exc}")
        return None


def list_sessions_db(limit: int = 200) -> Optional[List[Dict[str, Any]]]:
    if not _ensure_db_ready():
        return None
    try:
        with SessionLocal() as db:
            rows = db.execute(
                text(
                    """
                    select
                      s.session_id,
                      s.user_name,
                      s.started_at,
                      s.title,
                      coalesce(nullif(s.last_message_preview, ''), (
                        select il.content
                        from public.maple_interaction_logs il
                        where il.session_id = s.session_id and il.role = 'user'
                        order by il.round_no desc, il.logged_at desc
                        limit 1
                      )) as preview,
                      case
                        when s.message_count > 0 then s.message_count
                        else (
                          select count(*)
                          from public.maple_interaction_logs il2
                          where il2.session_id = s.session_id
                        )
                      end as message_count,
                      s.last_activity_at
                    from public.maple_sessions s
                    order by coalesce(s.last_activity_at, s.started_at) desc
                    limit :limit
                    """
                ),
                {"limit": limit},
            ).mappings().all()

        result: List[Dict[str, Any]] = []
        for row in rows:
            preview = row["preview"] or "Empty conversation"
            if len(preview) > 50:
                preview = preview[:50] + "..."
            result.append(
                {
                    "session_id": row["session_id"],
                    "user_name": row["user_name"],
                    "title": row.get("title") or "",
                    "timestamp": row["started_at"].timestamp() if row["started_at"] else 0,
                    "preview": preview,
                    "message_count": int(row["message_count"] or 0),
                }
            )
        return result
    except Exception as exc:
        print(f"Failed to list sessions: {exc}")
        return None


def save_dispatcher_log_db(
    session_id: str,
    round_no: int,
    user_utterance: str,
    assigned_dimension: str,
    confidence: Optional[float],
    reason: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    if not _ensure_db_ready():
        return False
    try:
        with SessionLocal.begin() as db:
            db.execute(
                text(
                    """
                    insert into public.maple_dispatcher_logs
                      (session_id, round_no, user_utterance, assigned_dimension, confidence, reason, metadata)
                    values
                      (:session_id, :round_no, :user_utterance, :assigned_dimension, :confidence, :reason, cast(:metadata as jsonb))
                    """
                ),
                {
                    "session_id": session_id,
                    "round_no": round_no,
                    "user_utterance": user_utterance,
                    "assigned_dimension": assigned_dimension,
                    "confidence": confidence,
                    "reason": reason,
                    "metadata": json.dumps(metadata or {}, ensure_ascii=False),
                },
            )
        return True
    except Exception as exc:
        print(f"Failed to save dispatcher log: {exc}")
        return False


def save_judge_result_db(
    session_id: str,
    scores: Dict[str, Any],
    feedback_text: str,
    reasoning: Optional[Dict[str, Any]] = None,
    radar_data: Optional[List[Any]] = None,
    trajectory_features: Optional[Dict[str, Any]] = None,
    judge_model: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    if not _ensure_db_ready():
        return False
    try:
        with SessionLocal.begin() as db:
            db.execute(
                text(
                    """
                    insert into public.maple_judge_results
                    (
                      session_id,
                      judge_model,
                      know_understand_score,
                      use_apply_score,
                      evaluate_create_score,
                      ethics_score,
                      feedback_text,
                      reasoning_json,
                      radar_data_json,
                      trajectory_features_json,
                      metadata
                    )
                    values
                    (
                      :session_id,
                      :judge_model,
                      :know_understand_score,
                      :use_apply_score,
                      :evaluate_create_score,
                      :ethics_score,
                      :feedback_text,
                      cast(:reasoning_json as jsonb),
                      cast(:radar_data_json as jsonb),
                      cast(:trajectory_features_json as jsonb),
                      cast(:metadata as jsonb)
                    )
                    """
                ),
                {
                    "session_id": session_id,
                    "judge_model": judge_model,
                    "know_understand_score": float(scores.get("know_understand", 0) or 0),
                    "use_apply_score": float(scores.get("use_apply", 0) or 0),
                    "evaluate_create_score": float(scores.get("evaluate_create", 0) or 0),
                    "ethics_score": float(scores.get("ethics", 0) or 0),
                    "feedback_text": feedback_text or "",
                    "reasoning_json": json.dumps(reasoning or {}, ensure_ascii=False),
                    "radar_data_json": json.dumps(radar_data or [], ensure_ascii=False),
                    "trajectory_features_json": json.dumps(trajectory_features or {}, ensure_ascii=False),
                    "metadata": json.dumps(metadata or {}, ensure_ascii=False),
                },
            )
        return True
    except Exception as exc:
        print(f"Failed to save judge result: {exc}")
        return False


def delete_session_db(session_id: str) -> bool:
    """Delete a session and all related logs (cascades via FK ON DELETE CASCADE)."""
    if not _ensure_db_ready():
        print(f"delete_session_db: DB not ready, cannot delete {session_id}")
        return False
    try:
        with SessionLocal.begin() as db:
            # Bypass RLS in case the connecting role is subject to row-level policies
            db.execute(text("SET LOCAL row_security = off"))
            result = db.execute(
                text("DELETE FROM public.maple_sessions WHERE session_id = :sid"),
                {"sid": session_id},
            )
            affected = result.rowcount
        if affected == 0:
            print(f"delete_session_db: session {session_id!r} not found in DB (0 rows deleted)")
            return False
        print(f"delete_session_db: deleted session {session_id!r} ({affected} row)")
        return True
    except Exception as exc:
        print(f"delete_session_db: exception for {session_id!r}: {exc}")
        return False
