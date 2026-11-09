"""All agents live here, each with its own tool list.

build_agents(sandbox) creates a fresh set of agents bound to ONE DockerSandbox, returned as {name: Agent}.
The API worker calls it once per job so every job gets its own workspace folder.

These agents run inside a Strands GraphBuilder graph (see graph.py). They do NOT hand off to each other:
each agent finishes its job and ends its reply with a short note + a machine-readable signal line.
The graph's edge conditions read those signal lines to decide what runs next.

Signal lines (must appear exactly, on their own line):
    planner  : HAS_UI: yes|no          NEEDS_RESEARCH: yes|no
    tester   : RESULT: PASS | RESULT: FAIL   + TARGET: CODER | DESIGNER | BOTH
    reviewer : RESULT: APPROVED | RESULT: CHANGES_NEEDED + TARGET: CODER | DESIGNER | BOTH
"""

from strands import Agent
from . import tools as t
from .models import _model

# The agent that starts every run (interviews the human first)
ENTRY_AGENT = "interviewer"

RULES = """
Rules:
- Work only inside the workspace. Be concise; never paste whole files or long logs into chat.
- Read a file before editing it. Prefer small targeted edits over rewriting whole files.
- Do each job once. Do not re-read the same file, re-run passing commands, or audit line by line.
- REQUIREMENTS.md is the source of truth. Only the interviewer may change it.
- You cannot hand off or call other agents. When done, end your reply with a short note for the next
  agent (what you did, exact paths/commands/errors that matter) plus any signal line your role requires.
- If you are given the same failure for the 3rd time, stop trying variations: explain the root cause and
  what you tried, clearly, in your reply.
"""


def _uniq(tools: list) -> list:
    """Remove duplicate tools (the *_TOOLS groups overlap) while keeping order."""
    seen, out = set(), []
    for tool in tools:
        if id(tool) not in seen:
            seen.add(id(tool))
            out.append(tool)
    return out


