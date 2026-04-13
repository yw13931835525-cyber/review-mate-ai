const core = require('@actions/core');
const github = require('@actions/github');
const { analyzeCodeChanges } = require('./analyzer');
const { generateReviewComments } = require('./reviewer');
const { verifyLicense, getTierLimits, TIER } = require('./licensing');
const { Octokit } = require('@actions/github');

async function run() {
  const inputs = {
    token: core.getInput('github_token', { required: true }),
    licenseKey: core.getInput('license_key') || '',
    minConfidence: parseFloat(core.getInput('min_confidence')) || 0.6,
    languages: core.getInput('languages').split(',').filter(Boolean),
    maxFiles: parseInt(core.getInput('max_files')) || 5,
    reviewType: core.getInput('review_type') || 'basic',
    securityScan: core.getInput('security_scan') === 'true',
    prNumber: core.getInput('pr_number') || '',
  };

  const octokit = new Octokit({ auth: inputs.token });
  const context = github.context;

  // Detect PR
  const prNum = inputs.prNumber || (context.payload.pull_request && context.payload.pull_request.number);
  if (!prNum) {
    core.setOutput('findings_count', '0');
    core.setOutput('review_id', '');
    core.setOutput('tier', 'none');
    core.info('No pull request found. Skipping review.');
    return;
  }

  // Verify license
  const license = await verifyLicense(inputs.licenseKey);
  const tier = license.tier;
  const limits = getTierLimits(tier);

  core.info(`🔍 Review Mate AI - Running ${tier} tier analysis...`);
  core.info(`   PR: #${prNum}`);
  core.info(`   Review Type: ${inputs.reviewType}`);
  core.info(`   Security Scan: ${inputs.securityScan}`);

  // Get PR diff
  const { data: diffData } = await octokit.rest.pulls.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNum,
    mediaType: { format: 'diff' },
  });

  // Get changed files
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNum,
    per_page: 100,
  });

  // Check file limit
  const filesToAnalyze = files.slice(0, limits.maxFilesPerPR);
  core.info(`📄 Analyzing ${filesToAnalyze.length} of ${files.length} changed files...`);

  // Analyze code changes
  const analysisResults = analyzeCodeChanges(filesToAnalyze, {
    languages: inputs.languages,
    minConfidence: inputs.minConfidence,
    reviewType: inputs.reviewType,
    securityScan: inputs.securityScan && tier !== TIER.FREE,
    tier,
  });

  // Generate review comments
  const comments = generateReviewComments(analysisResults, {
    tier,
    reviewType: inputs.reviewType,
  });

  // Post review comments
  const reviewId = `rm_${Date.now()}_${prNum}`;

  if (comments.length > 0) {
    for (const comment of comments) {
      try {
        if (comment.path) {
          // Line comment
          await octokit.rest.pulls.createReviewComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: prNum,
            body: comment.body,
            commit_id: context.payload.pull_request.head.sha,
            path: comment.path,
            line: comment.line,
            side: comment.side || 'RIGHT',
          });
        } else {
          // General PR comment
          await octokit.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: prNum,
            body: comment.body,
          });
        }
        core.info(`✅ Posted comment: ${comment.path || 'general'} line ${comment.line || 'N/A'}`);
      } catch (err) {
        core.warning(`Failed to post comment: ${err.message}`);
      }
    }
  }

  // Post overall review
  try {
    const reviewBody = buildReviewSummary(analysisResults, tier);
    await octokit.rest.pulls.createReview({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNum,
      body: reviewBody,
      event: analysisResults.critical.length > 0 ? 'REQUEST_CHANGES' : 'COMMENT',
    });
  } catch (err) {
    core.warning(`Failed to post review summary: ${err.message}`);
  }

  // Set outputs
  const totalFindings = analysisResults.errors.length +
                        analysisResults.warnings.length +
                        analysisResults.suggestions.length +
                        analysisResults.security.length;

  core.setOutput('findings_count', String(totalFindings));
  core.setOutput('review_id', reviewId);
  core.setOutput('tier', tier);

  // Show upgrade message for free tier
  if (tier === TIER.FREE) {
    core.info('');
    core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    core.info('🚀 Upgrade to PRO ($9/mo) for unlimited reviews!');
    core.info('   • Unlimited PR reviews');
    core.info('   • Deep analysis mode');
    core.info('   • Security vulnerability scanning');
    core.info('   • Multi-language support');
    core.info('   Get your license at: https://reviewmate.ai');
    core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

function buildReviewSummary(results, tier) {
  const lines = [];
  lines.push('## 🤖 Review Mate AI - Code Review Summary\n');

  if (results.security.length > 0) {
    lines.push(`### 🔴 Security Issues (${results.security.length})`);
    lines.push('');
    for (const s of results.security.slice(0, 5)) {
      lines.push(`- ⚠️ **${s.rule}**: ${s.message}`);
    }
    if (results.security.length > 5) {
      lines.push(`- _${results.security.length - 5} more security issues_`);
    }
    lines.push('');
  }

  if (results.errors.length > 0) {
    lines.push(`### 🔴 Errors (${results.errors.length})`);
    lines.push('');
    for (const e of results.errors.slice(0, 5)) {
      lines.push(`- ❌ **${e.rule}** in \`${e.file}\`: ${e.message}`);
    }
    if (results.errors.length > 5) {
      lines.push(`- _${results.errors.length - 5} more errors_`);
    }
    lines.push('');
  }

  if (results.warnings.length > 0) {
    lines.push(`### 🟡 Warnings (${results.warnings.length})`);
    lines.push('');
    for (const w of results.warnings.slice(0, 5)) {
      lines.push(`- ⚠️ **${w.rule}** in \`${w.file}\`: ${w.message}`);
    }
    if (results.warnings.length > 5) {
      lines.push(`- _${results.warnings.length - 5} more warnings_`);
    }
    lines.push('');
  }

  if (results.suggestions.length > 0) {
    lines.push(`### 💡 Suggestions (${results.suggestions.length})`);
    lines.push('');
    for (const s of results.suggestions.slice(0, 5)) {
      lines.push(`- 💡 **${s.rule}** in \`${s.file}\`: ${s.message}`);
    }
    if (results.suggestions.length > 5) {
      lines.push(`- _${results.suggestions.length - 5} more suggestions_`);
    }
    lines.push('');
  }

  const total = results.errors.length + results.warnings.length + results.suggestions.length + results.security.length;
  if (total === 0) {
    lines.push('✅ **No issues found!** Your code looks great.\n');
  }

  lines.push('---');
  lines.push(`_Review powered by [Review Mate AI](https://reviewmate.ai) · ${tier.toUpperCase()} tier_\n`);

  return lines.join('\n');
}

run().catch(err => {
  core.error(`Review Mate AI failed: ${err.message}`);
  process.exit(1);
});
