# Social Share Images for Learn Content

## Overview

Social share images enhance the appearance of your content when shared on social media platforms like Twitter, Facebook, LinkedIn, and Slack. These images appear in rich preview cards alongside your title and description.

## Image Specifications

### Recommended Dimensions
- **Size**: 1200 × 630 pixels (1.91:1 aspect ratio)
- **Format**: JPEG or WebP
- **File Size**: < 300 KB (smaller is better for faster loading)
- **Safe Zone**: Keep important content within the center 1200 × 600 pixels to avoid cropping

### Platform Variations
- **Twitter**: 1200 × 628 pixels (2:1 ratio)
- **Facebook/LinkedIn**: 1200 × 630 pixels (1.91:1 ratio)
- **Open Graph**: 1200 × 630 pixels is the standard

> **Note**: The 1200 × 630 pixel size works well across all major platforms.

---

## Adding Social Images to Content

### Modules (Markdown Front Matter)

Add a `social_image` field to your module's front matter:

```yaml
---
title: "Introduction to Kubernetes"
slug: "intro-to-kubernetes"
difficulty: "beginner"
estimated_minutes: 25
description: "Learn the fundamentals of Kubernetes..."
tags:
  - kubernetes
  - containers
social_image: "https://hedgehog.cloud/hubfs/learn/intro-kubernetes-share.jpg"
---
```

### Courses (JSON)

Add a `social_image` field to your course JSON file:

```json
{
  "slug": "kubernetes-fundamentals",
  "title": "Kubernetes Fundamentals",
  "meta_description": "Master Kubernetes fundamentals...",
  "summary_markdown": "This course covers...",
  "modules": ["intro-to-kubernetes", "kubernetes-storage", "kubernetes-networking"],
  "social_image": "https://hedgehog.cloud/hubfs/learn/k8s-fundamentals-share.jpg",
  "display_order": 1
}
```

### Pathways (JSON)

Add a `social_image` field to your pathway JSON file:

```json
{
  "slug": "ai-networking-basics",
  "title": "AI Networking Basics",
  "meta_description": "Start your journey...",
  "summary_markdown": "This pathway covers...",
  "modules": ["intro-to-kubernetes", "kubernetes-networking"],
  "social_image": "https://hedgehog.cloud/hubfs/learn/ai-networking-share.jpg",
  "display_order": 1
}
```

---

## Fallback Behavior

If no `social_image` is provided, the system automatically falls back to the default branded image:

- **Default Image**: `https://hedgehog.cloud/hubfs/social-share-default.png`
- **Configured In**: `clean-x-hedgehog-templates/config/constants.json` (field: `DEFAULT_SOCIAL_IMAGE_URL`)

This ensures all pages have a social image, even if a custom one isn't specified.

---

## Image Hosting

### Option 1: HubSpot File Manager (Recommended)
1. Upload your image to HubSpot File Manager
2. Navigate to **Marketing** → **Files and Templates** → **Files**
3. Upload your image (JPEG or WebP)
4. Right-click the image → **Copy public URL**
5. Use this URL in your front matter or JSON

**Example URL**: `https://hedgehog.cloud/hubfs/learn/module-name-share.jpg`

### Option 2: External CDN
You can also use external image hosting services:
- Cloudinary
- imgix
- AWS S3 + CloudFront
- Any public CDN

**Requirements**:
- Image must be publicly accessible (no authentication)
- HTTPS URL required
- Reliable uptime and fast delivery

---

## Testing Your Social Images

### 1. Facebook/Open Graph Debugger
**URL**: https://developers.facebook.com/tools/debug/

1. Enter your Learn page URL (e.g., `https://hedgehog.cloud/learn/intro-to-kubernetes`)
2. Click "Debug"
3. Verify the image appears correctly
4. Check for any warnings or errors

### 2. Twitter Card Validator
**URL**: https://cards-dev.twitter.com/validator

1. Enter your Learn page URL
2. Click "Preview card"
3. Verify the summary_large_image card displays correctly

### 3. LinkedIn Post Inspector
**URL**: https://www.linkedin.com/post-inspector/

1. Enter your Learn page URL
2. Click "Inspect"
3. Verify the preview shows your image

### 4. Slack Unfurling
Simply paste your Learn page URL into a Slack channel and verify the rich preview appears with your image.

---

## Image Design Tips

### Content Recommendations
- **Include branding**: Hedgehog logo in a corner
- **Clear title**: Large, readable text (60-80pt font)
- **Visual hierarchy**: Title > subtitle > supporting graphics
- **Color contrast**: Ensure text is readable against background
- **Avoid clutter**: Keep design simple and focused

### Design Tools
- **Canva**: Easy templates for social media images
- **Figma**: Professional design tool with templates
- **Adobe Express**: Quick social media graphics
- **Photoshop/GIMP**: Full-featured image editors

### Template Sizes (in design tools)
- **Canvas**: 1200 × 630 pixels
- **Resolution**: 72 DPI (web standard)
- **Color Mode**: RGB

---

## Example Markup Generated

When you add a social image, the templates automatically generate these meta tags:

```html
<!-- Open Graph -->
<meta property="og:image" content="https://hedgehog.cloud/hubfs/learn/intro-kubernetes-share.jpg">

<!-- Twitter -->
<meta name="twitter:image" content="https://hedgehog.cloud/hubfs/learn/intro-kubernetes-share.jpg">
```

If no custom image is provided:

```html
<!-- Fallback to default -->
<meta property="og:image" content="https://hedgehog.cloud/hubfs/social-share-default.png">
<meta name="twitter:image" content="https://hedgehog.cloud/hubfs/social-share-default.png">
```

---

## Troubleshooting

### Image Not Appearing
1. **Check URL**: Ensure the image URL is publicly accessible
2. **Verify HTTPS**: Social platforms require HTTPS URLs
3. **Test file size**: Images > 5MB may be rejected
4. **Clear cache**: Use platform debuggers to refresh cached previews

### Image Cropped Incorrectly
1. **Check dimensions**: Ensure 1200 × 630 pixels
2. **Safe zone**: Keep text/logos away from edges
3. **Aspect ratio**: Maintain 1.91:1 ratio

### Image Looks Blurry
1. **Increase resolution**: Use exactly 1200 × 630 pixels
2. **Export quality**: Save as high-quality JPEG (80-90% quality)
3. **Avoid upscaling**: Don't stretch smaller images

---

## Maintenance

### Updating Images
1. Edit the front matter or JSON file
2. Change the `social_image` URL
3. Run the sync command:
   ```bash
   npm run sync:content      # For modules
   npm run sync:courses      # For courses
   npm run sync:pathways     # For pathways
   ```
4. Clear platform caches using debugger tools

### Batch Updates
To update multiple images at once, edit the JSON/front matter files and run the appropriate sync command.

---

## Related Documentation
- [Content Authoring Guide](./content-authoring.md)
- [SEO Metadata Guide](./issue-52-verification.md)
- [HubDB Schema Reference](../hubdb-schemas/)
