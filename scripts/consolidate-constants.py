#!/usr/bin/env python3
"""
Consolidate multiple inline constants blocks into a single definition.
Issue #327 follow-up: Templates should define constants once and reuse it.
"""

import re
import sys
from pathlib import Path

def find_constants_blocks(content):
    """Find all {% set constants = { ... } %} blocks using brace counting."""
    blocks = []
    search_start = 0

    while True:
        # Find next "{% set constants = {"
        match = re.search(r'{%\s*set\s+constants\s*=\s*\{', content[search_start:])
        if not match:
            break

        # Calculate absolute position
        block_start = search_start + match.start()
        dict_start = search_start + match.end()

        # Count braces to find matching closing brace
        brace_count = 1
        pos = dict_start

        while pos < len(content) and brace_count > 0:
            if content[pos] == '{':
                brace_count += 1
            elif content[pos] == '}':
                brace_count -= 1
            pos += 1

        if brace_count != 0:
            print(f"   ⚠️  Warning: Unmatched braces starting at position {block_start}")
            search_start = dict_start
            continue

        # Now find the closing %} after the dictionary
        closing_match = re.match(r'\s*%}', content[pos:])
        if not closing_match:
            print(f"   ⚠️  Warning: No closing %}} found at position {pos}")
            search_start = pos
            continue

        block_end = pos + closing_match.end()

        # Look backwards for the comment block (if it exists)
        # Search up to 200 characters back for the comment
        comment_search_start = max(0, block_start - 200)
        preceding = content[comment_search_start:block_start]
        comment_match = re.search(r'{#\s*Issue #327 Fix[^#]*#}\s*$', preceding)

        if comment_match:
            # Include the comment in the block
            actual_start = comment_search_start + comment_match.start()
        else:
            actual_start = block_start

        blocks.append({
            'start': actual_start,
            'end': block_end,
            'content': content[actual_start:block_end]
        })

        # Continue searching after this block
        search_start = block_end

    return blocks

def consolidate_template(file_path):
    """Remove duplicate constants blocks, keeping only the first one."""
    print(f"\n📄 Processing: {file_path.name}")

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all constants blocks
    blocks = find_constants_blocks(content)

    if len(blocks) <= 1:
        print(f"   ✅ Already consolidated ({len(blocks)} block)")
        return False

    print(f"   Found {len(blocks)} constants blocks:")
    for i, block in enumerate(blocks, 1):
        print(f"      Block {i}: position {block['start']}-{block['end']}")

    # Keep only the first block, remove all others
    # Work backwards to preserve positions
    for i, block in enumerate(reversed(blocks[1:]), 1):
        actual_index = len(blocks) - i
        start = block['start']
        end = block['end']

        # Remove the block and clean up any excessive whitespace
        # Keep newline structure intact but remove the block itself
        before = content[:start]
        after = content[end:]

        # If there's trailing whitespace after the block, preserve one newline
        after_stripped = after.lstrip('\n')
        if after != after_stripped:
            # There were newlines, keep just one
            after = '\n' + after_stripped

        content = before + after
        print(f"   ✅ Removed duplicate block {actual_index + 1} at position {start}")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"   💾 Consolidated to 1 constants block")
    return True

def main():
    templates_dir = Path('clean-x-hedgehog-templates/learn')

    if not templates_dir.exists():
        print(f"❌ Directory not found: {templates_dir}")
        sys.exit(1)

    print("🔧 Consolidating inline constants blocks...")
    print("=" * 60)

    templates = [
        'catalog.html',
        'courses-page.html',
        'module-page.html',
        'my-learning.html',
        'pathways-page.html',
        'register.html'
    ]

    consolidated_count = 0

    for template_name in templates:
        template_path = templates_dir / template_name
        if template_path.exists():
            if consolidate_template(template_path):
                consolidated_count += 1
        else:
            print(f"\n⚠️  Not found: {template_name}")

    print("\n" + "=" * 60)
    print(f"✅ Consolidated {consolidated_count} template(s)")
    print("\n💡 Next steps:")
    print("   1. Review changes: git diff clean-x-hedgehog-templates/learn/")
    print("   2. Validate: npm run validate:inline-constants")
    print("   3. Test templates")

if __name__ == '__main__':
    main()
