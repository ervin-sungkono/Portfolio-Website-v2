/** @type {import('stylelint').Config} */
module.exports = {
  extends: ['stylelint-config-standard'],
  rules: {
    'rule-empty-line-before': [
      'always',
      {
        except: ['after-single-line-comment'],
        ignore: ['first-nested'],
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.module.css'],
      rules: {
        // CSS Modules use camelCase selectors referenced as styles.foo in React.
        'selector-class-pattern': '^[a-z][a-zA-Z0-9]*(-[a-z0-9]+)*$',
        // :global() is a supported CSS Modules extension.
        'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
        // Distinct module-scoped classes are hashed at build time, so this rule
        // reports false collisions when it compares selectors across modules.
        'no-descending-specificity': null,
      },
    },
  ],
};
