"""Tools that run through the agent's Strands DockerSandbox (tool_context.agent.sandbox).

No docker code lives here. The sandbox is created once and passed to each Agent (see agents.py).
Full shell + file editing come from the sandbox's built-in tools (sandbox_shell, sandbox_file_editor);
agents.py decides which agents keep them. Everything below is extra, mostly read-only helpers.
"""
import hashlib
import html
import ipaddress
import posixpath
import re
import shlex
import socket
import urllib.parse
import urllib.request

from strands import tool
from strands.sandbox.errors import SandboxTimeoutError
from strands.types.tools import ToolContext

MAX_OUTPUT = 12_000
SANDBOX_SHELL = "sandbox_shell"            # vended by DockerSandbox.get_tools()
SANDBOX_EDITOR = "sandbox_file_editor"     # vended by DockerSandbox.get_tools()

# Folders no search/list tool should ever walk into
_SKIP_DIRS = (".git", "node_modules", "dist", "build", ".next", "__pycache__", ".venv", "venv")

_GITIGNORE_DEFAULTS = [
    "node_modules/", ".env", ".env.*", "!.env.example", "__pycache__/", "*.pyc", ".venv/", "venv/",
    "dist/", "build/", ".next/", ".DS_Store", "*.log",
]


# ---------------------------------------------------------------- helpers
def _trunc(text: str, limit: int = MAX_OUTPUT) -> str:
    """Keep the head and (more of) the tail: errors and summaries are usually at the end."""
    if len(text) <= limit:
        return text
    head, tail = int(limit * 0.3), int(limit * 0.7)
    return text[:head] + f"\n...[truncated {len(text) - limit} chars]...\n" + text[-tail:]


def _wd(ctx: ToolContext) -> str:
    return getattr(ctx.agent.sandbox, "working_dir", None) or "/workspace"


async def _run(ctx: ToolContext, cmd: str, timeout: int = 120):
    """Run a shell command through the agent's sandbox. Returns (exit_code, output)."""
    try:
        r = await ctx.agent.sandbox.execute(cmd, timeout=timeout)
    except SandboxTimeoutError:
        return 124, f"[timed out after {timeout}s]"
    out = r.stdout or ""
    if r.stderr:
        out += ("\n" if out else "") + "[stderr]\n" + r.stderr
    return r.exit_code, _trunc(out)


async def _resolve(ctx: ToolContext, path: str):
    """Jail a path to the sandbox working dir (follows symlinks). Returns (path, error)."""
    wd = _wd(ctx)
    full = posixpath.normpath(posixpath.join(wd, path))
    # Resolve BOTH the target and the working dir, so a symlinked working dir doesn't cause false rejections.
    code, out = await _run(ctx, f"realpath -m -- {shlex.quote(full)} {shlex.quote(wd)}", timeout=10)
    lines = out.strip().splitlines()
    if code != 0 or len(lines) < 2:
        return None, f"ERROR: could not resolve '{path}'"
    resolved, wd_real = lines[0], lines[1]
    if not (resolved == wd_real or resolved.startswith(wd_real.rstrip("/") + "/")):
        return None, f"ERROR: path '{path}' is outside {wd}"
    return resolved, None


def _exclude_find() -> str:
    return " ".join(f"-not -path '*/{d}/*'" for d in _SKIP_DIRS)


def _exclude_grep() -> str:
    return " ".join(f"--exclude-dir={d}" for d in _SKIP_DIRS)


# ------------------------------------------------------------- read tools
@tool(context=True)
async def read_file(tool_context: ToolContext, path: str, start: int = 1, end: int = 0) -> str:
    """Read a text file with line numbers. Optionally limit to lines start..end (end=0 means to the end).
    For big files, read a range instead of the whole file."""
    p, err = await _resolve(tool_context, path)
    if err:
        return err
    start = max(start, 1)
    if end and end < start:
        return "ERROR: end must be >= start"
    code, out = await _run(tool_context, f"test -f {shlex.quote(p)} && grep -Iq . {shlex.quote(p)}; echo $?", timeout=10)
    if out.strip() not in ("0",):
        return f"ERROR: '{path}' is not a readable text file"
    rng = f"{start},{end}p" if end else f"{start},$p"
    code, out = await _run(tool_context, f"set -o pipefail; nl -ba -w6 -s'| ' {shlex.quote(p)} | sed -n '{rng}'")
    return out if code == 0 else f"ERROR: {out}"


@tool(context=True)
async def list_dir(tool_context: ToolContext, path: str = ".") -> str:
    """List files and folders in a directory inside the workspace."""
    p, err = await _resolve(tool_context, path)
    if err:
        return err
    code, out = await _run(tool_context, f"ls -lA {shlex.quote(p)}")
    return out if code == 0 else f"ERROR: {out}"


