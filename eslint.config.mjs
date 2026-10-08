import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const SQL_TEXT = '/(SELECT|INSERT +INTO|DELETE +FROM|UPDATE +[a-z_]+ +SET)/i';
const SAFE_CONSTANT = '/^[A-Z][A-Z0-9_]*$/';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/__tests__'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: `TemplateLiteral:has(TemplateElement[value.raw=${SQL_TEXT}]) > :matches(CallExpression, ConditionalExpression, LogicalExpression, BinaryExpression, MemberExpression[object.type!=Identifier], TemplateLiteral)`,
          message: 'SQL must not interpolate expressions. Use $1, $2 placeholders and pass the values as parameters.',
        },
        {
          selector: `TemplateLiteral:has(TemplateElement[value.raw=${SQL_TEXT}]) > Identifier[name!=${SAFE_CONSTANT}]`,
          message: 'SQL may only interpolate UPPER_CASE constants. Pass variable data as $n parameters.',
        },
        {
          selector: `TemplateLiteral:has(TemplateElement[value.raw=${SQL_TEXT}]) > MemberExpression[object.type=Identifier][object.name!=${SAFE_CONSTANT}]`,
          message: 'SQL may only interpolate UPPER_CASE constants. Pass variable data as $n parameters.',
        },
        {
          selector: 'CallExpression[callee.property.name=/^(query|execute)$/] > BinaryExpression:first-child',
          message: 'Do not build SQL by concatenation. Use $n placeholders and pass the values as parameters.',
        },
      ],
    },
  },
);
