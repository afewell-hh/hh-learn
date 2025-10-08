#!/usr/bin/env node
import fs from 'node:fs';

const GQL = 'https://api.github.com/graphql';
const REST = 'https://api.github.com';
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error('GITHUB_TOKEN not set in environment');
  process.exit(1);
}

const ownerLogin = process.env.PROJECT_OWNER || 'afewell-hh';
const repoOwner = 'afewell-hh';
const repoName = 'hh-learn';
const title = process.env.PROJECT_TITLE || 'HHL – Hedgehog Learn';
const desc = process.env.PROJECT_DESC || 'Project board for Hedgehog Learn (HHL): authoring, templates, sync, and backend.';

async function gql(query, variables = {}) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'GraphQL-Features': 'projects_next_graphql',
      'User-Agent': 'hhl-setup-script',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data;
}

async function rest(method, path, body) {
  const res = await fetch(`${REST}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'hhl-setup-script',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${method} ${path} => ${res.status}: ${t}`);
  }
  return res.json().catch(() => ({}));
}

async function main() {
  let ownerId, ownerUsed = ownerLogin;
  try {
    const user = await gql(`query($login:String!){ user(login:$login){ id login } }`, { login: ownerLogin });
    ownerId = user.user?.id;
  } catch {}
  if (!ownerId) {
    const viewer = await gql(`query{ viewer{ id login } }`);
    ownerId = viewer.viewer.id;
    ownerUsed = viewer.viewer.login;
  }

  const created = await gql(
    `mutation($owner:ID!,$title:String!,$desc:String){
       createProjectV2(input:{ownerId:$owner,title:$title,shortDescription:$desc}){
         projectV2 { id number title url }
       }
     }`,
    { owner: ownerId, title, desc }
  );
  const project = created.createProjectV2.projectV2;

  await gql(
    `mutation($projectId:ID!){
       createProjectV2Field(input:{
         projectId:$projectId,
         name:"Status",
         dataType:SINGLE_SELECT,
         singleSelectOptions:[
           {name:"Backlog"},{name:"Ready"},{name:"In Progress"},{name:"In Review"},{name:"Blocked"},{name:"Done"}
         ]
       }){ projectV2Field { __typename } }
     }`,
    { projectId: project.id }
  ).catch((e) => {
    console.warn('Warning: could not create Status field:', String(e));
  });

  // Set repo variables for workflows
  await rest('PUT', `/repos/${repoOwner}/${repoName}/actions/variables/PROJECT_OWNER`, { name: 'PROJECT_OWNER', value: ownerUsed }).catch(() => {});
  await rest('PUT', `/repos/${repoOwner}/${repoName}/actions/variables/PROJECT_NUMBER`, { name: 'PROJECT_NUMBER', value: String(project.number) }).catch(() => {});
  await rest('PUT', `/repos/${repoOwner}/${repoName}/actions/variables/PROJECT_STATUS_FIELD`, { name: 'PROJECT_STATUS_FIELD', value: 'Status' }).catch(() => {});

  console.log('Created GitHub Project');
  console.log(`Title: ${project.title}`);
  console.log(`Number: ${project.number}`);
  console.log(`URL: ${project.url}`);
}

main().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
