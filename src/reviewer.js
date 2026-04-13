/**
 * Generate GitHub review comments from analysis results
 */

function generateReviewComments(results, options) {
  const { tier, reviewType } = options;
  const comments = [];

  // Security issues
  for (const issue of results.security || []) {
    comments.push({
      path: issue.file,
      line: issue.line,
      body: formatSecurityComment(issue),
    });
  }

  // Errors
  for (const issue of results.errors || []) {
    comments.push({
      path: issue.file,
      line: issue.line,
      body: formatIssueComment(issue, 'error'),
    });
  }

  // Warnings
  for (const issue of results.warnings || []) {
    comments.push({
      path: issue.file,
      line: issue.line,
      body: formatIssueComment(issue, 'warning'),
    });
  }

  // Suggestions
  if (tier !== 'free' || reviewType === 'basic') {
    // Only show first 3 suggestions for free tier
    const suggestions = tier === 'free'
      ? (results.suggestions || []).slice(0, 3)
      : (results.suggestions || []);

    for (const issue of suggestions) {
      comments.push({
        path: issue.file,
        line: issue.line,
        body: formatIssueComment(issue, 'suggestion'),
      });
    }
  }

  return comments;
}

function formatSecurityComment(issue) {
  const severity = issue.severity || 'high';
  const severityIcon = severity === 'critical' ? '🚨' : severity === 'high' ? '🔴' : '🟡';

  return [
    `${severityIcon} **Security: ${issue.rule}**`,
    '',
    issue.message,
    '',
    `> Confidence: ${Math.round((issue.confidence || 0.8) * 100)}% | Severity: ${severity.toUpperCase()}`,
    '',
    '💡 **Fix:** ' + getSecurityFixSuggestion(issue.rule),
    '',
    '_This issue was detected by [Review Mate AI](https://reviewmate.ai)_',
  ].join('\n');
}

function getSecurityFixSuggestion(rule) {
  const suggestions = {
    'sql-injection': 'Use parameterized queries or an ORM. Never concatenate user input into SQL.',
    'command-injection': 'Avoid shell commands with user input. Use safe APIs or sanitize input thoroughly.',
    'xss': 'Use `.textContent` instead of `.innerHTML`, or sanitize HTML before insertion.',
    'path-traversal': 'Validate and sanitize file paths. Use path.resolve() and allowlist approach.',
    'hardcoded-credential': 'Use environment variables or a secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager).',
    'weak-crypto': 'Use strong algorithms: SHA-256+ for hashing, AES-256-GCM for encryption.',
    'eval': 'Avoid eval(). Refactor to use safer alternatives.',
  };
  return suggestions[rule] || 'Review and fix this security issue.';
}

function formatIssueComment(issue, type) {
  const icons = {
    error: '❌',
    warning: '⚠️',
    suggestion: '💡',
  };

  const labels = {
    error: 'Error',
    warning: 'Warning',
    suggestion: 'Suggestion',
  };

  const icon = icons[type] || '💡';
  const label = labels[type] || 'Issue';

  return [
    `${icon} **${label}: ${issue.rule}**`,
    '',
    issue.message,
    '',
    `> Confidence: ${Math.round((issue.confidence || 0.8) * 100)}%`,
    '',
    '_Review powered by [Review Mate AI](https://reviewmate.ai)_',
  ].join('\n');
}

module.exports = { generateReviewComments };
