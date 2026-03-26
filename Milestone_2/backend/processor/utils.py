import re

def split_transcript_by_speaker(text: str) -> dict:
    """
    Parses a plain text transcript and splits it into a dialogue list
    based on speaker labels like [Agent]: or Customer:.
    """
    # Regex to match patterns like [Speaker]: or Speaker: at the start of a line or after a newline
    # Patterns: [Agent], Agent:, [Customer], Customer:, [Unknown]:, etc.
    pattern = r'(?:^|\n)(?:\[?([\w\s]+)\]?:\s*)'
    
    parts = re.split(pattern, text)
    
    # re.split with capturing groups returns [prefix, group1, content1, group2, content2, ...]
    # If the text starts with a speaker, the first element (prefix) will be empty.
    
    dialogue = []
    full_text_parts = []
    
    # First part is text before any speaker label (if any)
    initial_text = parts[0].strip()
    if initial_text:
        dialogue.append({"speaker": "Unknown", "text": initial_text})
        full_text_parts.append(f"[Unknown]: {initial_text}")

    # Iterate through speaker/text pairs
    for i in range(1, len(parts), 2):
        speaker = parts[i].strip()
        message = parts[i+1].strip() if i+1 < len(parts) else ""
        
        if speaker and message:
            dialogue.append({"speaker": speaker, "text": message})
            full_text_parts.append(f"[{speaker}]: {message}")

    if not dialogue:
        # Fallback for plain text without labels
        return {"full_text": text, "dialogue": [{"speaker": "Unknown", "text": text}]}

    return {
        "full_text": "\n".join(full_text_parts),
        "dialogue": dialogue
    }
