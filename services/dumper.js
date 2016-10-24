'use strict';
const P = require('bluebird');
const fs = require('fs');
const _ = require('lodash');
const mkdirpSync = require('mkdirp');
const mkdirp = P.promisify(mkdirpSync);
const KeyGenerator = require('./key-generator');

function Dumper(project, config) {
  function isUnderscored(fields) {
    let underscored = false;

    fields.forEach((f) => {
      if (f.name.includes('_')) { underscored = true; }
    });

    return underscored;
  }

  function hasTimestamps(fields) {
    let hasCreatedAt = false;
    let hasUpdatedAt = false;

    fields.forEach((f) => {
      if (_.camelCase(f.name) === 'createdAt') {
        hasCreatedAt = true;
      }

      if (_.camelCase(f.name) === 'updatedAt') {
        hasUpdatedAt = true;
      }
    });

    return hasCreatedAt && hasUpdatedAt;
  }

  function copyTemplate(from, to) {
    from = `${__dirname}/../templates/app/` + from;
    fs.writeFileSync(to, fs.readFileSync(from, 'utf-8'));
  }

  function writePackageJson(path) {
    let dependencies = {
      'express': '~4.13.4',
      'express-jwt': '~5.1.0',
      'express-cors': '0.0.3',
      'body-parser': '~1.15.1',
      'cookie-parser': '~1.4.3',
      'debug': '~2.2.0',
      'morgan': '~1.7.0',
      'serve-favicon': '~2.3.0',
      'dotenv': '~2.0.0',
      'chalk': '~1.1.3',
      'sequelize': '~3.24.8',
      'forest-express-sequelize': 'latest'
    };

    if (config.dbDialect === 'postgres') {
      dependencies.pg = '~6.1.0';
    } else if (config.dbDialect === 'mysql') {
      dependencies.mysql = '~2.12.0';
    }

    let pkg = {
      name: config.appName,
      version: '0.0.1',
      private: true,
      scripts: { start: 'node ./bin/www' },
      dependencies: dependencies
    };

    fs.writeFileSync(`${path}/package.json`,
      `${JSON.stringify(pkg, null, 2)}\n`);
  }

  function writeDotGitIgnore(path) {
    let templatePath = `${__dirname}/../templates/app/gitignore`;
    let template = _.template(fs.readFileSync(templatePath, 'utf-8'));

    fs.writeFileSync(`${path}/.gitignore`, template({}));
  }

  function writeDotEnv(path, authKey) {
    let templatePath = `${__dirname}/../templates/app/env`;
    let template = _.template(fs.readFileSync(templatePath, 'utf-8'));

    let settings = {
      forestSecretKey: project.environments[0].secretKey,
      forestAuthKey: authKey,
      databaseUrl: `${config.dbDialect}://${config.dbUser}:${config.dbPassword}@${config.dbHostname}:${config.dbPort}/${config.dbName}`,
      forestUrl: process.env.FOREST_URL
    };

    fs.writeFileSync(`${path}/.env`, template(settings));
  }

  function writeModels(path, table, fields, references) {
    let templatePath = `${__dirname}/../templates/model.txt`;
    let template = _.template(fs.readFileSync(templatePath, 'utf-8'));

    let text = template({
      table: table,
      fields: fields,
      references: references,
      underscored: isUnderscored(fields),
      timestamps: hasTimestamps(fields)
    });

    fs.writeFileSync(`${path}/models/${table}.js`, text);
  }

  this.dump = function (table, fields, references) {
    let path = `${process.cwd()}/${config.appName}`;
    let binPath = `${path}/bin`;
    let routesPath = `${path}/routes`;
    let forestPath = `${path}/forest`;
    let publicPath = `${path}/public`;
    let modelsPath = `${path}/models`;

    return P
      .all([
        mkdirp(path),
        mkdirp(binPath),
        mkdirp(routesPath),
        mkdirp(forestPath),
        mkdirp(publicPath),
        mkdirp(modelsPath)
      ])
      .then(() => {
        return new KeyGenerator().generate();
      })
      .then((authKey) => {
        copyTemplate('bin/www', `${binPath}/www`);
        copyTemplate('models/index.js', `${path}/models/index.js`);
        copyTemplate('public/favicon.png', `${path}/public/favicon.png`);
        copyTemplate('app.js', `${path}/app.js`);

        writePackageJson(path);
        writeDotGitIgnore(path);
        writeDotEnv(path, authKey);
        writeModels(path, table, fields, references);
      });
  };
}

module.exports = Dumper;
