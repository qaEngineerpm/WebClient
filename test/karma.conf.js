const path = require('path');

process.env.CHROME_BIN = require('puppeteer').executablePath();

module.exports = (config) => {
    config.set({
        basePath: '',
        frameworks: ['jasmine'],

        client: {
            jasmine: {
                random: false,
                failFast: true,
                timeoutInterval: 5000
            }
        },

        // list of files / patterns to load in the browser
        files: [
            'specs/index.js'
        ],

        webpack: {
            mode: 'development',
            module: {
                rules: [
                    // ...require('../webpack.tasks/js.loader'),
                     // Use a simple css loader because karma-webpack does not work with ours
                    ...require('../webpack.tasks/css.tests.loader'),
                    ...require('../webpack.tasks/templates.loader'),
                    ...require('../webpack.tasks/assets.loader')
                ]
            },
            plugins: require('../webpack.tasks/plugins'),
            resolve: {
                alias: {
                    iconv: 'iconv-lite'
                }
            }
        },

        preprocessors: {
            'specs/index.js': ['webpack', 'coverage']
        },

        // optionally, configure the reporter
        coverageReporter: {
            instrumenterOptions: { istanbul: { noCompact: true } },
            reporters: [
                // { type: 'html', dir: 'coverage/' },
                { type: 'clover', dir: 'coverage/clover/' }
            ]
        },

        reporters: ['progress', 'coverage', 'coverage-istanbul', 'junit'],
        junitReporter: {
            outputDir: 'coverage',
            outputFile: 'test-results.xml'
        },
        coverageIstanbulReporter: {
            reports: ['html', 'text-summary'],
            dir: path.resolve('coverage/%browser%'),
            fixWebpackSourcePaths: true
        },
        port: 9876,
        colors: true,
        concurrency: Infinity,
        webpackMiddleware: {
            stats: 'minimal'
        },

        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_INFO,
        autoWatch: false,
        customLaunchers: {
          ChromeHeadlessCI: {
            base: 'ChromeHeadless',
            flags: ['--no-sandbox']
          }
        },
        browsers: ['ChromeHeadlessCI'],
        singleRun: true
    });
};
