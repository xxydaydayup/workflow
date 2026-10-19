export default {
  extends: ['stylelint-config-standard'],
  customSyntax: 'postcss-less',
  rules: {
    'selector-class-pattern': null,
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
    'at-rule-no-unknown': [true, { ignoreAtRules: ['plugin', 'import'] }],
    'declaration-block-no-redundant-longhand-properties': null,
    'declaration-block-single-line-max-declarations': null,
    'import-notation': null,
    'value-keyword-case': null,
    'color-function-alias-notation': null,
    'color-function-notation': null,
    'alpha-value-notation': null,
    'media-feature-range-notation': null,
    'no-descending-specificity': null,
    'rule-empty-line-before': null,
  },
}
