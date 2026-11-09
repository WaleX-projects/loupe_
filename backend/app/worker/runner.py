import logging

from strands.multiagent import Status
from strands.sandbox.docker import DockerSandbox

from app.agents.graph import build_dev_graph
from app.api.ws.pump import EventPump
from app.sandbox.workspace_manager import workspace_manager
from app.services.redis_client import redis_client

logger = logging.getLogger("LoupeWorker")

# Paused graphs kept in memory between run and resume
_ACTIVE_GRAPHS: dict = {}


def _interrupt_key(project_id: str) -> str:
    return f"project:interrupt_id:{project_id}"


class TaskRunner:
    # ───────────── shared streaming ─────────────
    @staticmethod
    async def _stream(graph, pump: EventPump, task):
        """Stream a graph run (or resume) and map Strands events to the WS protocol."""
        seen_tools: set[str] = set()  # current_tool_use fires on every delta; emit once per id
        result = None  # the final MultiAgentResult: it carries the status and any interrupts

        async for event in graph.stream_async(task):
            if not isinstance(event, dict):
                continue

            etype = event.get("type")

            if etype == "multiagent_node_start":
                node_id = event.get("node_id")
                await pump.emit(
                    "node_start",
                    f"Agent node '{node_id}' started working.",
                    {"node_id": node_id, "node_type": event.get("node_type")},
                )

            elif etype == "multiagent_node_stream":
                node_id = event.get("node_id")
                inner = event.get("event") or {}

                # Text chunks (message is the raw chunk: do NOT strip it on the client)
                if "data" in inner:
                    await pump.emit("agent_stream", inner["data"], {"node_id": node_id})

                # Tool calls live on the *inner* event inside a graph stream
                tool = inner.get("current_tool_use")
                if tool and tool.get("name"):
                    tool_id = tool.get("toolUseId")
                    if tool_id not in seen_tools:
                        seen_tools.add(tool_id)
                        await pump.emit(
                            "tool_activity",
                            f"Executing tool: {tool['name']}",
                            {
                                "node_id": node_id,
                                "tool_name": tool["name"],
                                "tool_use_id": tool_id,
                            },
                        )

                # Completed messages carry the full tool input and the tool results
                msg = inner.get("message")
                if isinstance(msg, dict):
                    for block in msg.get("content") or []:
                        if not isinstance(block, dict):
                            continue
                        tu = block.get("toolUse")
                        if tu:
                            await pump.emit(
                                "tool_activity",
                                f"Tool: {tu.get('name')}",
                                {
                                    "node_id": node_id,
                                    "tool_name": tu.get("name"),
                                    "tool_use_id": tu.get("toolUseId"),
                                    "tool_input": tu.get("input"),
                                },
                            )
                        tr = block.get("toolResult")
                        if tr:
                            text = "\n".join(
                                c.get("text", "")
                                for c in tr.get("content") or []
                                if isinstance(c, dict)
                            )[:2000]
                            await pump.emit(
                                "tool_result",
                                "Tool finished",
                                {
                                    "node_id": node_id,
                                    "tool_use_id": tr.get("toolUseId"),
                                    "is_error": tr.get("status") == "error",
                                    "output": text,
                                },
                            )

            elif etype == "multiagent_node_stop":
                node_id = event.get("node_id")
                await pump.emit(
                    "node_complete",
                    f"Agent node '{node_id}' finished task.",
                    {"node_id": node_id, "status": "success"},
                )

            elif etype == "multiagent_result":
                result = event.get("result")

            elif etype == "multiagent_handoff":
                await pump.emit(
                    "agent_handoff",
                    "Handoff between graph nodes.",
                    {
                        "from_nodes": event.get("from_node_ids"),
                        "to_nodes": event.get("to_node_ids"),
                        "message": event.get("message"),
                    },
                )

        return result

    @staticmethod
    async def _finish(project_id: str, graph, result, pump: EventPump, resumed: bool) -> None:
        """Emit interrupted / completed depending on where the graph ended up."""
        # The status lives on the final result event, not on the graph object
        status = getattr(result, "status", None) or getattr(
            getattr(graph, "state", None), "status", None
        )
        logger.info("Graph finished with status=%s", status)

        if status == Status.INTERRUPTED:
            raw = getattr(result, "interrupts", None) or getattr(graph, "interrupts", None) or []
            interrupts = []
            for it in raw:
                await redis_client.set(_interrupt_key(project_id), it.id)
                interrupts.append(
                    {"interruptId": it.id, "name": it.name, "reason": it.reason}
                )
            await pump.emit(
                "job_interrupted",
                "Graph paused for human approval.",
                {"interrupts": interrupts, "status": "interrupted"},
            )
            return

        _ACTIVE_GRAPHS.pop(project_id, None)
        await redis_client.delete(_interrupt_key(project_id))
        await pump.emit(
            "job_completed",
            "Resumed graph execution completed successfully."
            if resumed
            else "Graph execution completed successfully.",
            {"status": "success"},
        )

    # ───────────── entry points ─────────────
    @staticmethod
    async def run_job(project_id: str, prompt: str):
        pump = EventPump(project_id)
        try:
            await pump.emit("job_started", f"Provisioning workspace for project {project_id}...")

            container_id, _host_path = workspace_manager.provision(project_id)
            await pump.emit(
                "sandbox_ready",
                "Container and volume provisioned.",
                {"container_id": container_id},
            )

            sandbox = DockerSandbox(container_id, working_dir="/workspace", user="1000:1000")
            graph = build_dev_graph(sandbox)
            _ACTIVE_GRAPHS[project_id] = graph

            await pump.emit("agents_active", "Graph agents loaded and initialized.")
            await pump.emit("execution_running", "Agent graph workflow started...")

            result = await TaskRunner._stream(graph, pump, prompt)
            await TaskRunner._finish(project_id, graph, result, pump, resumed=False)

        except Exception as e:
            _ACTIVE_GRAPHS.pop(project_id, None)
            await pump.emit("job_failed", f"An error occurred during execution: {e}")
            raise

    @staticmethod
    async def resume_job(project_id: str, user_input: str):
        pump = EventPump(project_id)
        try:
            await pump.emit("job_resumed", "Resuming with your response...")

            interrupt_id = await redis_client.get(_interrupt_key(project_id))
            if not interrupt_id:
                raise ValueError(f"No pending interrupt found for project {project_id}")
            if isinstance(interrupt_id, bytes):
                interrupt_id = interrupt_id.decode("utf-8")

            graph = _ACTIVE_GRAPHS.get(project_id)
            if not graph:
                raise ValueError(
                    f"No active graph in memory for project {project_id}. Worker may have restarted."
                )

            responses = [
                {"interruptResponse": {"interruptId": interrupt_id, "response": user_input}}
            ]

            # Was `graph(responses)`: a blocking sync call that froze the event loop
            # and streamed nothing. Stream it the same way as a fresh run.
            result = await TaskRunner._stream(graph, pump, responses)
            await TaskRunner._finish(project_id, graph, result, pump, resumed=True)

        except Exception as e:
            _ACTIVE_GRAPHS.pop(project_id, None)
            await pump.emit("job_failed", f"An error occurred while resuming: {e}")
            raise