@tool(context=True)
async def find_files(tool_context: ToolContext, name_pattern: str, path: str = ".") -> str:
    """Find files by name pattern (e.g. '*.py', 'test_*.py'). Skips .git, node_modules and build folders."""
    p, err = await _resolve(tool_context, path)
    if err:
        return err
    cmd = f"find {shlex.quote(p)} -type f -name {shlex.quote(name_pattern)} {_exclude_find()} | head -200"
    return (await _run(tool_context, cmd))[1] or "(no matches)"


@tool(context=True)
async def grep_search(tool_context: ToolContext, pattern: str, path: str = ".") -> str:
    """Search file contents recursively for a text/regex pattern. Returns file:line:match (max 200 lines)."""
    p, err = await _resolve(tool_context, path)
    if err:
        return err
    cmd = f"grep -rnIE {_exclude_grep()} -e {shlex.quote(pattern)} -- {shlex.quote(p)} | head -200"
    return (await _run(tool_context, cmd))[1] or "(no matches)"


@tool(context=True)
async def git_status(tool_context: ToolContext) -> str:
    """Show git status (short format) of the workspace."""
    return (await _run(tool_context, "git status --short --branch"))[1] or "(clean)"


@tool(context=True)
async def git_diff(tool_context: ToolContext, path: str = "") -> str:
    """Show uncommitted changes (staged and unstaged, including new files). Optionally limit to one path."""
    target = ""
    if path:
        p, err = await _resolve(tool_context, path)
        if err:
            return err
        target = f"-- {shlex.quote(p)}"
    cmd = f"git add -N . 2>/dev/null; git diff HEAD {target} 2>/dev/null || git diff {target}"
    return (await _run(tool_context, cmd))[1] or "(no changes)"


@tool(context=True)
async def git_log(tool_context: ToolContext, n: int = 10) -> str:
    """Show the last n commits (one line each)."""
    n = max(1, min(int(n), 100))
    return (await _run(tool_context, f"git log --oneline -n {n}"))[1] or "(no commits)"


# ------------------------------------------------------------- test / build / git
_TEST_CMD = (
    "if [ -f package.json ]; then CI=true npm test --silent; "
    "else pytest -q; fi"
)
_BUILD_CMD = (
    "if [ -f package.json ]; then npm run build; "
    "else python -m compileall -q . && echo 'compiled OK'; fi"
)


@tool(context=True)
async def run_tests(tool_context: ToolContext, command: str = "", timeout: int = 300) -> str:
    """Run the project's tests in the sandbox. Leave `command` empty to auto-detect
    (npm test if package.json exists, else pytest). Returns PASSED, FAILED, or NO_TESTS plus output."""
    code, out = await _run(tool_context, command or _TEST_CMD, timeout=timeout)
    if code == 5 or "no test specified" in out.lower() or "no tests ran" in out.lower():
        return f"NO_TESTS (write some tests first)\n{out}"
    return f"{'PASSED' if code == 0 else f'FAILED (exit {code})'}\n{out}"


@tool(context=True)
async def run_build(tool_context: ToolContext, command: str = "", timeout: int = 300) -> str:
    """Build/compile the project. Leave `command` empty to auto-detect (npm run build, else python compile check).
    Returns BUILD OK or BUILD FAILED plus output."""
    code, out = await _run(tool_context, command or _BUILD_CMD, timeout=timeout)
    return f"{'BUILD OK' if code == 0 else f'BUILD FAILED (exit {code})'}\n{out}"


@tool(context=True)
async def git_commit(tool_context: ToolContext, message: str) -> str:
    """Stage all changes and commit them. Only use after tests pass and the review is approved."""
    if not message.strip():
        return "ERROR: commit message is empty"
    # Make sure secrets and dependency folders can never be committed.
    ignore = "\n".join(_GITIGNORE_DEFAULTS)
    cmd = (
        "git rev-parse --git-dir >/dev/null 2>&1 || git init -q; "
        "touch .gitignore; "
        f"printf '%s\\n' {shlex.quote(ignore)} | while IFS= read -r l; do "
        "grep -qxF -- \"$l\" .gitignore || echo \"$l\" >> .gitignore; done; "
        "git add -A; "
        "if git diff --cached --quiet; then echo 'Nothing to commit.'; exit 0; fi; "
        "git -c user.name=agent -c user.email=agent@local "
        f"commit -q -m {shlex.quote(message)} && git log --oneline -n 1"
    )
    code, out = await _run(tool_context, cmd)
    return out if code == 0 else f"ERROR: {out}"


# ----------------------------------------------------- shared documents
async def _read_doc(ctx: ToolContext, name: str, missing: str) -> str:
    try:
        return await ctx.agent.sandbox.read_text(f"{_wd(ctx)}/{name}")
    except FileNotFoundError:
        return missing
    except Exception as e:  # noqa: BLE001
        # Don't pretend a real error means "file missing"; the agent would overwrite good data.
        return f"ERROR reading {name}: {e}" if "No such file" not in str(e) else missing


