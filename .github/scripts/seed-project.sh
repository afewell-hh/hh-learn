#!/usr/bin/env bash
set -euo pipefail

OWNER=${OWNER:-afewell-hh}
REPO=${REPO:-hh-learn}
PROJECT_NUMBER=${PROJECT_NUMBER:-3}

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN not set" >&2
  exit 1
fi

gh_api() { curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" "$@"; }
gh_gql() { curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" -H "GraphQL-Features: projects_next_graphql" -H "Content-Type: application/json" -d "$1" https://api.github.com/graphql; }

echo "• Resolving project id for $OWNER #$PROJECT_NUMBER"
QUERY=$(cat <<'GQL'
query($login:String!,$number:Int!){
  user(login:$login){
    id
    projectV2(number:$number){ id number url title fields(first:50){ nodes{ __typename ... on ProjectV2FieldCommon{ id name } ... on ProjectV2SingleSelectField{ id name options{ id name } } } } }
  }
}
GQL
)
payload=$(jq -nc --arg login "$OWNER" --argjson number "$PROJECT_NUMBER" --arg query "$QUERY" '{query:$query, variables:{login:$login, number:$number}}')
set +e
resp=$(gh_gql "$payload" || true)
if [[ -n "${resp:-}" ]]; then
  projId=$(echo "$resp" | jq -r '.data.user.projectV2.id' 2>/dev/null || echo "")
else
  projId=""
fi
set -e
if [[ -z "${projId:-}" || "$projId" == "null" ]]; then
  echo "  ! Warning: Could not resolve project via GraphQL. Will create milestones and issues; the workflow should auto-add them to the project."
fi

if [[ -n "${projId:-}" && "$projId" != "null" ]]; then
echo "• Ensuring fields exist"
ensure_single_select(){
  local name=$1; shift; local -a opts=($@)
  if echo "$resp" | jq -e --arg n "$name" '.data.user.projectV2.fields.nodes[] | select(.name==$n)' >/dev/null; then
    echo "  - $name exists"
    return 0
  fi
  # build options JSON
  local opsJson=$(printf '%s\n' "${opts[@]}" | jq -R '{name:.}' | jq -sc '.')
  local q=$(jq -nc --arg pid "$projId" --arg name "$name" --argjson opts "$opsJson" '{query:"mutation($pid:ID!,$name:String!,$opts:[ProjectV2SingleSelectFieldOptionInput!]!){ createProjectV2Field(input:{ projectId:$pid, name:$name, dataType:SINGLE_SELECT, singleSelectOptions:$opts }) { projectV2Field { __typename } } }", variables:{pid:$pid,name:$name,opts:$opts}}')
  gh_gql "$q" >/dev/null || true
}

ensure_iteration(){
  local name=$1
  if echo "$resp" | jq -e --arg n "$name" '.data.user.projectV2.fields.nodes[] | select(.name==$n)' >/dev/null; then
    echo "  - $name exists"
    return 0
  fi
  local q=$(jq -nc --arg pid "$projId" --arg name "$name" '{query:"mutation($pid:ID!,$name:String!){ createProjectV2Field(input:{ projectId:$pid, name:$name, dataType:ITERATION }) { projectV2Field { __typename } } }", variables:{pid:$pid,name:$name}}')
  gh_gql "$q" >/dev/null || true
}

ensure_single_select Status Backlog Ready "In Progress" "In Review" Blocked Done
ensure_single_select Priority P0 P1 P2 P3
ensure_single_select Type feature bug docs content chore
ensure_single_select Area cms-template hubdb-sync lambda analytics docs content
ensure_iteration Iteration
fi

echo "• Creating milestones"
create_milestone(){
  local title=$1 desc=$2
  # find existing
  local existing=$(gh_api "https://api.github.com/repos/$OWNER/$REPO/milestones?state=all" | jq -r --arg t "$title" '.[] | select(.title==$t) | .number' | head -n1)
  if [[ -n "$existing" ]]; then echo "$existing"; return 0; fi
  gh_api -X POST "https://api.github.com/repos/$OWNER/$REPO/milestones" -d "$(jq -nc --arg t "$title" --arg d "$desc" '{title:$t, description:$d}')" | jq -r '.number'
}

MS1=$(create_milestone "v0.1 – Authoring & Dynamic Pages" "Stabilize authoring and dynamic pages per roadmap.")
MS2=$(create_milestone "v0.2 – Structured Media" "Structured media (video/images) pipeline.")
MS3=$(create_milestone "v0.3 – Quizzes & Progress" "Quizzes schema, grading, progress tracking.")
MS4=$(create_milestone "v0.4 – Pathways & Labs" "Pathways and labs relationships & rendering.")
MS5=$(create_milestone "v0.5 – Analytics, A11y, Perf" "Analytics integration, accessibility, performance.")

echo "• Creating epic issues"
create_issue(){
  local title=$1 body=$2 labels=$3 milestone=$4
  gh_api -X POST "https://api.github.com/repos/$OWNER/$REPO/issues" \
    -d "$(jq -nc --arg t "$title" --arg b "$body" --arg l "$labels" --argjson m "$milestone" '{title:$t, body:$b, labels:($l|split(",")), milestone:$m}')"
}

EP1=$(cat <<'TXT'
Epic for roadmap v0.1 – Stabilize Authoring & Dynamic Pages

Outcomes
- Single /learn page using module-page.html for list + detail
- Authoring guide live and enforced by CI
- Labels and Project automations in place

Acceptance Criteria
- [ ] At least 3 modules published via sync
- [ ] Prev/next navigation on detail pages
- [ ] CI green on front-matter validation
TXT
)

EP2=$(cat <<'TXT'
Epic for roadmap v0.2 – Structured Media (Video & Assets)

Outcomes
- Support media (video/image) in front matter → HubDB JSON → rendered block
- Author snippets for YouTube, Vimeo, HubSpot-hosted video

Acceptance Criteria
- [ ] Media JSON synced and rendered on detail pages
- [ ] Backwards compatible with inline Markdown embeds
TXT
)

EP3=$(cat <<'TXT'
Epic for roadmap v0.3 – Quizzes & Progress Tracking

Outcomes
- Define quiz schema and storage in HubDB
- Client UI for quizzes on module pages
- Lambda /quiz/grade computes score; /events/track logs start/complete

Acceptance Criteria
- [ ] One module with a working quiz and recorded completion event
- [ ] Basic results shown to learner (score/pass)
TXT
)

EP4=$(cat <<'TXT'
Epic for roadmap v0.4 – Pathways & Labs

Outcomes
- Pathways (ordered sets of modules) with list/detail pages
- Labs schema and rendering (standalone or embedded)
- Sync supports relationships and ordering

Acceptance Criteria
- [ ] One pathway with 3+ modules rendered with sequence and completion hints
TXT
)

EP5=$(cat <<'TXT'
Epic for roadmap v0.5 – Analytics, Accessibility, Performance

Outcomes
- Behavioral events wired into HubSpot analytics/CRM
- Accessibility sweep on templates (headings, contrast, focus)
- Lazy-load images; code block copy UX

Acceptance Criteria
- [ ] A11y checks pass on key pages; Core Web Vitals acceptable
TXT
)

I1=$(create_issue "Epic: v0.1 – Authoring & Dynamic Pages" "$EP1" "type/feature,epic" "$MS1")
I2=$(create_issue "Epic: v0.2 – Structured Media" "$EP2" "type/feature,epic" "$MS2")
I3=$(create_issue "Epic: v0.3 – Quizzes & Progress" "$EP3" "type/feature,epic" "$MS3")
I4=$(create_issue "Epic: v0.4 – Pathways & Labs" "$EP4" "type/feature,epic" "$MS4")
I5=$(create_issue "Epic: v0.5 – Analytics, A11y, Perf" "$EP5" "type/feature,epic" "$MS5")

if [[ -n "${projId:-}" && "$projId" != "null" ]]; then
echo "• Adding epics to project and setting Status=Backlog, Priority=P1, Type=feature"
add_item(){
  local issueJson=$1
  local number=$(echo "$issueJson" | jq -r '.number')
  local nodeId=$(echo "$issueJson" | jq -r '.node_id')
  # add to project
  local q1=$(jq -nc --arg pid "$projId" --arg cid "$nodeId" '{query:"mutation($pid:ID!,$cid:ID!){ addProjectV2ItemById(input:{projectId:$pid, contentId:$cid}){ item { id } } }", variables:{pid:$pid,cid:$cid}}')
  local r1=$(gh_gql "$q1")
  local itemId=$(echo "$r1" | jq -r '.data.addProjectV2ItemById.item.id')
  # field ids
  local fields=$(gh_gql $(jq -nc --arg pid "$projId" '{query:"query($pid:ID!){ node(id:$pid){ ... on ProjectV2 { fields(first:50){ nodes{ __typename ... on ProjectV2FieldCommon{ id name } ... on ProjectV2SingleSelectField{ id name options{ id name } } } } } } }", variables:{pid:$pid}}'))
  update_select(){
    local field=$1 val=$2
    local fid=$(echo "$fields" | jq -r --arg n "$field" '.data.node.fields.nodes[] | select(.name==$n) | .id')
    local oid=$(echo "$fields" | jq -r --arg n "$field" --arg v "$val" '.data.node.fields.nodes[] | select(.name==$n) | .options[] | select(.name==$v) | .id')
    if [[ -n "$fid" && -n "$oid" ]]; then
      local q=$(jq -nc --arg pid "$projId" --arg iid "$itemId" --arg fid "$fid" --arg oid "$oid" '{query:"mutation($pid:ID!,$iid:ID!,$fid:ID!,$oid:String!){ updateProjectV2ItemFieldValue(input:{projectId:$pid,itemId:$iid,fieldId:$fid,value:{singleSelectOptionId:$oid}}){ projectV2Item{ id } } }", variables:{pid:$pid,iid:$iid,fid:$fid,oid:$oid}}')
      gh_gql "$q" >/dev/null || true
    fi
  }
  update_select Status Backlog
  update_select Priority P1
  update_select Type feature
  echo "  - Linked issue #$number"
}

add_item "$I1"
add_item "$I2"
add_item "$I3"
add_item "$I4"
add_item "$I5"
fi

echo "Seeding complete (project fields skipped=${projId:-none})."
