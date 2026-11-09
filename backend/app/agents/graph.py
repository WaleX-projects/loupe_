from strands.multiagent import GraphBuilder
from .factory import ENTRY_AGENT, build_agents  # factory.py = the agents file


def _out(state, node_id: str) -> str:
    """Text output of a finished node, uppercased ('' if it has not run)."""
    res = state.results.get(node_id)
    return str(res.result).upper() if res else ""


def _flag(node_id: str, token: str):
    """Edge condition: node's output contains `token` (e.g. 'HAS_UI: YES')."""
    return lambda state: token in _out(state, node_id)


def _not_flag(node_id: str, token: str):
    return lambda state: token not in _out(state, node_id)


def _route(node_id: str, result: str, target: str):
    """Edge condition: node ended with RESULT: <result> and its TARGET mentions <target>."""
    def cond(state) -> bool:
        text = _out(state, node_id)
        if f"RESULT: {result}" not in text:
            return False
        tail = text.split("TARGET:")[-1] if "TARGET:" in text else ""
        return target in tail or "BOTH" in tail
    return cond


def build_dev_graph(sandbox):
    """Builds and returns the dev graph bound to the given sandbox.

    interviewer -> planner -> (researcher) -> architect -> designer? + coder -> tester -> reviewer
    tester/reviewer failures loop back to coder and/or designer.
    """
    agents = build_agents(sandbox)  # {name: Agent}
    builder = GraphBuilder()

    for name, agent in agents.items():
        builder.add_node(agent, name)

    # 1. Requirements -> plan
    builder.add_edge("interviewer", "planner")

    # 2. Plan -> (optional research) -> architecture
    builder.add_edge("planner", "researcher", condition=_flag("planner", "NEEDS_RESEARCH: YES"))
    builder.add_edge("planner", "architect", condition=_not_flag("planner", "NEEDS_RESEARCH: YES"))
    builder.add_edge("researcher", "architect")

    # 3. Architecture -> backend always, UI only if the plan has one (they run in parallel)
    builder.add_edge("architect", "coder")
    builder.add_edge("architect", "designer", condition=_flag("planner", "HAS_UI: YES"))

    # 4. Build -> test
    builder.add_edge("coder", "tester")
    builder.add_edge("designer", "tester")

    # 5. Test -> review, or back to whoever owns the failure
    builder.add_edge("tester", "reviewer", condition=_flag("tester", "RESULT: PASS"))
    builder.add_edge("tester", "coder", condition=_route("tester", "FAIL", "CODER"))
    builder.add_edge("tester", "designer", condition=_route("tester", "FAIL", "DESIGNER"))

    # 6. Review -> done (reviewer's reply is the final summary), or back for fixes
    builder.add_edge("reviewer", "coder", condition=_route("reviewer", "CHANGES_NEEDED", "CODER"))
    builder.add_edge("reviewer", "designer", condition=_route("reviewer", "CHANGES_NEEDED", "DESIGNER"))

    builder.set_entry_point(ENTRY_AGENT)

    # Safety limits (loops need more headroom than a straight line)
    builder.reset_on_revisit(True)       # re-run nodes start fresh when a loop revisits them
    builder.set_execution_timeout(3600)  # whole run
    builder.set_node_timeout(900)        # any single node
    builder.set_max_node_executions(40)  # hard cap on total node runs (stops endless fix loops)

    return builder.build()