async def _write_doc(ctx: ToolContext, name: str, content: str) -> str:
    try:
        await ctx.agent.sandbox.write_text(f"{_wd(ctx)}/{name}", content)
        return f"{name} saved."
    except Exception as e:  # noqa: BLE001
        return f"ERROR: {e}"


@tool(context=True)
async def plan_read(tool_context: ToolContext) -> str:
    """Read the shared task plan (PLAN.md)."""
    return await _read_doc(tool_context, "PLAN.md", "No plan yet.")


@tool(context=True)
async def plan_write(tool_context: ToolContext, content: str) -> str:
    """Overwrite the shared task plan (PLAN.md). Keep it a short markdown checklist; tick items as they finish."""
    return await _write_doc(tool_context, "PLAN.md", content)


@tool(context=True)
async def plan_append(tool_context: ToolContext, content: str) -> str:
    """Append a section to PLAN.md without touching existing content (use this to add a '## Design' section)."""
    current = await _read_doc(tool_context, "PLAN.md", "")
    if current.startswith("ERROR"):
        return current
    return await _write_doc(tool_context, "PLAN.md", current.rstrip() + "\n\n" + content.strip() + "\n")


@tool(context=True)
async def requirements_read(tool_context: ToolContext) -> str:
    """Read REQUIREMENTS.md (the approved app requirements from the user interview)."""
    return await _read_doc(tool_context, "REQUIREMENTS.md", "No REQUIREMENTS.md yet.")


@tool(context=True)
async def requirements_write(tool_context: ToolContext, content: str) -> str:
    """Write the app requirements (REQUIREMENTS.md) gathered from the interview. Overwrites the file."""
    return await _write_doc(tool_context, "REQUIREMENTS.md", content)


# ------------------------------------------------------- human-in-the-loop
@tool(context=True)
async def ask_user(tool_context: ToolContext, question: str, options: list[str] | None = None) -> str:
    """Ask the human ONE question and wait for the answer. Optionally give 2-4 suggested options.
    The run pauses until the human replies; the reply is returned as text."""
    agent = tool_context.agent
    answered = agent.state.get("answered_questions") or 0
    # The index makes repeated questions (e.g. a second "Approve?") a NEW interrupt instead of
    # silently returning the first answer. It only advances after an answer, so resuming reuses the same name.
    name = f"interview-{answered}-" + hashlib.md5(question.encode()).hexdigest()[:8]
    answer = tool_context.interrupt(name, reason={"question": question, "options": options or []})
    agent.state.set("answered_questions", answered + 1)
    return str(answer)


# -------------------------------------------------------------- web tools
class _SafeRedirect(urllib.request.HTTPRedirectHandler):
    """Re-validate every redirect target so a public URL can't bounce us to an internal one."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _check_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _check_url(url: str) -> None:
    """Raise ValueError unless url is http(s) and resolves only to public IPs (blocks SSRF: metadata, localhost, VPC)."""
    u = urllib.parse.urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        raise ValueError("only http(s) URLs are allowed")
    port = u.port or (443 if u.scheme == "https" else 80)
    for info in socket.getaddrinfo(u.hostname, port, proto=socket.IPPROTO_TCP):
        ip = ipaddress.ip_address(info[4][0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
                or ip.is_multicast or ip.is_unspecified):
            raise ValueError("blocked: URL resolves to a non-public address")


def _html_to_text(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style|noscript|svg).*?</\1>", " ", raw)
    raw = re.sub(r"(?s)<!--.*?-->", " ", raw)
    raw = re.sub(r"(?i)</(p|div|li|h[1-6]|tr|pre|br)\s*>|<br\s*/?>", "\n", raw)
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


@tool
def web_fetch(url: str) -> str:
    """Fetch a public web page or docs URL (http/https) and return its readable text.
    Runs on the host, not in the sandbox; private/internal addresses are blocked."""
    try:
        _check_url(url)
        opener = urllib.request.build_opener(_SafeRedirect)
        req = urllib.request.Request(url, headers={"User-Agent": "agent-swarm/1.0"})
        with opener.open(req, timeout=15) as r:
            ctype = r.headers.get("Content-Type", "")
            body = r.read(500_000).decode(r.headers.get_content_charset() or "utf-8", "replace")
        if "html" in ctype.lower():
            body = _html_to_text(body)
        return _trunc(body)
    except Exception as e:  # noqa: BLE001
        return f"ERROR: {e}"


# ------------------------------------------------- tool groups (for agents)
READ_TOOLS = [read_file, list_dir, find_files, grep_search, git_status, git_diff, git_log]
PLAN_TOOLS = [plan_read, plan_write, plan_append]
REQ_TOOLS = [requirements_read]
TEST_TOOLS = [run_tests, run_build]
COMMIT_TOOLS = [git_commit]
HUMAN_TOOLS = [ask_user]
WEB_TOOLS = [web_fetch]