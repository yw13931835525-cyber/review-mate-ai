# 🤖 Review Mate AI

> AI-Powered Code Review GitHub Action - Automatically analyze pull requests, detect issues, and suggest improvements.

[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-v1.0.0-green)](https://github.com/marketplace)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ Features

- 🔍 **Automatic PR Analysis** - Triggers on every pull request automatically
- 🛡️ **Security Scanning** - Detect SQL injection, XSS, command injection, and more
- 🌐 **Multi-Language Support** - JavaScript, TypeScript, Python, Go, Java, Ruby, Rust, PHP, C#, Swift, Kotlin, SQL, and more
- 📊 **Code Quality Checks** - Detect code smells, anti-patterns, and best practice violations
- 💬 **Inline Comments** - Post review comments directly on PR lines
- 📈 **Review Summary** - Generate comprehensive PR review summaries

## 🚀 Quick Start

### Free Tier (30 reviews/month)

```yaml
name: Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Review Mate AI
        uses: yw13931835525-cyber/review-mate-ai@v1.0.0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Pro Tier ($9/month - Unlimited Reviews)

```yaml
- name: Run Review Mate AI
  uses: yw13931835525-cyber/review-mate-ai@v1.0.0
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    license_key: ${{ secrets.REVIEWMATE_LICENSE_KEY }}
    review_type: deep
    security_scan: true
    max_files: 50
```

## 📋 Configuration Options

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github_token` | GitHub token | Yes | `github.token` |
| `license_key` | Review Mate Pro license key | No | - |
| `review_type` | Review depth: `basic`, `standard`, `deep` | No | `basic` |
| `security_scan` | Enable security vulnerability scanning (Pro) | No | `false` |
| `min_confidence` | Minimum confidence threshold (0.0-1.0) | No | `0.6` |
| `languages` | Comma-separated languages to focus on | No | all |
| `max_files` | Max files to analyze per PR (Free: 5) | No | `5` |
| `pr_number` | PR number to review (auto-detected) | No | auto |

## 💰 Pricing

| Feature | Free | Pro ($9/mo) | Team ($29/mo) |
|---------|------|-------------|----------------|
| Reviews/month | 30 | Unlimited | Unlimited |
| Files per PR | 5 | 50 | Unlimited |
| Security scan | ❌ | ✅ | ✅ |
| Deep analysis | ❌ | ✅ | ✅ |
| Multi-language | Basic | Full | Full |
| Team features | ❌ | ❌ | ✅ |
| Priority support | ❌ | ✅ | ✅ |

### Get Your License

Visit **[https://reviewmate.ai](https://reviewmate.ai)** to purchase a Pro or Team license.

## 🔍 What Gets Detected

### Security Issues (Pro)
- **SQL Injection** - Parameterized query suggestions
- **Command Injection** - Shell command safety
- **XSS Vulnerabilities** - Cross-site scripting risks
- **Path Traversal** - File path validation issues
- **Hardcoded Credentials** - Secret detection
- **Weak Cryptography** - Algorithm recommendations

### Code Quality
- **Anti-patterns** - Common mistakes per language
- **Best Practices** - Language-specific recommendations
- **Code Smells** - Maintainability issues
- **TODO/FIXME** - Outstanding tasks detection
- **Long Functions** - Complexity warnings
- **Dead Code** - Unused code detection

### Per-Language Analysis

| Language | Detections |
|----------|-----------|
| JavaScript/TypeScript | `no-console`, `no-eval`, `eqeqeq`, `no-any`, `@ts-ignore` |
| Python | `bare-except`, `no-print`, `wildcard-import`, `!= None` |
| Go | `fmt.Print`, error handling, `println` |
| Rust | `unwrap()`, `expect()` without message |
| Java | `System.out`, generic Exception catching |
| Ruby | `puts`, `rescue nil` |
| PHP | `mysql_*`, `@` suppression, XSS |
| SQL | `SELECT *`, plaintext passwords |
| Shell | `set -e`, dangerous `rm -rf` |

## 📤 Outputs

| Output | Description |
|--------|-------------|
| `findings_count` | Total number of issues found |
| `review_id` | Unique review session ID |
| `tier` | License tier used (`free`/`pro`/`team`) |

## 🔒 Security Notes

- This action only reads code from pull requests
- No code is stored or shared
- License keys are encrypted in transit
- Security scans are performed locally

## 📝 Example Review

After running, you'll see comments like:

> ❌ **Error: hardcoded-credential**
>
> Potential hardcoded credential detected - use environment variables
>
> > Confidence: 90%
>
> _Review powered by [Review Mate AI](https://reviewmate.ai)_

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Review Mate AI</strong> — Code review powered by AI<br>
  <a href="https://reviewmate.ai">Website</a> · <a href="https://github.com/yw13931835525-cyber/review-mate-ai">Source</a> · <a href="https://github.com/marketplace">Marketplace</a>
</p>
