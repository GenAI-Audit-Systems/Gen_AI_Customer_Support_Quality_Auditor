import re

def split_transcript_by_speaker(text: str) -> dict:
    """
    Parses a plain text transcript and splits it into a dialogue list.
    Handles formats like:
      Agent: Hello...
      Customer: Hi...
      [Agent]: Hello...
      Agent — Hello...
    """
    dialogue = []
    full_text_parts = []

    # Better to split by speaker boundaries anywhere in the text
    speaker_regex = re.compile(
        r'\[?\b(Agent|Customer|Caller|Representative|Support|Rep|User|Bot)\b\]?\s*[:\-—]',
        re.IGNORECASE
    )
    
    parts = speaker_regex.split(text)
    
    current_speaker = "Unknown"
    current_text = []

    if parts and parts[0].strip() and not speaker_regex.match(parts[0]):
        # The text before the first identified speaker
        current_text.append(parts[0].strip())

    for i in range(1, len(parts), 2):
        speaker_raw = parts[i].strip()
        speech = parts[i + 1].strip() if i + 1 < len(parts) else ""
        
        # Save previous speaker's content if we are moving to a new speaker turn
        if current_speaker != "Unknown" and current_text:
            combined = " ".join(current_text).strip()
            if combined:
                dialogue.append({"speaker": current_speaker, "text": combined})
                full_text_parts.append(f"[{current_speaker}]: {combined}")
            current_text = []

        # Normalize speaker
        s_lower = speaker_raw.lower()
        if s_lower in ("agent", "representative", "support", "rep", "bot"):
            current_speaker = "Agent"
        elif s_lower in ("customer", "caller", "user"):
            current_speaker = "Customer"
        else:
            current_speaker = speaker_raw.title()
            
        current_text.append(speech)

    # Flush last speaker
    if current_speaker != "Unknown" and current_text:
        combined = " ".join(current_text).strip()
        if combined:
            dialogue.append({"speaker": current_speaker, "text": combined})
            full_text_parts.append(f"[{current_speaker}]: {combined}")

    if not dialogue:
        # Fallback if no specific tags found
        return {"full_text": text.strip(), "dialogue": []}

    return {
        "full_text": "\n".join(full_text_parts),
        "dialogue": dialogue
    }
