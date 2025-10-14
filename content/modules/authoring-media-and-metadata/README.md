---
title: "Media & Metadata: Images, Social Previews, and Tags"
slug: "authoring-media-and-metadata"
difficulty: "intermediate"
estimated_minutes: 25
version: "v0.2"
validated_on: "2025-10-14"
tags:
  - content-authoring
  - media
  - metadata
  - seo
  - social-sharing
description: "Learn how to enhance your learning content with images, social share previews, and effective tagging strategies for the Hedgehog Learn platform."
order: 150
---

# Media & Metadata: Images, Social Previews, and Tags

Enhance your learning content with rich media and effective metadata. This module covers adding images to your content, creating social share previews that look great when shared on Twitter/LinkedIn/Slack, and using tags strategically for discoverability.

## Learning Objectives

- Add images to module content using Markdown syntax
- Create and configure social share images for rich previews
- Test social previews across multiple platforms
- Apply effective tagging strategies for content discovery
- Optimize metadata for SEO and user experience
- Troubleshoot common media and metadata issues

## Prerequisites

- Completion of "Authoring Basics: Modules, Front Matter, and Sync" module
- Basic familiarity with image formats (JPEG, PNG, WebP)
- Access to HubSpot File Manager or external image hosting
- Understanding of Markdown syntax
- Optional: Design tool experience (Canva, Figma, or similar)

## Scenario: Enriching Your Module with Media and Metadata

You've created a module about Kubernetes networking and want to make it more engaging and shareable. You'll add diagrams, create a social share image, optimize your tags, and verify everything renders correctly across platforms.

### Step 1: Understand Image Hosting Options

Before adding images, you need to host them somewhere accessible. You have two primary options:

**Option 1: HubSpot File Manager (Recommended)**

Navigate to HubSpot and upload your image:

```bash
# You'll do this in the HubSpot UI:
# 1. Marketing → Files and Templates → Files
# 2. Click "Upload" and select your image
# 3. Right-click uploaded image → "Copy public URL"
# 4. URL will be: https://hedgehog.cloud/hubfs/...
```

**Option 2: External CDN**

If using an external service like Cloudinary or AWS S3:

```bash
# Upload to your CDN and get public HTTPS URL
# Example URLs:
# https://res.cloudinary.com/your-account/image/upload/diagram.png
# https://your-bucket.s3.amazonaws.com/diagrams/network-flow.png
```

**Requirements for all images:**
- Publicly accessible (no authentication)
- HTTPS URL (not HTTP)
- Reasonable file size (< 2MB for content images)
- Appropriate format (JPEG, PNG, WebP, SVG)

Verify your image URL works:

```bash
# Test the URL is publicly accessible
curl -I https://hedgehog.cloud/hubfs/learn/kubernetes-networking-diagram.png
# Should return: HTTP/2 200
```

### Step 2: Add Images to Module Content

Add images using standard Markdown syntax:

```bash
# Edit your module README.md
cat >> content/modules/kubernetes-networking/README.md << 'EOF'

### Understanding Service Types

Kubernetes offers several service types for different networking needs:

![Kubernetes Service Types](https://hedgehog.cloud/hubfs/learn/k8s-service-types.png)

The diagram above shows:
- **ClusterIP**: Internal-only access
- **NodePort**: External access via node ports
- **LoadBalancer**: Cloud provider load balancer
- **ExternalName**: DNS alias to external service

EOF
```

**Markdown image syntax:**
```markdown
![Alt text description](https://url-to-image.png)
```

**Best practices:**
- **Alt text**: Describe the image for screen readers and SEO
- **Image size**: Keep content images under 500KB (optimize/compress)
- **Placement**: Put images near related text
- **Captions**: Add explanatory text below images when helpful

Verify Markdown syntax:

```bash
# Check image syntax is correct
grep "^!\[" content/modules/kubernetes-networking/README.md
```

### Step 3: Create a Social Share Image

Social share images appear when your content is shared on Twitter, LinkedIn, Facebook, or Slack. They should be eye-catching and branded.

**Image specifications:**
- **Size**: 1200 × 630 pixels (1.91:1 aspect ratio)
- **Format**: JPEG or WebP
- **File size**: < 300 KB
- **Safe zone**: Keep text/logos within center 1200 × 600 pixels

**Design your image** (using Canva, Figma, or similar):

```bash
# Create a new design in your tool:
# - Canvas size: 1200 × 630 pixels
# - Background: Brand colors or relevant imagery
# - Title: Module name (large, readable font 60-80pt)
# - Branding: Hedgehog logo in corner
# - Avoid clutter: Keep it simple and focused
```

