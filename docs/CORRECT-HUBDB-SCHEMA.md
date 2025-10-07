# Correct HubDB Schema - Use HubSpot's Columns!

## You're Right - I Was Wrong!

HubSpot created those columns (Name, Page Path, Page Title) for us to **populate and use**, not to duplicate with custom columns. Much simpler!

## The Actual Correct Schema

### HubSpot System Columns (USE THESE):

| Column | Internal Name | Purpose | We Populate |
|--------|---------------|---------|-------------|
| **Name** | `hs_name` | Display name/title | ✅ YES - "Introduction to Kubernetes" |
| **Page Path** | `hs_path` | URL slug | ✅ YES - "intro-to-kubernetes" |
| **Page Title** | varies | Browser/SEO title | ✅ YES - "Introduction to Kubernetes - Hedgehog Learn" |

### Our Custom Columns:

| Column | Type | Purpose | Required? |
|--------|------|---------|-----------|
| `meta_description` | TEXT | SEO meta description | ✅ Required for metadata mapping |
| `featured_image` | IMAGE | Social sharing image | Recommended |
| `difficulty` | SELECT | beginner/intermediate/advanced | ✅ Yes |
| `estimated_minutes` | NUMBER | Time to complete | ✅ Yes |
| `tags` | TEXT | Comma-separated tags | ✅ Yes |
| `full_content` | RICH TEXT | Module HTML content | ✅ Yes |
| `display_order` | NUMBER | Sort order in list | ✅ Yes |

### What We DON'T Need:

❌ `title` - Use **Name** (hs_name) instead!
❌ `slug` - Use **Page Path** (hs_path) instead!
❌ `canonical_url` - Not needed for simple dynamic pages
❌ `description` - Use **meta_description** for the metadata mapping

## Column Values for Your 3 Modules

### Module 1: intro-to-kubernetes
```
Name (hs_name): "Introduction to Kubernetes"
Page Path (hs_path): "intro-to-kubernetes"
Page Title: "Introduction to Kubernetes - Hedgehog Learn"
meta_description: "Learn Kubernetes fundamentals with hands-on labs. Deploy your first containerized application and master core K8s concepts."
difficulty: 1 (beginner)
estimated_minutes: 30
tags: "kubernetes,containers,orchestration,docker"
full_content: [HTML content from markdown]
display_order: 1
```

### Module 2: kubernetes-storage
```
Name (hs_name): "Kubernetes Storage"
Page Path (hs_path): "kubernetes-storage"
Page Title: "Kubernetes Storage - Hedgehog Learn"
meta_description: "Master Kubernetes storage with persistent volumes, storage classes, and dynamic provisioning in this hands-on lab."
difficulty: 2 (intermediate)
estimated_minutes: 45
tags: "kubernetes,storage,persistent-volumes"
full_content: [HTML content]
display_order: 2
```

### Module 3: kubernetes-networking
```
Name (hs_name): "Kubernetes Networking"
Page Path (hs_path): "kubernetes-networking"
Page Title: "Kubernetes Networking - Hedgehog Learn"
meta_description: "Understand Kubernetes networking with services, ingress, and network policies through practical examples."
difficulty: 2 (intermediate)
estimated_minutes: 45
tags: "kubernetes,networking,services"
full_content: [HTML content]
display_order: 3
```

## Updated Template References

### In List View (showing all modules):
```html
{% for module in modules %}
  <a href="{{ request.path }}/{{ module.hs_path }}">
    <h3>{{ module.hs_name }}</h3>  <!-- Use hs_name, not .title! -->
```

### In Detail View (showing one module):
```html
<h1>{{ dynamic_page_hubdb_row.hs_name }}</h1>
<!-- Not .title - use the HubSpot column! -->
```

## Updated Sync Script Structure

```typescript
const row = {
  name: fm.title,  // Populates "Name" (hs_name) column
  path: (fm.slug || moduleSlug).toLowerCase(),  // Populates "Page Path" (hs_path) column
  values: {
    // NO 'title' here - it's in 'name' at row level!
    meta_description: fm.description || '',
    difficulty: difficultyId,
    estimated_minutes: fm.estimated_minutes || 30,
    tags: Array.isArray(fm.tags) ? fm.tags.join(',') : '',
    full_content: html,
    display_order: fm.order || 999
  }
};
```

**Note**: We might also need to set `childTableId: 0` in the row object for API compatibility.

## Your Current Table - How to Fix

**Option 1: Update Existing Rows**

For each of your 3 manually created rows:

1. Edit the row
2. Fill in the HubSpot columns:
   - **Name**: "Introduction to Kubernetes"
   - **Page Path**: "intro-to-kubernetes" (lowercase!)
   - **Page Title**: "Introduction to Kubernetes - Hedgehog Learn"
3. Your custom columns should already have data
4. Save and publish

**Option 2: Delete Custom Columns If You Created Them**

If you created `title` or `slug` columns:
- Delete them (they duplicate HubSpot columns)
- Keep only: meta_description, difficulty, estimated_minutes, tags, full_content, display_order

## Metadata Mapping in Table Settings

Once you have `meta_description` and `featured_image` columns:

**Table Settings > Metadata**:
- **Meta Description Column**: Select `meta_description`
- **Featured Image Column**: Select `featured_image` (if you added it)
- **Canonical URL Column**: Leave blank or select `hs_path` if it's in dropdown

## How HubSpot Uses These

**Name (hs_name)**:
- Used in template as `{{ module.hs_name }}` or `{{ dynamic_page_hubdb_row.hs_name }}`
- Display title in list and detail views

**Page Path (hs_path)**:
- Used in URLs: `/learn/intro-to-kubernetes`
- Used in template as `{{ module.hs_path }}`
- Must be lowercase, no spaces, URL-safe

**Page Title**:
- Browser tab title
- Used in `<title>` tag automatically
- Can be longer/more SEO-focused than Name

**meta_description**:
- When mapped in settings, becomes `<meta name="description">` tag
- SEO/search engine description

## Comparison to Your Glossary

Your glossary template uses:
```html
{{ dynamic_page_hubdb_row.hs_name }}  ← Term name
{{ item.subtitle }}  ← Custom column
{{ item.body }}  ← Custom column
```

Our learning module should use:
```html
{{ dynamic_page_hubdb_row.hs_name }}  ← Module name
{{ dynamic_page_hubdb_row.difficulty.label }}  ← Custom column
{{ dynamic_page_hubdb_row.full_content }}  ← Custom column
```

**Same pattern!** ✅

## Summary - The Simple Truth

HubSpot created 3 columns for us:
1. **Name** - Use this for display title
2. **Page Path** - Use this for URL slug
3. **Page Title** - Use this for SEO title

Don't create duplicate custom columns - just populate these and add our module-specific columns (difficulty, content, etc.)!

**Much simpler than I made it!** Thanks for catching this. 🙏
