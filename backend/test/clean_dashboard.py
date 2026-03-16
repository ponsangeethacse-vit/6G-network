import sys

path = r"d:\Games\Project\ponsangeetha mam project 6gnetwork\6G-network\frontend\src\pages\NetworkDashboardPage.tsx"

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We want to delete lines 1098 to 1128 (0-indexed: 1097 to 1127)
# Let's double check if 1101 is `<div key={i}` in 0-indexed terms
# In step 743 output:
# 1101 (1-indexed) was `<div key={i}`
# So 1097 in 0-index is 1098 (1-indexed).
# We want to remove lines from index 1097 inclusive down to index 1127 inclusive.
# Wait, 1127 in step 743 is `</div>`
# Let's inspect line content inside Python first and then delete to be safe!

start_idx = 1097
end_idx = 1128 # up to 1129 1-indexed (</div>)

print(f"Start line: {lines[start_idx].strip()}")
print(f"End line: {lines[end_idx].strip()}")

# Delete
del lines[start_idx:end_idx+1]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Done splicing.")