**Example design elements:**
- Large title: "Kubernetes Networking"
- Subtitle: "Services, Ingress & Network Policies"
- Hedgehog logo (bottom right corner)
- Tech-themed background or abstract pattern
- High contrast for readability

**Export settings:**
- Format: JPEG
- Quality: 80-90%
- Resolution: 1200 × 630 pixels exactly

### Step 4: Upload and Reference Social Image

Upload your social image to HubSpot:

```bash
# In HubSpot File Manager:
# 1. Upload your social image (e.g., k8s-networking-share.jpg)
# 2. Organize in /learn/ folder
# 3. Copy public URL
```

Add the `social_image` field to your module front matter:

```bash
cat > content/modules/kubernetes-networking/README.md << 'EOF'
---
title: "Kubernetes Networking: Services, Ingress, and Network Policies"
slug: "kubernetes-networking"
difficulty: "intermediate"
estimated_minutes: 35
tags:
  - kubernetes
  - networking
  - services
  - ingress
description: "Master Kubernetes networking concepts including Services, Ingress controllers, and Network Policies for production deployments."
social_image: "https://hedgehog.cloud/hubfs/learn/k8s-networking-share.jpg"
---
EOF
```

**Key points:**
- Field name is `social_image` (not `social_image_url`)
- Use full HTTPS URL
- Image must be publicly accessible
- If omitted, system uses default branded image

Verify front matter syntax:

```bash
# Check social_image field
grep "^social_image:" content/modules/kubernetes-networking/README.md
```

### Step 5: Sync Your Changes

Push your updated module with images and social metadata to HubDB:

```bash
# Run the sync
npm run sync:content
```

Expected output:
```
✓ Updated: Kubernetes Networking: Services, Ingress, and Network Policies
✅ Sync complete! Table published.
```

The sync script:
- Parses `social_image` from front matter
- Converts Markdown to HTML (preserving `<img>` tags)
- Stores social image URL in HubDB column
- Templates use it to generate Open Graph and Twitter Card meta tags

### Step 6: Test Social Preview on Facebook

Use Facebook's debugger to verify your social image appears correctly:

```bash
# Open in browser:
echo "Visit: https://developers.facebook.com/tools/debug/"

# In the debugger:
# 1. Enter: https://hedgehog.cloud/learn/kubernetes-networking
# 2. Click "Debug"
# 3. Check the preview card shows your image
# 4. Verify title and description are correct
```

**What to verify:**
- ✅ Image loads and displays
- ✅ Image is 1200 × 630 pixels (shown in debugger)
- ✅ Title matches your module title
- ✅ Description matches your `description` field
- ✅ No warnings about image size/format

**Common issues:**
- "Could not retrieve data": Image URL not accessible
- "Image too small": Use exactly 1200 × 630 pixels
- "Missing image": Check `social_image` field syntax

If you need to refresh the cache:

```bash
# Click "Scrape Again" in Facebook debugger
# This forces Facebook to fetch fresh data
```

### Step 7: Test Social Preview on Twitter

Verify your Twitter Card renders correctly:

```bash
# Open in browser:
echo "Visit: https://cards-dev.twitter.com/validator"

# In the validator:
# 1. Enter: https://hedgehog.cloud/learn/kubernetes-networking
# 2. Click "Preview card"
# 3. Verify "summary_large_image" card displays
```

**What to check:**
- ✅ Large image card (not small summary)
- ✅ Image fills card width
- ✅ Title and description visible below image
- ✅ No image warnings

Twitter caches aggressively, so updates may take time to appear in real tweets.

### Step 8: Test Social Preview on LinkedIn

LinkedIn has its own post inspector:

```bash
# Open in browser:
echo "Visit: https://www.linkedin.com/post-inspector/"

# In the inspector:
# 1. Enter: https://hedgehog.cloud/learn/kubernetes-networking
# 2. Click "Inspect"
# 3. Verify preview shows your social image
```

LinkedIn uses Open Graph tags like Facebook, so if Facebook preview works, LinkedIn should too.

### Step 9: Test Slack Unfurling

Slack automatically "unfurls" links to show rich previews:

```bash
# In any Slack channel:
# 1. Paste: https://hedgehog.cloud/learn/kubernetes-networking
# 2. Press Enter
# 3. Verify rich preview appears with image
```

**Slack preview includes:**
- Social image (large)
- Module title
- Description
- Site name (Hedgehog Learn)

If preview doesn't appear:
- Check if Slack unfurling is enabled for the channel
- Verify image URL is accessible from Slack's servers
- Try removing and re-pasting the link

