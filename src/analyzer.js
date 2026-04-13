const Diff = require('diff');

function analyzeCodeChanges(files, options) {
  const {
    languages = [],
    minConfidence = 0.6,
    reviewType = 'basic',
    securityScan = false,
    tier,
  } = options;

  const results = {
    errors: [],
    warnings: [],
    suggestions: [],
    security: [],
    metrics: {
      filesAnalyzed: files.length,
      linesAdded: 0,
      linesDeleted: 0,
    },
  };

  for (const file of files) {
    results.metrics.linesAdded += (file.additions || '').split('\n').length;
    results.metrics.linesDeleted += (file.deletions || '').split('\n').length;

    if (file.filename.match(/\.(png|jpg|gif|ico|woff|woff2|ttf|eot)$/i)) continue;

    const filename = file.filename;
    const ext = filename.split('.').pop().toLowerCase();
    const patch = file.patch || '';

    const langAnalysis = analyzeByLanguage(ext, patch, filename, reviewType, tier);
    
    results.errors.push(...langAnalysis.errors);
    results.warnings.push(...langAnalysis.warnings);
    results.suggestions.push(...langAnalysis.suggestions);

    if (securityScan || reviewType === 'deep') {
      const secAnalysis = analyzeSecurity(patch, filename, ext);
      results.security.push(...secAnalysis);
    }
  }

  results.errors = results.errors.filter(r => (r.confidence || 1) >= minConfidence);
  results.warnings = results.warnings.filter(r => (r.confidence || 1) >= minConfidence);
  results.suggestions = results.suggestions.filter(r => (r.confidence || 1) >= minConfidence);
  results.security = results.security.filter(r => (r.confidence || 1) >= minConfidence);

  return results;
}

function analyzeByLanguage(ext, patch, filename, reviewType, tier) {
  const results = { errors: [], warnings: [], suggestions: [] };

  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
      Object.assign(results, analyzeJavaScript(patch, filename));
      break;
    case 'ts':
    case 'tsx':
      Object.assign(results, analyzeTypeScript(patch, filename));
      break;
    case 'py':
      Object.assign(results, analyzePython(patch, filename));
      break;
    case 'go':
      Object.assign(results, analyzeGo(patch, filename));
      break;
    case 'java':
      Object.assign(results, analyzeJava(patch, filename));
      break;
    case 'rb':
      Object.assign(results, analyzeRuby(patch, filename));
      break;
    case 'rs':
      Object.assign(results, analyzeRust(patch, filename));
      break;
    case 'php':
      Object.assign(results, analyzePHP(patch, filename));
      break;
    case 'c':
    case 'cpp':
    case 'cc':
    case 'cxx':
      Object.assign(results, analyzeC(patch, filename));
      break;
    case 'cs':
      Object.assign(results, analyzeCSharp(patch, filename));
      break;
    case 'swift':
      Object.assign(results, analyzeSwift(patch, filename));
      break;
    case 'kt':
    case 'kts':
      Object.assign(results, analyzeKotlin(patch, filename));
      break;
    case 'sql':
      Object.assign(results, analyzeSQL(patch, filename));
      break;
    case 'sh':
    case 'bash':
    case 'zsh':
      Object.assign(results, analyzeShell(patch, filename));
      break;
    case 'yaml':
    case 'yml':
      Object.assign(results, analyzeYAML(patch, filename));
      break;
    case 'json':
      Object.assign(results, analyzeJSON(patch, filename));
      break;
    case 'md':
    case 'markdown':
      Object.assign(results, analyzeMarkdown(patch, filename));
      break;
    default:
      Object.assign(results, analyzeGeneric(patch, filename));
  }

  const standard = analyzeStandard(patch, filename, ext);
  results.warnings.push(...standard.warnings);
  results.suggestions.push(...standard.suggestions);

  return results;
}

