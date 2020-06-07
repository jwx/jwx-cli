import typescript from 'rollup-plugin-typescript';

export default {
    input: 'lib/index.ts',
    output: {
        file: 'dist/index.js',
        format: 'cjs',
        sourceMap: 'inline'
    },
    plugins: [
        typescript()
    ]
};
