// backend/.eslintrc.js
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
        // UPDATED: Added 'req|res|next' to argsIgnorePattern
        "no-unused-vars": ["warn", { "argsIgnorePattern": "^_|req|res|next" }],
        "no-undef": "error"
    }
};