function analyzeJavaScript(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    if (/console\.(log|debug|info)\s*\(/.test(line) && !line.startsWith('-')) {
      results.warnings.push({
        rule: 'no-console',
        file: filename,
        message: 'Avoid leaving console.log/debug statements in production code',
        line: extractLineNum(line, lines),
        confidence: 0.9,
      });
    }

    const todoMatch = line.match(/(\/\/|#)\s*(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[3].trim() + '" - should be addressed before merge',
        confidence: 0.8,
      });
    }

    if (/\b\d+\s*==\s*[a-zA-Z_]|\b[a-zA-Z_]\s*==\s*\d+\b/.test(line)) {
      results.errors.push({
        rule: 'eqeqeq',
        file: filename,
        message: 'Use === instead of == for strict equality',
        line: extractLineNum(line, lines),
        confidence: 0.95,
      });
    }

    if (/eval\s*\(/.test(line) && !line.startsWith('-')) {
      results.errors.push({
        rule: 'no-eval',
        file: filename,
        message: 'eval() is dangerous and should be avoided',
        line: extractLineNum(line, lines),
        confidence: 0.95,
      });
    }

    if (/(password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]{4,}['"]/.test(line.toLowerCase())) {
      results.errors.push({
        rule: 'hardcoded-credential',
        file: filename,
        message: 'Potential hardcoded credential detected - use environment variables',
        line: extractLineNum(line, lines),
        confidence: 0.9,
      });
    }

    if (/^\+\s*.*await\s+/.test(line) && !patch.includes('try {')) {
      results.warnings.push({
        rule: 'await-try',
        file: filename,
        message: 'Consider wrapping await in try/catch for error handling',
        confidence: 0.7,
      });
    }
  }

  return results;
}

function analyzeTypeScript(patch, filename) {
  const results = analyzeJavaScript(patch, filename);
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    if (/: any\b/.test(line) && !line.startsWith('-')) {
      results.warnings.push({
        rule: 'no-any',
        file: filename,
        message: 'Avoid using "any" type - use specific types or unknown instead',
        line: extractLineNum(line, lines),
        confidence: 0.85,
      });
    }

    if (/@\s*ts-ignore/.test(line)) {
      results.suggestions.push({
        rule: 'no-ts-ignore',
        file: filename,
        message: '@ts-ignore suppresses TypeScript errors - consider fixing the underlying issue',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }

    if (/\!\s*([=;,\)]|$)/.test(line) && !line.startsWith('-')) {
      results.warnings.push({
        rule: 'no-non-null-assertion',
        file: filename,
        message: 'Non-null assertion (!) can mask null errors - consider optional chaining instead',
        line: extractLineNum(line, lines),
        confidence: 0.7,
      });
    }
  }

  return results;
}

function analyzePython(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    if (/^\+\s*print\s*\(/.test(line)) {
      results.warnings.push({
        rule: 'no-print',
        file: filename,
        message: 'print() statement found - use logging module for production code',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }

    const todoMatch = line.match(/#\s*(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }

    if (/^\+\s*except\s*:/.test(line)) {
      results.errors.push({
        rule: 'bare-except',
        file: filename,
        message: 'Bare except clause catches all exceptions - specify exception types',
        line: extractLineNum(line, lines),
        confidence: 0.9,
      });
    }

    if (/^\+\s*except\s+.*,\s*\w+\s*:/.test(line)) {
      results.warnings.push({
        rule: 'old-except-syntax',
        file: filename,
        message: 'Old except syntax - use "except Exception as e:" instead',
        line: extractLineNum(line, lines),
        confidence: 0.85,
      });
    }

    if (/\b!=\s*None\b/.test(line) && !line.startsWith('-')) {
      results.warnings.push({
        rule: 'none-comparison',
        file: filename,
        message: 'Use "is not None" instead of "!= None"',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }

    if (/(password|secret|api_key|token)\s*[=:]\s*['"][^'"]{4,}['"]/.test(line.toLowerCase())) {
      results.errors.push({
        rule: 'hardcoded-credential',
        file: filename,
        message: 'Potential hardcoded credential - use environment variables',
        line: extractLineNum(line, lines),
        confidence: 0.9,
      });
    }

    if (/^\+\s*from\s+\w+\s+import\s+\*/.test(line)) {
      results.warnings.push({
        rule: 'wildcard-import',
        file: filename,
        message: 'Wildcard import can cause namespace pollution - import specific names',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }
  }

  return results;
}

function analyzeGo(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    const todoMatch = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }

    if (/fmt\.(Print|Printf|Println)\b/.test(line) && !line.startsWith('-')) {
      results.warnings.push({
        rule: 'no-fmt-print',
        file: filename,
        message: 'fmt.Print found - consider using log package or structured logging',
        line: extractLineNum(line, lines),
        confidence: 0.7,
      });
    }

    if (/\berr\s*!=\s*nil\b/.test(line) && !patch.includes('if err != nil')) {
      results.warnings.push({
        rule: 'error-handling',
        file: filename,
        message: 'Error detected but may not be properly handled',
        line: extractLineNum(line, lines),
        confidence: 0.6,
      });
    }

    if (/(password|secret|token|apikey)\s*[=:]\s*"[^"]{4,}"/.test(line.toLowerCase())) {
      results.errors.push({
        rule: 'hardcoded-credential',
        file: filename,
        message: 'Potential hardcoded credential - use environment variables',
        line: extractLineNum(line, lines),
        confidence: 0.9,
      });
    }

    if (/^\+\s*println\s*\(/.test(line)) {
      results.warnings.push({
        rule: 'no-println',
        file: filename,
        message: 'Use log package instead of println for production code',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }
  }

  return results;
}

function analyzeJava(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    const todoMatch = line.match(/\/\/(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }

    if (/System\.(out|err)\.(print|println)/.test(line) && !line.startsWith('-')) {
      results.warnings.push({
        rule: 'no-system-out',
        file: filename,
        message: 'System.out/err found - use a logging framework',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }

    if (/catch\s*\(\s*Exception\s+\w+\s*\)/.test(line) && !line.startsWith('-')) {
      results.warnings.push({
        rule: 'catch-generic-exception',
        file: filename,
        message: 'Catching generic Exception - consider catching specific types',
        line: extractLineNum(line, lines),
        confidence: 0.75,
      });
    }

    if (/(password|secret|token)\s*[=]\s*"[^"]{4,}"/.test(line.toLowerCase())) {
      results.errors.push({
        rule: 'hardcoded-credential',
        file: filename,
        message: 'Potential hardcoded credential - use environment variables',
        line: extractLineNum(line, lines),
        confidence: 0.9,
      });
    }
  }

  return results;
}

function analyzeRuby(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    const todoMatch = line.match(/#\s*(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }

    if (/^\+\s*puts\s+/.test(line)) {
      results.warnings.push({
        rule: 'no-puts',
        file: filename,
        message: 'puts found - use Rails.logger or a proper logging framework',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }

    if (/rescue\s+nil/.test(line) && !line.startsWith('-')) {
      results.errors.push({
        rule: 'rescue-nil',
        file: filename,
        message: 'rescue nil swallows exceptions - handle errors properly',
        line: extractLineNum(line, lines),
        confidence: 0.9,
      });
    }
  }

  return results;
}

function analyzeRust(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    const todoMatch = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }

    if (/\.expect\s*\(\s*["']/.test(line)) {
      results.warnings.push({
        rule: 'expect-with-message',
        file: filename,
        message: 'expect() should include a descriptive error message',
        line: extractLineNum(line, lines),
        confidence: 0.7,
      });
    }

    if (/\.unwrap\s*\(\s*\)/.test(line) && !line.startsWith('-')) {
      results.warnings.push({
        rule: 'no-unwrap',
        file: filename,
        message: 'unwrap() can panic - consider using ? or proper error handling',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }
  }

  return results;
}

function analyzePHP(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    const todoMatch = line.match(/\/\/(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }

    if (/^\+\s*echo\s+['"].*\$/.test(line)) {
      results.warnings.push({
        rule: 'xss-risk',
        file: filename,
        message: 'Echoing variables without escaping - potential XSS risk',
        line: extractLineNum(line, lines),
        confidence: 0.7,
      });
    }

    if (/mysql_(query|connect|fetch)/.test(line)) {
      results.errors.push({
        rule: 'deprecated-mysql',
        file: filename,
        message: 'mysql_* functions are deprecated - use mysqli or PDO',
        line: extractLineNum(line, lines),
        confidence: 0.95,
      });
    }

    if (/^\+\s*@/.test(line)) {
      results.warnings.push({
        rule: 'no-error-suppression',
        file: filename,
        message: '@ operator suppresses errors - handle them properly',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }
  }

  return results;
}

function analyzeC(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    const todoMatch = line.match(/\/\/(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }

    if (/gets\s*\(/.test(line)) {
      results.errors.push({
        rule: 'no-gets',
        file: filename,
        message: 'gets() is unsafe - use fgets() instead',
        line: extractLineNum(line, lines),
        confidence: 0.95,
      });
    }

    if (/(strcpy|strcat|sprintf)\s*\(/.test(line) && !line.includes('n)')) {
      results.warnings.push({
        rule: 'unsafe-string-functions',
        file: filename,
        message: 'Consider using strncpy/strncat/snprintf with size limits',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }

    if (/malloc\s*\(/.test(line) && filename.match(/\.cpp?$/)) {
      results.warnings.push({
        rule: 'malloc-cast',
        file: filename,
        message: 'malloc() return should be cast in C++',
        line: extractLineNum(line, lines),
        confidence: 0.7,
      });
    }
  }

  return results;
}

function analyzeCSharp(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    const todoMatch = line.match(/\/\/(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }

    if (/Console\.(Write|WriteLine)\(/.test(line) && !line.startsWith('-')) {
      results.warnings.push({
        rule: 'no-console-write',
        file: filename,
        message: 'Console.Write found - use ILogger or structured logging',
        line: extractLineNum(line, lines),
        confidence: 0.75,
      });
    }

    if (/catch\s*\(\s*Exception\s*\)/.test(line) && !line.startsWith('-')) {
      results.warnings.push({
        rule: 'catch-generic-exception',
        file: filename,
        message: 'Catching generic Exception - consider more specific types',
        line: extractLineNum(line, lines),
        confidence: 0.7,
      });
    }
  }

  return results;
}

function analyzeSwift(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    const todoMatch = line.match(/\/\/(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }

    if (/[^!]![=;,\)\s]/.test(line)) {
      results.warnings.push({
        rule: 'no-force-unwrap',
        file: filename,
        message: 'Force unwrap (!) can crash - use guard let or if let',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }

    if (/^\+\s*print\s*\(/.test(line)) {
      results.warnings.push({
        rule: 'no-print',
        file: filename,
        message: 'print() found - use os_log or a proper logging framework',
        line: extractLineNum(line, lines),
        confidence: 0.7,
      });
    }
  }

  return results;
}

function analyzeKotlin(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    const todoMatch = line.match(/\/\/(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }

    if (/\b!!/.test(line) && !line.startsWith('-')) {
      results.warnings.push({
        rule: 'no-bang-bang',
        file: filename,
        message: '!! operator can cause NPE - use safe call (?) or require',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }

    if (/^\+\s*println\s*\(/.test(line)) {
      results.warnings.push({
        rule: 'no-println',
        file: filename,
        message: 'println found - use a logging framework',
        line: extractLineNum(line, lines),
        confidence: 0.75,
      });
    }
  }

  return results;
}

function analyzeSQL(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    if (/SELECT\s+\*/i.test(line) && !line.startsWith('-')) {
      results.suggestions.push({
        rule: 'no-select-star',
        file: filename,
        message: 'Avoid SELECT * - specify columns explicitly for better performance and clarity',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }

    if (/(password|passwd)\s*[=]\s*['"][^'"]{4,}['"]/i.test(line)) {
      results.errors.push({
        rule: 'plaintext-password',
        file: filename,
        message: 'Password detected in plain text - use hashing',
        line: extractLineNum(line, lines),
        confidence: 0.95,
      });
    }

    const todoMatch = line.match(/--\s*(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }
  }

  return results;
}

function analyzeShell(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    if (line.startsWith('#!/') && !patch.includes('set -e')) {
      results.suggestions.push({
        rule: 'use-set-e',
        file: filename,
        message: 'Consider adding "set -e" to exit on error',
        confidence: 0.7,
      });
    }

    const todoMatch = line.match(/#\s*(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }

    if (/(password|pass|secret|token)\s*[=:][^&|;]/.test(line.toLowerCase())) {
      results.errors.push({
        rule: 'hardcoded-credential',
        file: filename,
        message: 'Potential hardcoded credential - use environment variables',
        line: extractLineNum(line, lines),
        confidence: 0.85,
      });
    }

    if (/rm\s+-rf\s+\//.test(line)) {
      results.errors.push({
        rule: 'dangerous-rm',
        file: filename,
        message: 'Dangerous rm command - could delete system files',
        line: extractLineNum(line, lines),
        confidence: 0.95,
      });
    }
  }

  return results;
}

function analyzeYAML(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    const todoMatch = line.match(/#\s*(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[2].trim() + '"',
        confidence: 0.8,
      });
    }

    if (/(password|secret|token|api_key)\s*:/i.test(line) && (line.includes("'") || line.includes('"'))) {
      results.warnings.push({
        rule: 'secrets-in-yaml',
        file: filename,
        message: 'Sensitive data found - consider using secrets management',
        line: extractLineNum(line, lines),
        confidence: 0.8,
      });
    }
  }

  return results;
}

function analyzeJSON(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    if (/"(password|secret|token|api_key)"\s*:\s*"/.test(line)) {
      results.errors.push({
        rule: 'secrets-in-json',
        file: filename,
        message: 'Sensitive data found in JSON - use environment variables or secrets manager',
        line: extractLineNum(line, lines),
        confidence: 0.9,
      });
    }
  }

  return results;
}

function analyzeMarkdown(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    const todoMatch = line.match(/\[TODO\]|\[FIXME\]|TODO:|FIXME:/i);
    if (todoMatch) {
      results.suggestions.push({
        rule: 'todo-in-docs',
        file: filename,
        message: 'TODO/FIXME found in documentation',
        confidence: 0.6,
      });
    }
  }

  return results;
}

function analyzeGeneric(patch, filename) {
  const results = { errors: [], warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    const todoMatch = line.match(/(\/\/|<!--|#|\/\*)\s*(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
    if (todoMatch) {
      results.warnings.push({
        rule: 'todo-comment',
        file: filename,
        message: 'TODO found: "' + todoMatch[3].trim() + '"',
        confidence: 0.7,
      });
    }

    if (/(password|secret|key|token)\s*[=:]\s*['"][^'"]{6,}['"]/i.test(line)) {
      results.errors.push({
        rule: 'potential-credential',
        file: filename,
        message: 'Potential credential or secret detected',
        line: extractLineNum(line, lines),
        confidence: 0.75,
      });
    }
  }

  return results;
}

function analyzeStandard(patch, filename, ext) {
  const results = { warnings: [], suggestions: [] };
  if (!patch) return results;

  const lines = patch.split('\n');
  for (const line of lines) {
    if (line.length > 120 && !line.startsWith('-')) {
      results.suggestions.push({
        rule: 'line-too-long',
        file: filename,
        message: 'Line is ' + line.length + ' characters (max recommended: 120)',
        line: extractLineNum(line, lines),
        confidence: 0.7,
      });
    }
  }

  return results;
}

function analyzeSecurity(patch, filename, ext) {
  const results = [];
  if (!patch) return results;

  const lines = patch.split('\n');

  const sqlPatterns = [
    /'.*'\s*\+\s*\$.*/,
    /"\s*\+\s*\$/,
    /\.execute\s*\(\s*['"].*\$\{/,
    /\.query\s*\(\s*['"].*\$\{/,
  ];

  for (const line of lines) {
    if (line.startsWith('-')) continue;

    for (const pattern of sqlPatterns) {
      if (pattern.test(line)) {
        results.push({
          rule: 'sql-injection',
          file: filename,
          message: 'Potential SQL injection vulnerability - use parameterized queries',
          line: extractLineNum(line, lines),
          confidence: 0.85,
          severity: 'critical',
        });
      }
    }

    if (/exec\s*\(.*\$\{|system\s*\(.*\$\{|shell_exec\s*\(.*\$\{/.test(line)) {
      results.push({
        rule: 'command-injection',
        file: filename,
        message: 'Potential command injection - avoid interpolating user input into shell commands',
        line: extractLineNum(line, lines),
        confidence: 0.85,
        severity: 'critical',
      });
    }

    if (/\.\.\/|\.\.\\|readFile\s*\(.*\$\{|open\s*\(.*\$\{/.test(line)) {
      results.push({
        rule: 'path-traversal',
        file: filename,
        message: 'Potential path traversal vulnerability - validate and sanitize file paths',
        line: extractLineNum(line, lines),
        confidence: 0.75,
        severity: 'high',
      });
    }

    if (/innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML/.test(line) && line.includes('${')) {
      results.push({
        rule: 'xss',
        file: filename,
        message: 'Potential XSS vulnerability - avoid innerHTML with user input, use textContent or sanitize',
        line: extractLineNum(line, lines),
        confidence: 0.8,
        severity: 'high',
      });
    }

    if (/MD5|SHA1|CBC\b/.test(line) && !line.startsWith('-')) {
      results.push({
        rule: 'weak-crypto',
        file: filename,
        message: 'Weak cryptographic algorithm detected - use SHA-256+ or AES-GCM',
        line: extractLineNum(line, lines),
        confidence: 0.8,
        severity: 'medium',
      });
    }

    const ipMatch = line.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    if (ipMatch && ipMatch[0] !== '127.0.0.1' && ipMatch[0] !== '0.0.0.0') {
      results.push({
        rule: 'hardcoded-ip',
        file: filename,
        message: 'Hardcoded IP address - consider using configuration',
        line: extractLineNum(line, lines),
        confidence: 0.6,
        severity: 'low',
      });
    }
  }

  return results;
}

function extractLineNum(targetLine, allLines) {
  const idx = allLines.findIndex(l => l.includes(targetLine.substring(0, 30)));
  return idx >= 0 ? idx + 1 : 1;
}

module.exports = { analyzeCodeChanges };