### Step 10: Apply Effective Tagging Strategy

Tags help learners discover your content. Add relevant, specific tags:

```yaml
---
tags:
  - kubernetes
  - networking
  - services
  - ingress
  - network-policies
  - cloud-native
---
```

**Tagging best practices:**

**1. Use specific tags:**
```yaml
# ❌ Too generic
tags: [technology, cloud, tutorial]

# ✅ Specific and useful
tags: [kubernetes, networking, services, ingress]
```

**2. Include technology versions (if applicable):**
```yaml
tags: [kubernetes-1.29, docker, containerd]
```

**3. Add skill level indicators:**
```yaml
tags: [kubernetes, intermediate, networking, production]
```

**4. Use consistent naming:**
```yaml
# ✅ Consistent hyphenation
tags: [kubernetes-networking, network-policies, service-mesh]

# ❌ Inconsistent
tags: [kubernetes_networking, network-policies, servicemesh]
```

**5. Limit to 5-8 tags:**
```yaml
# Too many tags dilute effectiveness
# Focus on most relevant terms
```

View existing tags for consistency:

```bash
# See what tags are used across modules
grep -h "^  - " content/modules/*/README.md | sort | uniq -c | sort -rn | head -20
```

### Step 11: Optimize Metadata for SEO

Your `description` field is critical for SEO and social sharing. Optimize it:

```bash
# Check current description length
grep "^description:" content/modules/kubernetes-networking/README.md | wc -c
# Aim for 120-160 characters
```

**Good description example:**
```yaml
description: "Master Kubernetes networking with hands-on labs covering Services, Ingress controllers, and Network Policies for production deployments."
# 140 characters - perfect length
```

**Description best practices:**
- **Length**: 120-160 characters (including field name)
- **Action-oriented**: Start with verbs (Learn, Master, Build, Deploy)
- **Include key terms**: Mention main topics/technologies
- **Avoid jargon**: Clear language for diverse audience
- **No special characters**: Avoid quotes, pipes, or unusual symbols

**Bad description examples:**
```yaml
# ❌ Too short (not descriptive)
description: "Learn about Kubernetes networking."

# ❌ Too long (gets truncated)
description: "This comprehensive module will teach you everything you need to know about Kubernetes networking including Services, Ingress controllers, Network Policies, DNS, and advanced troubleshooting techniques."

# ❌ Not action-oriented
description: "A module about Kubernetes networking concepts."
```

### Step 12: Add Image Compression

Large images slow page load. Compress before uploading:

```bash
# Using ImageMagick (if installed)
convert input.png -quality 85 -resize 800x output.jpg

# Using cwebp for WebP format
cwebp -q 80 input.png -o output.webp

# Online tools alternative:
# - TinyPNG.com
# - Squoosh.app
# - Compressor.io
```

**Target sizes:**
- Content images: < 500 KB
- Social images: < 300 KB
- Icons/logos: < 50 KB

Check image file size:

```bash
ls -lh static/images/kubernetes-networking-diagram.png
# Should show reasonable size like 245K, not 2.1M
```

### Step 13: Verify All Metadata

Check your complete front matter includes all recommended fields:

```bash
cat content/modules/kubernetes-networking/README.md | head -15
```

**Complete metadata example:**
```yaml
---
title: "Kubernetes Networking: Services, Ingress, and Network Policies"
slug: "kubernetes-networking"
difficulty: "intermediate"
estimated_minutes: 35
version: "v1.29"
validated_on: "2025-10-14"
tags:
  - kubernetes
  - networking
  - services
  - ingress
  - network-policies
description: "Master Kubernetes networking with hands-on labs covering Services, Ingress controllers, and Network Policies for production deployments."
social_image: "https://hedgehog.cloud/hubfs/learn/k8s-networking-share.jpg"
order: 200
---
```

**Metadata checklist:**
- ✅ `title` - Clear, descriptive
- ✅ `slug` - Matches directory name
- ✅ `difficulty` - Accurate assessment
- ✅ `estimated_minutes` - Realistic time
- ✅ `tags` - 5-8 relevant, specific tags
- ✅ `description` - 120-160 chars, action-oriented
- ✅ `social_image` - 1200×630, < 300KB, HTTPS URL
- ✅ `version` - Tool/product version (if applicable)
- ✅ `validated_on` - Current date

### Step 14: Verify Live Page Rendering

Visit your module page and verify everything renders correctly:

```bash
echo "Live URL: https://hedgehog.cloud/learn/kubernetes-networking"
echo "Debug URL: https://hedgehog.cloud/learn/kubernetes-networking?debug=1"
```

**Visual verification:**
- ✅ Content images load and display properly
- ✅ Images have appropriate size and quality
- ✅ Alt text is meaningful (check browser inspector)
- ✅ Page loads quickly (< 3 seconds)

**Debug verification:**
- ✅ `has full_content? true`
- ✅ `social_image` field populated in debug output
- ✅ Tags display correctly
- ✅ Metadata fields match front matter

**Browser inspector verification** (View → Developer → Inspect Element):

```html
<!-- Check for meta tags in <head> -->
<meta property="og:image" content="https://hedgehog.cloud/hubfs/learn/k8s-networking-share.jpg">
<meta name="twitter:image" content="https://hedgehog.cloud/hubfs/learn/k8s-networking-share.jpg">
<meta name="twitter:card" content="summary_large_image">
```

If social image meta tags are missing, the template may need updating.

## Concepts & Deep Dive

### Social Sharing Meta Tags

When you add a `social_image` to your front matter, the template generates Open Graph and Twitter Card meta tags:

**Open Graph (Facebook, LinkedIn):**
```html
<meta property="og:image" content="https://hedgehog.cloud/hubfs/learn/your-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:title" content="Your Module Title">
<meta property="og:description" content="Your description...">
<meta property="og:type" content="article">
<meta property="og:url" content="https://hedgehog.cloud/learn/your-slug">
```

**Twitter Cards:**
```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://hedgehog.cloud/hubfs/learn/your-image.jpg">
<meta name="twitter:title" content="Your Module Title">
<meta name="twitter:description" content="Your description...">
```

### Fallback Behavior

If no `social_image` is provided, the system falls back to a default:

```yaml
# No social_image in front matter
---
title: "My Module"
description: "..."
---
```

Templates use the default configured in `constants.json`:
```json
{
  "DEFAULT_SOCIAL_IMAGE_URL": "https://hedgehog.cloud/hubfs/social-share-default.png"
}
```

This ensures every page has a social preview, even without custom images.

### Image Formats Compared

**JPEG:**
- Best for: Photos, complex images
- Pros: Small file size, universal support
- Cons: No transparency, lossy compression

**PNG:**
- Best for: Diagrams, screenshots, images with text
- Pros: Lossless, supports transparency
- Cons: Larger file size

**WebP:**
- Best for: Modern web use, all image types
- Pros: Better compression than JPEG/PNG, supports transparency
- Cons: Older browsers don't support (rare now)

**SVG:**
- Best for: Icons, logos, simple diagrams
- Pros: Scalable, tiny file size
- Cons: Not suitable for complex images

**Recommendation:** Use WebP for social images (best quality/size ratio) and JPEG/PNG for content images based on type.

### Tag Taxonomy Strategy

Effective tagging follows a hierarchy:

**Level 1: Technology/Platform**
```yaml
tags: [kubernetes, docker, aws, azure, terraform]
```

**Level 2: Specific Feature/Topic**
```yaml
tags: [kubernetes-networking, docker-compose, aws-eks, terraform-modules]
```

**Level 3: Use Case/Pattern**
```yaml
tags: [service-mesh, container-orchestration, infrastructure-as-code]
```

**Level 4: Skill/Audience**
```yaml
tags: [beginner, intermediate, advanced, production-ready]
```

Combine 1-2 tags from each level for effective discovery.

### SEO Best Practices

Your metadata directly impacts SEO:

**1. Title Tag (from `title` field):**
- Primary ranking signal
- Keep under 60 characters for display
- Include main keyword near beginning

**2. Meta Description (from `description` field):**
- Doesn't affect ranking but improves click-through
- 120-160 characters optimal
- Include call-to-action

**3. Image Alt Text:**
- Helps image search ranking
- Accessibility requirement
- Describe content, not just keywords

**4. Tags (from `tags` field):**
- Not direct ranking signal but helps categorization
- Use consistent terms across related content
- Align with user search terms

### Platform-Specific Preview Sizes

Different platforms crop/display images differently:

**Facebook/LinkedIn:**
- Displays: 1200 × 630 (full frame)
- Safe zone: Center 1200 × 600
- Mobile: May crop to 1.91:1 ratio

**Twitter:**
- Displays: 1200 × 628 (summary_large_image)
- Ratio: 2:1
- Falls back to smaller card if image missing

**Slack:**
- Displays: Variable (responsive)
- Prefers: 1200 × 630
- Shows description below image

**Design tip:** Keep critical content (text, logos) in the center 1100 × 580 pixel zone to avoid cropping on any platform.