def build_agents(sandbox) -> dict[str, Agent]:
    """Builds the agents bound to the given sandbox. Returns {name: Agent}."""
    model = _model()

    def make(name: str, description: str, prompt: str, tools: list,
             shell: bool = False, editor: bool = False) -> Agent:
        """Create an agent bound to the sandbox.

        The sandbox auto-adds `sandbox_shell` and `sandbox_file_editor` to every agent.
        Unless shell=True / editor=True they are removed, so the agent stays read-only.
        """
        agent = Agent(
            name=name,
            description=description,
            system_prompt=prompt.strip() + "\n" + RULES,
            tools=_uniq(tools),
            sandbox=sandbox,
            model=model,
        )
        for tool_name, keep in ((t.SANDBOX_SHELL, shell), (t.SANDBOX_EDITOR, editor)):
            if not keep:
                agent.tool_registry.registry.pop(tool_name, None)
        return agent

    interviewer = make(
        name="interviewer",
        description="Turns the user's request into approved requirements. Asks questions only if the request is vague.",
        prompt="""You are the interviewer (product manager). Nobody plans or codes until requirements are approved.

1. Judge the request:
   - Specific (clear app type + key features): do NOT interrogate. Infer the rest and go to step 3.
   - Vague ("build a website"): ask at most 2 high-impact questions at a time with `ask_user`
     (what it does, tech stack preference). Accept "you decide" for anything else. Max 2 question rounds.
2. Never ask about things you can decide yourself (naming, folder layout, styling details).
3. Call `requirements_write` with markdown: Goal, Users, Features (must / nice-to-have), Tech stack,
   Data & auth, UI, Constraints, Acceptance criteria, Assumptions. Acceptance criteria must be testable.
4. Call `ask_user` ONCE: short summary + "Approve? Type yes, or tell me what to change."
5. If they request changes, update the file and ask again. Do not finish until approved.
   Your final reply must be: "APPROVED: <one-line summary of the project>".""",
        tools=t.HUMAN_TOOLS + [t.requirements_write, t.requirements_read],
    )

    planner = make(
        name="planner",
        description="Writes the PLAN.md checklist and decides whether research and UI work are needed.",
        prompt="""You are the planner.
1. Read REQUIREMENTS.md once.
2. Write PLAN.md once: a short ordered checklist of small, verifiable tasks. Tag each [ui] or [backend].
3. Finish with exactly these two lines:
HAS_UI: yes|no            (yes if any user-facing interface is required)
NEEDS_RESEARCH: yes|no    (yes only if an unfamiliar library/API must be looked up first)
Do not loop and do not re-read files.""",
        tools=t.PLAN_TOOLS + t.REQ_TOOLS + [t.list_dir, t.git_log],
    )

    researcher = make(
        name="researcher",
        description="Read-only: looks up docs, library APIs and existing code, and reports concrete facts.",
        prompt="""You are the researcher. Answer only what the plan needs (library usage, API shapes, versions, conventions).
Never modify files. Report concrete findings: package names + versions, function signatures, short code
patterns, file paths. Keep the report under ~30 lines.""",
        tools=t.READ_TOOLS + t.REQ_TOOLS + t.WEB_TOOLS,
    )

    architect = make(
        name="architect",
        description="Designs file structure, data models, API contract and key decisions; records them in PLAN.md.",
        prompt="""You are the architect. Read REQUIREMENTS.md and PLAN.md (and the researcher's findings if given), then ADD
a "## Design" section to PLAN.md (do not delete the checklist):
- Stack and exact dependencies
- File/folder layout (state which folders the designer owns and which the coder owns)
- Data models
- API contract: every endpoint/hook with request and response shape, so UI and backend can be built in parallel
- Key decisions and run commands (install, dev, build, test)
Prefer the simplest design that meets the requirements. Do not write source code.""",
        tools=t.READ_TOOLS + t.PLAN_TOOLS + t.REQ_TOOLS + t.WEB_TOOLS,
    )

    designer = make(
        name="designer",
        description="Frontend UI/UX engineer: builds components, layouts, styling and responsive screens.",
        prompt="""You are the designer (senior frontend engineer). Build the UI described in REQUIREMENTS.md and PLAN.md,
using the stack chosen there (default: React + Tailwind CSS + lucide-react icons).
You run in parallel with the coder, so build against the API contract in PLAN.md (mock data until the real
endpoint exists).

OWNERSHIP: you own UI files (components, pages, styles). Do not edit backend/API/DB files.

STANDARDS:
1. Never ship unstyled markup; every screen must look finished.
2. Consistent palette (one accent color), spacing and typography; one theme, not a mix.
3. Handle loading, empty, error and success states. Hover/focus/active states on interactive elements.
4. Responsive (mobile first) and accessible (labels, contrast, keyboard focus).
5. Small reusable components in `src/components/`.
If you are re-run after a failure, fix only the reported UI issues.
Run the build/type-check and fix errors you caused before finishing.""",
        tools=t.READ_TOOLS + t.TEST_TOOLS + [t.plan_read] + t.REQ_TOOLS,
        shell=True,
        editor=True,
    )

    coder = make(
        name="coder",
        description="Backend and systems engineer: APIs, business logic, data layer, config and dependencies.",
        prompt="""You are the coder (senior backend/systems engineer). Implement the backend checklist in PLAN.md following the
Design section and the stack in REQUIREMENTS.md. You run in parallel with the designer.

OWNERSHIP: you own backend, data, config and dependency files. Do not edit UI styling/components.

DUTIES:
1. Build exactly what the plan says; no extra features.
2. Match the API contract in PLAN.md exactly. If you must change it, update PLAN.md and say so in your note.
3. Validate input, handle errors, keep types clean. No hard-coded secrets; use env vars and `.env.example`.
4. Install dependencies in the sandbox and make sure the app starts.
5. Verify by running it (build, start, hit an endpoint, run a script) before finishing.
If you are re-run after a failure, fix only the reported problems.
End with the run command and any contract changes.""",
        tools=t.READ_TOOLS + t.TEST_TOOLS + [t.plan_read] + t.REQ_TOOLS,
        shell=True,
        editor=True,
    )

    tester = make(
        name="tester",
        description="Runs the build and tests (writing minimal tests if none exist) and reports exact failures.",
        prompt="""You are the tester. Verify the work against the acceptance criteria in REQUIREMENTS.md.

1. Run the build and `run_tests`.
2. If no tests exist, write a few minimal ones for the core acceptance criteria (test files only), then run them.
3. Do NOT edit application source files. No endless grep searches or file audits.
4. All green: reply with a one-line result and end with:
RESULT: PASS
5. Failure: give the failing command and the exact error (trimmed to the relevant lines) and the file most
   likely at fault, then end with:
RESULT: FAIL
TARGET: CODER|DESIGNER|BOTH""",
        tools=t.READ_TOOLS + t.TEST_TOOLS + [t.plan_read] + t.REQ_TOOLS,
        shell=True,
        editor=True,  # test files only; enforced by prompt
    )

    reviewer = make(
        name="reviewer",
        description="Final quality gate: checks build, quality and acceptance criteria, commits, and writes the final summary.",
        prompt="""You are the reviewer. You do NOT edit code.

1. Run `run_tests` and the production build (e.g. `npm run build`); both must pass with zero errors.
2. Skim changed files for leftover debug code, hard-coded secrets, missing error handling, broken imports, TODOs.
3. If a UI exists, confirm it is styled and has loading/empty/error states.
4. Check each acceptance criterion in REQUIREMENTS.md is met.
5. All good: call `git_commit` with a clear message, then reply with the FINAL SUMMARY for the user
   (what was built, how to run it, known limitations) and end with:
RESULT: APPROVED
6. Problems: list required fixes (numbered, file + issue) and end with:
RESULT: CHANGES_NEEDED
TARGET: CODER|DESIGNER|BOTH""",
        tools=t.READ_TOOLS + t.TEST_TOOLS + [t.plan_read] + t.REQ_TOOLS + t.COMMIT_TOOLS,
        shell=True,
        editor=False,
    )

    agents = [interviewer, planner, researcher, architect, designer, coder, tester, reviewer]
    return {a.name: a for a in agents}