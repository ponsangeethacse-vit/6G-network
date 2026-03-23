import sys

path = r"d:\Games\Project\ponsangeetha mam project 6gnetwork\6G-network\frontend\src\pages\NetworkDashboardPage.tsx"

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Local declaration lines to move:
# From Step 1109, appendBlockLocal is at index 431 (1-indexed 432)
# appendEvent ends at index 459 (1-indexed 460)
start_idx = 431
end_idx = 460

block_to_move = lines[start_idx:end_idx]

print(f"Moving lines {start_idx} to {end_idx}")
print(f"First line: {block_to_move[0].strip()}")

# Delete
lines[start_idx:end_idx] = []

# Insert top of useEffect
# Step 1112 shows socket = io(...) is at 1-indexed 345 (0-indexed 344)
# We insert at index 345 (just after socket init)
insert_idx = 345

lines[insert_idx:insert_idx] = block_to_move

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Moving completes.")