## Troubleshooting

### Social Image Not Appearing

**Symptom:** Preview shows default image instead of custom image

**Cause:** URL not accessible, HTTPS issue, or cache

**Fix:**

```bash
# 1. Test URL directly
curl -I https://hedgehog.cloud/hubfs/learn/your-image.jpg
# Should return 200, not 403 or 404

# 2. Check front matter syntax
grep "^social_image:" content/modules/your-module/README.md
# Should be: social_image: "https://..."

# 3. Re-sync
npm run sync:content

# 4. Clear platform cache
# Use Facebook debugger "Scrape Again" button
```

### Content Images Not Loading

**Symptom:** Broken image icon (alt text visible but no image)

**Cause:** Incorrect URL, missing image, or permission issue

**Fix:**

```bash
# Verify image URL in Markdown
grep "!\[" content/modules/your-module/README.md

# Test each URL
curl -I https://hedgehog.cloud/hubfs/learn/diagram.png
# Should return 200

# Common issues:
# - Wrong path (check spelling)
# - HTTP instead of HTTPS
# - Private file (check HubSpot permissions)
```

### Social Image Too Large

**Symptom:** Facebook debugger warns "Image too large"

**Cause:** File size exceeds platform limits

**Fix:**

```bash
# Check file size
curl -I https://hedgehog.cloud/hubfs/learn/your-image.jpg | grep -i content-length
# Calculate: bytes / 1024 / 1024 for MB

# Compress image
# Use online tools or ImageMagick:
convert input.jpg -quality 80 -resize 1200x630 output.jpg

# Re-upload to HubSpot and update URL
```

Target: < 300 KB for social images

### Blurry or Pixelated Social Image

**Symptom:** Image looks blurry when shared

**Cause:** Wrong dimensions or upscaling

**Fix:**

```bash
# Check actual image dimensions
# Download and check:
curl -o temp.jpg https://hedgehog.cloud/hubfs/learn/your-image.jpg
file temp.jpg
# Should show: 1200 x 630

# If wrong dimensions:
# - Redesign at exactly 1200 × 630 pixels
# - Don't upscale smaller images
# - Export at high quality (80-90% JPEG quality)
```

### Inconsistent Tags Across Modules

**Symptom:** Similar modules use different tag names

**Cause:** Lack of standardization

**Fix:**

```bash
# Audit existing tags
grep -h "^  - " content/modules/*/README.md | sort | uniq

# Create tag standards document or list
# Standardize variations:
#   kubernetes / k8s → kubernetes
#   docker-container / containers → containers
#   net-policy / network-policy → network-policies

# Update modules to use consistent tags
# Re-sync
npm run sync:content
```

### Description Too Long

**Symptom:** Description truncates on social cards

**Cause:** Exceeds 160 character limit

**Fix:**

```bash
# Check length
grep "^description:" content/modules/your-module/README.md | wc -c

# Rewrite to be concise
# Before (too long):
description: "This comprehensive module will teach you everything you need to know about Kubernetes networking including Services, Ingress controllers, Network Policies, and advanced troubleshooting."

# After (just right):
description: "Master Kubernetes networking with hands-on labs covering Services, Ingress controllers, and Network Policies for production."
```

### Alt Text Missing

**Symptom:** Screen readers can't describe images, SEO impact

**Cause:** Empty alt text in Markdown

**Fix:**

```bash
# Find images without alt text
grep "!\[\]" content/modules/your-module/README.md

# Add descriptive alt text
# Before:
![](https://url-to-image.png)

# After:
![Kubernetes Service Types diagram showing ClusterIP, NodePort, LoadBalancer, and ExternalName](https://url-to-image.png)
```

**Alt text guidelines:**
- Describe what the image shows
- Keep under 125 characters
- Don't start with "Image of..." or "Picture of..."
- Include relevant keywords naturally

## Resources

- [Social Images Documentation](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/social-images.md) - Complete social image guide
- [Course Authoring Guide](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/course-authoring.md) - Content authoring reference
- [Open Graph Protocol](https://ogp.me/) - Official OG tag specification
- [Twitter Card Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards) - Twitter card types and validation
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) - Test and refresh Open Graph previews
- [TinyPNG](https://tinypng.com/) - Online image compression
- [Canva](https://www.canva.com/) - Easy social image design tool
- [Squoosh](https://squoosh.app/) - Advanced image compression tool
- [HubSpot File Manager Guide](https://knowledge.hubspot.com/files/upload-and-manage-files) - Using HubSpot for media hosting
