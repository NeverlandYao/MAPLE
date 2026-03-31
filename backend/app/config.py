from pathlib import Path

from dotenv import load_dotenv


def load_backend_env() -> None:
    """
    Ensure backend/.env is loaded no matter where the process is started from.
    """
    backend_dir = Path(__file__).resolve().parents[1]
    backend_env = backend_dir / ".env"
    if backend_env.exists():
        load_dotenv(dotenv_path=backend_env)
    else:
        # Fallback to default dotenv discovery for compatibility.
        load_dotenv()
