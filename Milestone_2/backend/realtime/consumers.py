# ══════════════════════════════════════════════════════════════════════
# Django Channels WebSocket Consumer — Real-Time Audit Stream
# Route: ws/audit/<session_id>/
# Each message = one conversation turn; responds with streaming audit tokens
# Session memory: rolling 10-turn context in Redis (TTL 4h)
# ══════════════════════════════════════════════════════════════════════
import json
import time

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class AuditStreamConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for live per-turn audit streaming.
    Connect: wss://<backend>/ws/audit/<session_id>/?agent_id=<id>
    """

    async def connect(self):
        self.session_id  = self.scope["url_route"]["kwargs"]["session_id"]
        self.agent_id    = self.scope.get("query_string", b"").decode()
        # Parse agent_id from query string
        for part in self.agent_id.split("&"):
            if part.startswith("agent_id="):
                self.agent_id = part.split("=", 1)[1]
                break
        else:
            self.agent_id = "unknown"

        self.room_group = f"session_{self.session_id}"
        self.supervisor_group = "supervisors_all"

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.channel_layer.group_add(self.supervisor_group, self.channel_name)
        await self.accept()
        await self.send_json({
            "event": "connected",
            "session_id": self.session_id,
            "agent_id":   self.agent_id,
            "message":    "Real-time audit stream connected.",
        })

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group,       self.channel_name)
        await self.channel_layer.group_discard(self.supervisor_group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        """
        Each message from the client:
        { "turn_text": "...", "audit_id": 0, "tenant_id": "default" }
        """
        turn_text = content.get("turn_text", "").strip()
        audit_id  = content.get("audit_id",  0)
        tenant_id = content.get("tenant_id", "default")

        if not turn_text:
            await self.send_json({"event": "error", "message": "turn_text required"})
            return

        # 1. Quick risk assessment (sync function called via thread)
        from asgiref.sync import sync_to_async
        from rag.rag_engine import get_engine

        engine = get_engine()
        risk = await sync_to_async(engine.predict_compliance_risk)(turn_text)
        await self.send_json({"event": "risk_update", "data": risk})

        # 2. Store turn in Milvus (async, fire-and-forget via engine)
        await sync_to_async(engine.store_conversation_turn)(
            audit_id, self.agent_id, turn_text, self.session_id
        )

        # 3. Stream LLM tokens back
        from rag.llm_provider import llm_stream
        aug_prompt, policy_chunks = await sync_to_async(
            engine.augmented_audit_prompt
        )(turn_text, tenant_id, k=3)

        await self.send_json({"event": "policy_context", "data": policy_chunks})

        # 10-point Enterprise Policy Context for real-time awareness
        ENTERPRISE_SOP = """
        1. Greeting: Must be polite and offer immediate assistance.
        2. Empathy: Must acknowledge customer frustration with concern.
        3. Verification: Must verify identity before account changes.
        4. Returns: 7-day window for all items; exchange/credit only after.
        5. Ethics: No bribes, no personal info requests.
        6. De-escalation: Must offer manager callback for 3+ complaints.
        7. Transparency: Must explain all fees and timelines clearly.
        8. Resolution: Must take ownership of the issue until solved.
        9. Closure: Must ask 'Is there anything else I can help with?'
        10. Privacy/PII: Mask all PII; do not repeat passwords or card #s.
        """

        messages = [
            {"role": "system", "content": (
                "You are an ENTERPRISE REAL-TIME QA AUDITOR. "
                "Analyze the current utterance against the Company SOP below.\n\n"
                f"COMPANY SOP:\n{ENTERPRISE_SOP}\n\n"
                "STRICT JSON OUTPUT FORMAT:\n"
                "{\n"
                '  "event": "UTTERANCE_SCORED",\n'
                '  "speaker": "AGENT|CUSTOMER",\n'
                '  "scores": { "empathy": 1-10, "professionalism": 1-10, "compliance": 1-10 },\n'
                '  "flags": ["Specific policy name breached or NO_VIOLATIONS"],\n'
                '  "violation_detected": true|false,\n'
                '  "severity": "LOW|MEDIUM|HIGH|CRITICAL",\n'
                '  "justification": "Brief 1-sentence explanation of the score/flag."\n'
                "}\n"
            )},
            {"role": "user", "content": f"Audit this turn (Context enabled):\n{aug_prompt}"},
        ]
        
        from rag.llm_provider import llm_complete
        import json
        
        result_str = await sync_to_async(llm_complete)(messages, temperature=0.2)
        
        try:
            result = json.loads(result_str)
        except Exception:
            # Fallback
            result = {
                "event": "UTTERANCE_SCORED",
                "speaker": "UNKNOWN",
                "text": turn_text[:100],
                "scores": {"empathy": 5, "professionalism": 5, "compliance": 5},
                "flags": [],
                "violation_detected": False,
                "severity": "LOW"
            }
            
        # Send UTTERANCE_SCORED
        await self.send_json({
            "type": "UTTERANCE_SCORED",
            "data": result
        })
        
        # Send VIOLATION_DETECTED if applicable
        if result.get("violation_detected"):
            await self.send_json({
                "type": "VIOLATION_DETECTED",
                "data": result
            })
            
        buffer = json.dumps(result)

        # 4. Compliance flag
        if risk.get("risk_level") in ("CRITICAL", "WARNING"):
            flag = {
                "event":      "compliance_flag",
                "severity":   risk["risk_level"],
                "flags":      risk.get("flags", []),
                "session_id": self.session_id,
                "agent_id":   self.agent_id,
            }
            await self.send_json(flag)
            # Broadcast to supervisor room
            await self.channel_layer.group_send(
                self.supervisor_group,
                {"type": "supervisor.alert", **flag},
            )

        # 5. Broadcast score update to supervisor room
        await self.channel_layer.group_send(
            self.supervisor_group,
            {
                "type":       "supervisor.score_update",
                "session_id": self.session_id,
                "agent_id":   self.agent_id,
                "risk_score": risk.get("risk_score", 0),
                "timestamp":  int(time.time()),
            },
        )

        await self.send_json({"event": "turn_complete", "buffer_length": len(buffer)})

    # ── Supervisor broadcast handlers ──────────────────────────────────
    async def supervisor_alert(self, event):
        await self.send_json(event)

    async def supervisor_score_update(self, event):
        await self.send_json(event)


# ──────────────────────────────────────────────────────────────────────
# Supervisor Dashboard Consumer
# Route: ws/supervisor/<room_id>/
# ──────────────────────────────────────────────────────────────────────
class SupervisorConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.group   = f"supervisor_{self.room_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.channel_layer.group_add("supervisors_all", self.channel_name)
        await self.accept()
        await self.send_json({"event": "supervisor_connected", "room": self.room_id})

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group,           self.channel_name)
        await self.channel_layer.group_discard("supervisors_all",    self.channel_name)

    async def receive_json(self, content, **kwargs):
        pass  # Supervisors are read-only on this channel

    async def supervisor_alert(self, event):
        await self.send_json(event)

    async def supervisor_score_update(self, event):
        await self.send_json(event)
