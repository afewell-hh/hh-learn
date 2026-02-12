#!/usr/bin/env python3
"""
Fix all templates by replacing invalid request_json usage with inline constants.
Issue #327 - Remove request_json from all templates
"""

import re
import sys
from pathlib import Path

# Inline constants block to use (same as action-runner.html)
INLINE_CONSTANTS = '''    {#
      Issue #327 Fix: Inline constants instead of using request_json (which doesn't exist in HubL)
      HubL cannot fetch/parse JSON files server-side, so we inline the values directly.
      Source: clean-x-hedgehog-templates/config/constants.json
    #}
    {% set constants = {
      'HUBDB_MODULES_TABLE_ID': '135621904',
      'HUBDB_PATHWAYS_TABLE_ID': '135381504',
      'HUBDB_COURSES_TABLE_ID': '135381433',
      'HUBDB_CATALOG_TABLE_ID': '136199186',
      'DEFAULT_SOCIAL_IMAGE_URL': 'https://hedgehog.cloud/hubfs/social-share-default.png',
      'ENABLE_CRM_PROGRESS': true,
      'LOGOUT_URL': '/_hcms/mem/logout',
      'LOGIN_URL': '/_hcms/mem/login',
      'AUTH_LOGIN_URL': 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/login',
      'AUTH_ME_URL': 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/me',
      'AUTH_LOGOUT_URL': 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/logout',
      'TRACK_EVENTS_ENABLED': true,
      'TRACK_EVENTS_URL': 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track',
      'ACTION_RUNNER_URL': '/learn/action-runner'
    } %}'''

# Pattern to match request_json usage
REQUEST_JSON_PATTERN = re.compile(
    r'{%\s*set\s+(\w+)\s*=\s*get_asset_url\(["\'].*?constants\.json["\']\)\s*\|\s*request_json\s*%}',
    re.IGNORECASE
)

def fix_template(file_path):
    """Replace request_json with inline constants in a template."""
    print(f"\n📄 Processing: {file_path.name}")

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Find all matches
    matches = list(REQUEST_JSON_PATTERN.finditer(content))
    print(f"   Found {len(matches)} instance(s) of request_json")

    if not matches:
        return False

    # Replace from end to start to preserve positions
    for match in reversed(matches):
        var_name = match.group(1)
        start, end = match.span()

        # Get the indentation of the original line
        line_start = content.rfind('\n', 0, start) + 1
        indent = content[line_start:start]

        # Only replace if variable name is 'constants' or similar
        if var_name.lower() in ['constants', 'head_constants']:
            # Add proper indentation to inline constants
            indented_constants = INLINE_CONSTANTS.replace('\n    ', '\n' + indent)
            content = content[:start] + indented_constants.lstrip() + content[end:]
            print(f"   ✅ Replaced {var_name} at position {start}")
        else:
            print(f"   ⚠️  Skipped non-standard variable: {var_name}")

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"   💾 Saved changes to {file_path.name}")
        return True

    return False

def main():
    templates_dir = Path('clean-x-hedgehog-templates/learn')

    if not templates_dir.exists():
        print(f"❌ Directory not found: {templates_dir}")
        sys.exit(1)

    print("🔧 Fixing request_json usage in all templates...")
    print("=" * 60)

    templates = list(templates_dir.glob('*.html'))
    fixed_count = 0

    for template in sorted(templates):
        if template.name == 'action-runner.html':
            print(f"\n📄 Skipping: {template.name} (already fixed)")
            continue

        if fix_template(template):
            fixed_count += 1

    print("\n" + "=" * 60)
    print(f"✅ Fixed {fixed_count} template(s)")
    print("\n💡 Next steps:")
    print("   1. Review changes: git diff clean-x-hedgehog-templates/learn/")
    print("   2. Validate: npm run validate:inline-constants")
    print("   3. Test templates in HubSpot")

if __name__ == '__main__':
    main()
