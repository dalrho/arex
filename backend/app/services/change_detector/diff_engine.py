import difflib
from typing import Dict, List

def compute_content_diff(old_content: str, new_content: str) -> Dict[str, List[str]]:
    """
    Compares two string inputs line by line and identifies additions/deletions.
    Matches format expected by the remediation and poller pipelines.
    """
    old_lines = [line.rstrip() for line in old_content.splitlines()]
    new_lines = [line.rstrip() for line in new_content.splitlines()]
    
    diff = list(difflib.ndiff(old_lines, new_lines))
    
    added = []
    removed = []
    
    for line in diff:
        if line.startswith("+ "):
            added.append(line[2:])
        elif line.startswith("- "):
            removed.append(line[2:])
            
    return {
        "added": added,
        "removed": removed
    }
