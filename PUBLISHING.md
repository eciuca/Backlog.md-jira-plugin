# Publishing to NPM

This document describes how to publish the `backlog-jira` package to npm.

## Prerequisites

1. **NPM Account**: You need an npm account with publishing permissions
   - Create an account at: https://www.npmjs.com/signup
   - Verify your email address

2. **Two-Factor Authentication** (recommended): Enable 2FA for security
   - Go to: https://www.npmjs.com/settings/YOUR_USERNAME/tfa
   - Use an authenticator app

3. **Authentication**: Login to npm from command line
   ```bash
   npm login
   ```
   This will prompt for:
   - Username
   - Password
   - Email
   - OTP (if 2FA is enabled)

## Pre-Publication Checklist

Before publishing, ensure:

- [ ] Version number is updated in `package.json`
- [ ] CHANGELOG or release notes are updated
- [ ] All tests pass: `npm test`
- [ ] Code quality checks pass: `npm run check`
- [ ] TypeScript compilation succeeds: `npm run check:types`
- [ ] Build is successful: `npm run build`
- [ ] README.md is up-to-date
- [ ] LICENSE file exists (MIT)

## Publishing Process

### 1. Verify Package Contents

Use `npm pack` to preview what will be published:

```bash
npm pack --dry-run
```

This shows:
- Files included in the tarball
- Package size
- Total files count

**Expected contents:**
- `dist/cli.js` - Built CLI executable
- `README.md` - Documentation
- `LICENSE` - MIT License file
- `package.json` - Package metadata

### 2. Update Version Number

Follow [Semantic Versioning](https://semver.org/):

```bash
# For bug fixes (0.1.0 -> 0.1.1)
npm version patch

# For new features (0.1.0 -> 0.2.0)
npm version minor

# For breaking changes (0.1.0 -> 1.0.0)
npm version major
```

This will:
- Update `package.json`
- Create a git commit
- Create a git tag

### 3. Run Pre-Publish Checks

The `prepublishOnly` script automatically runs before publishing:

```bash
npm run build && npm run check && npm run test
```

You can manually run this to verify everything works:

```bash
npm run prepublishOnly
```

### 4. Publish to NPM

#### First-time Publication

For the initial release:

```bash
npm publish
```

This will:
1. Run `prepublishOnly` script automatically
2. Create the package tarball
3. Upload to npm registry
4. Make the package publicly available

#### Subsequent Releases

For future releases, follow the same process:

```bash
# Update version
npm version patch  # or minor/major

# Publish
npm publish
```

### 5. Verify Publication

After publishing:

1. **Check npm website**: Visit https://www.npmjs.com/package/backlog-jira

2. **Test installation globally**:
   ```bash
   npm install -g backlog-jira
   ```

3. **Verify CLI works**:
   ```bash
   backlog-jira --version
   backlog-jira --help
   backlog-jira doctor
   ```

4. **Test in a project**:
   ```bash
   mkdir test-install
   cd test-install
   npm install -g backlog-jira
   backlog-jira --help
   ```

## Troubleshooting

### "You must be logged in to publish packages"
Run `npm login` and authenticate.

### "You do not have permission to publish"
- Verify you're logged in: `npm whoami`
- Check package name isn't already taken
- Ensure you have publishing rights for scoped packages

### "prepublishOnly script failed"
- Fix any failing tests
- Resolve linting errors
- Fix TypeScript compilation errors

### "Package size too large"
- Review files included in `package.json` "files" array
- Ensure `dist/` directory only contains necessary files
- Check `.gitignore` and `.npmignore` configurations

## Post-Publication

### Update README Installation Section

Update the README.md to reflect the published npm package:

```bash
npm install -g backlog-jira
```

### Create GitHub Release

1. Push the version tag to GitHub:
   ```bash
   git push --tags
   ```

2. Create a release on GitHub:
   - Go to: https://github.com/eciuca/Backlog.md-jira-plugin/releases
   - Click "Create a new release"
   - Select the version tag
   - Add release notes
   - Publish release

### Update Documentation

- Update main README with new version info
- Update any documentation that references installation
- Announce the release (if applicable)

## Unpublishing (Emergency Only)

⚠️ **Warning**: Unpublishing should only be used in emergencies (security issues, critical bugs)

```bash
npm unpublish backlog-jira@<version>
```

**Note**: npm has strict unpublishing policies. After 24 hours or if the package has downloads, unpublishing may be restricted. Instead, consider publishing a patched version.

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 0.1.0   | TBD  | Initial release |

## Resources

- [npm Documentation](https://docs.npmjs.com/)
- [Semantic Versioning](https://semver.org/)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
