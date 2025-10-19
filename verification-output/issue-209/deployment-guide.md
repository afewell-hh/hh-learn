# Issue #209 Deployment Guide

## Files to Upload to HubSpot

### 1. New File: toast.js
**Source:** `clean-x-hedgehog-templates/assets/js/toast.js`
**Destination:** Design Manager → `/CLEAN x HEDGEHOG/templates/assets/js/toast.js`

### 2. Updated File: progress.js
**Source:** `clean-x-hedgehog-templates/assets/js/progress.js`
**Destination:** Design Manager → `/CLEAN x HEDGEHOG/templates/assets/js/progress.js`

### 3. Updated Template: module-page.html
**Source:** `clean-x-hedgehog-templates/learn/module-page.html`
**Destination:** Design Manager → `/CLEAN x HEDGEHOG/templates/learn/module-page.html`

## Deployment Steps

1. **Backup existing files** (in HubSpot Design Manager)
   - Right-click each file → "Download" before uploading new versions

2. **Upload toast.js** (new file)
   - Navigate to Design Manager → `/CLEAN x HEDGEHOG/templates/assets/js/`
   - Click "Upload" → Select `toast.js`
   - Publish the file

3. **Update progress.js**
   - Navigate to Design Manager → `/CLEAN x HEDGEHOG/templates/assets/js/progress.js`
   - Replace content with updated version
   - Publish the file

4. **Update module-page.html**
   - Navigate to Design Manager → `/CLEAN x HEDGEHOG/templates/learn/module-page.html`
   - Replace content with updated version
   - Publish the template

5. **Clear cache** (if using CDN)
   - Settings → Website → Pages → Clear CDN cache

6. **Test on staging** (if available)
   - Visit a module page
   - Click progress buttons
   - Verify toast notifications appear
   - Check browser console for errors

7. **Monitor production**
   - Check for JavaScript errors in browser console
   - Verify beacon tracking still works (check Lambda logs)
   - Test with different browsers

## Rollback Plan

If issues occur:

1. **Revert files in Design Manager**
   - Restore backed-up versions of progress.js and module-page.html
   - Delete toast.js (or unpublish)

2. **Alternative: Feature flag**
   - Wrap toast logic in conditional check
   - Set localStorage flag to disable: `localStorage.setItem('HHL_DISABLE_TOASTS', 'true')`

## Testing Checklist

After deployment:
- [ ] Module page loads without errors
- [ ] "Mark as started" button shows toast
- [ ] "Mark complete" button shows toast
- [ ] Button states update correctly
- [ ] Toasts auto-dismiss after 3 seconds
- [ ] Keyboard navigation works
- [ ] Screen reader announces toast messages
- [ ] Beacons still sent to Lambda API
- [ ] No console errors
- [ ] No CSP violations

## Support

If you encounter issues:
1. Check browser console for JavaScript errors
2. Verify files uploaded to correct paths
3. Clear browser cache and reload
4. Check HubSpot status page for outages
5. Review Lambda logs for API errors
