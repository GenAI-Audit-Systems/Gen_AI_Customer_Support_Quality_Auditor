from processor.utils import split_transcript_by_speaker

test_text = """
[Agent]: Hello, how can I help you?
Customer: I have an issue with my order.
[Agent]: I'm sorry to hear that. What is the order number?
[Unknown]: Let me check.
"""

result = split_transcript_by_speaker(test_text)
print("Dialogue:", result['dialogue'])
assert len(result['dialogue']) == 4
assert result['dialogue'][0]['speaker'] == "Agent"
assert result['dialogue'][1]['speaker'] == "Customer"
assert result['dialogue'][2]['speaker'] == "Agent"
assert result['dialogue'][3]['speaker'] == "Unknown"

print("Success!")
