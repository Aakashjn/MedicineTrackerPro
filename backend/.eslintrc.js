module.exports = {
    "env": {
        "commonjs": true,
        "es2021": true,
        "node": true,
        "jest": true
    },
    "extends": [
        "eslint:recommended"
    ],
    "parserOptions": {
        "ecmaVersion": "latest"
    },
    "rules": {
        "no-console": "off",
        "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
        "no-undef": "error"
    }
};
