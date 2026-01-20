# Contributing to HH Learn

This document provides guidelines for contributing to the Hedgehog Learn (hh-learn) project.

## Table of Contents

- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [CMS Deployment Checklist](#cms-deployment-checklist)
- [Publishing Guidelines](#publishing-guidelines)

## Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `chore/*` - Maintenance tasks
- `content/*` - Content updates

### Commit Messages

Follow conventional commits format:

```
feat(auth): add Cognito OAuth integration
fix(enrollment): resolve CTA button state bug
chore(deps): update Playwright to v1.40
content: add course-authoring-101 module 3
```

### Pull Request Process

1. Create feature branch from `main`
2. Implement changes with tests
3. Run test suite locally
4. Create PR with descriptive title and body
5. Await code review and approval
6. Merge to `main`

## Code Standards

### TypeScript/JavaScript

- Use TypeScript for Lambda functions and scripts
- Use ES5-compatible JavaScript for CMS assets (browser compatibility)
- Follow ESLint configuration
- Use Prettier for code formatting

### Testing

- Write tests before implementation (TDD)
- Use Playwright for E2E tests
- Use Jest for unit tests
- Aim for >80% code coverage

## Testing Requirements

### Before Merging

All PRs must pass:

- [x] ESLint validation
- [x] TypeScript type checking
- [x] Unit tests
- [x] API integration tests
- [x] E2E tests (Playwright)

### Running Tests

```bash
# Run all tests
npm test

# Run E2E tests
npm run test:e2e

# Run API tests
npm run test:api

# Run specific test file
npx playwright test tests/e2e/cognito-frontend-ux.spec.ts
```

## CMS Deployment Checklist

### Pre-Deployment

Use this checklist when deploying changes to HubSpot CMS:

#### 1. Code Quality

- [ ] All tests passing locally
- [ ] ESLint validation passed
- [ ] TypeScript compilation successful
- [ ] No console.error or console.warn in production code

#### 2. Build Markers

Add build markers to track deployments:

```javascript
/**
 * Build: YYYY-MM-DD-HHmm
 * Issue: #XXX
 * Description: Brief description of changes
 */
```

Example:

```javascript
/**
 * Build: 2026-01-19-1400
 * Issue: #306
 * Description: Cognito OAuth frontend integration
 */
(function() {
  'use strict';
  // ... code
})();
```

#### 3. Staging Deployment

- [ ] Deploy to staging environment first
- [ ] Run smoke tests on staging
- [ ] Run E2E tests against staging
- [ ] Manual QA testing on staging
- [ ] Verify browser console has no errors
- [ ] Verify Network tab shows expected API calls

#### 4. Production Deployment

- [ ] Create deployment issue/ticket
- [ ] Schedule deployment window (if needed)
- [ ] Backup current production files
- [ ] Deploy changes to production
- [ ] Verify deployment successful
- [ ] Monitor for errors (15 minutes post-deploy)
- [ ] Document deployment in changelog

#### 5. Post-Deployment Validation

- [ ] Verify key user flows work
- [ ] Check CloudWatch logs for errors
- [ ] Monitor application metrics
- [ ] Verify no increase in error rates
- [ ] Test rollback procedure (if applicable)

### File-Specific Checklists

#### Deploying JavaScript to CMS

When deploying files like `cognito-auth-integration.js`:

- [ ] Add build marker at top of file
- [ ] Minify for production (if needed)
- [ ] Upload to `/learn/assets/js/` directory
- [ ] Update template references to new file
- [ ] Verify file loads in browser (Network tab)
- [ ] Verify no console errors
- [ ] Test both authenticated and anonymous states

#### Deploying Lambda Functions

When deploying Lambda function changes:

- [ ] Update `serverless.yml` if needed
- [ ] Run `npm run build` to compile TypeScript
- [ ] Run `npm run test` to verify all tests pass
- [ ] Deploy to staging: `npx serverless deploy --stage staging`
- [ ] Test staging endpoints
- [ ] Deploy to production: `npx serverless deploy --stage production`
- [ ] Monitor CloudWatch logs

#### Deploying Content

When deploying course/module content:

- [ ] Validate content structure
- [ ] Run `npm run sync:content` to upload to HubDB
- [ ] Verify content appears on staging
- [ ] Proofread for typos
- [ ] Deploy to production
- [ ] Verify on production

## Publishing Guidelines

### Version Numbering

We follow semantic versioning for releases:

- `MAJOR.MINOR.PATCH`
- `1.0.0` - Initial release
- `1.1.0` - New feature (backward compatible)
- `1.0.1` - Bug fix
- `2.0.0` - Breaking change

### Release Process

1. Create release branch: `release/vX.Y.Z`
2. Update version in `package.json`
3. Update `CHANGELOG.md`
4. Run full test suite
5. Create PR to `main`
6. After merge, tag release: `git tag vX.Y.Z`
7. Push tags: `git push --tags`
8. Create GitHub release with notes

### Changelog Format

```markdown
## [1.1.0] - 2026-01-19

### Added
- Cognito OAuth integration (#306)
- Frontend auth integration module
- E2E tests for authentication flows

### Changed
- Updated enrollment.js to use new auth API
- Improved error handling in API calls

### Fixed
- Resolved CTA button state bug (#123)

### Security
- Implemented httpOnly cookies for auth tokens
- Added CSRF protection with SameSite cookies
```

## Build Markers Reference

### Purpose

Build markers help track which version of code is deployed and when. This is critical for:

- Debugging production issues
- Tracking deployment history
- Rolling back changes
- Correlating errors with deployments

### Format

```javascript
/**
 * Build: YYYY-MM-DD-HHmm
 * Issue: #XXX
 * Version: X.Y.Z (optional)
 * Description: Brief description
 * Changes:
 * - Change 1
 * - Change 2
 */
```

### Example

```javascript
/**
 * Build: 2026-01-19-1430
 * Issue: #306
 * Version: 1.1.0
 * Description: Cognito OAuth frontend integration for Phase 6
 * Changes:
 * - Added /auth/me endpoint integration
 * - Implemented httpOnly cookie-based auth
 * - Added backward-compatible window.hhIdentity API
 * - Emits hhl:identity event for downstream consumers
 */
(function() {
  'use strict';
  // ... code
})();
```

### Automated Build Markers

For automated builds, include git commit hash:

```javascript
/**
 * Build: 2026-01-19-1430
 * Commit: abc123def456
 * Branch: feature/auth-integration
 * Environment: production
 */
```

## Emergency Procedures

### Rollback Procedure

If deployment causes critical issues:

1. **Immediate:** Revert CMS files to previous version
2. **Lambda:** Redeploy previous version: `npx serverless deploy --stage production`
3. **Notify:** Post in team channel about rollback
4. **Document:** Create incident report
5. **Fix:** Debug issue in separate branch
6. **Test:** Full test suite before redeployment

### Hotfix Process

For critical production bugs:

1. Create `hotfix/description` branch from `main`
2. Implement minimal fix
3. Write test to prevent regression
4. Fast-track PR review
5. Deploy to staging → test → production
6. Document in incident report

## Questions?

For questions or issues:

- Check existing documentation in `/docs`
- Review related GitHub issues
- Ask in team Slack channel
- Tag @project-lead in PR comments

---

**Document Version:** 1.0
**Last Updated:** 2026-01-19
**Maintained By:** HH Learn Development Team
