module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation changes
        'style',    // Code style changes (formatting)
        'refactor', // Code refactoring
        'perf',     // Performance improvements
        'test',     // Test additions/changes
        'chore',    // Build process or auxiliary tool changes
        'ci',       // CI configuration changes
        'build',    // Build system changes
        'revert'    // Revert previous commit
      ]
    ],
    'subject-case': [2, 'always', 'sentence-case'],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100]
  }
};
