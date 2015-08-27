var through = require('through2');
var gutil = require('gulp-util');
var path = require('path');
var fs = require('fs');
var Promise = require("bluebird");
var _ = require('lodash');

Promise.promisifyAll(fs);

var PluginError = gutil.PluginError;
var green = gutil.colors.green;
var PLUGIN_NAME = "gulp-html-list";

function htmlList(options) {
    var cwd, project_name, pages = [],
        baseUrl = options.domain + options.username + '/' + options.projectName + "/";

    function getPageInfo(file) {
        var page = {};
        page.fileName = path.basename(file.path);

        var relativePath = file.path.replace(/^.*publish/, "").replace(/\\/g, '/');
        page.testUrl = baseUrl + relativePath;

        var contents = file.contents.toString();
        var matches = /\<title\>(.*)--(.*)\<\/title\>/ig.exec(contents);
        if (!matches) {
            throw new PluginError(PLUGIN_NAME, "html file must have <title> for: " + page.fileName);
        }
        page.title = matches[1];
        if (!project_name)
            project_name = matches[2];
        return page;
    }


    function transformFile(file, env, cb) {
        if (!cwd) {
            cwd = file.cwd;
        }
        if (file.isNull()) {
            return cb(null, file);
        }
        if (file.isStream()) {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
            return cb();
        }

        //var verbose = "";
        //verbose += ", base: " + file.base;
        //verbose += ", path: " + file.path;
        //verbose += ", cwd: " + file.cwd;
        ////verbose += ", stat: " + file.stat;
        //console.log('file: ', verbose);

        pages.push(getPageInfo(file));
        cb(null, file);
    }

    function flushFn(cb) {
        var listJsonFile = cwd + "/mail/list.json",
            mailJsonFile = cwd + "/mail/mail.json";

        fs.readFileAsync(listJsonFile, "utf8").then(function (data) {
            var listJson = JSON.parse(data);
            if (!listJson.author) {
                listJson.author = options.username;
            }
            if (!listJson.project_name || listJson.project_name !== project_name)
                listJson.project_name = project_name;

            var oldPages = [], newPages = [];

            if (listJson.old_page) {
                pages.forEach(function (page) {
                    if (!_.some(listJson.old_page, {title: page.title})) {
                        newPages.push(page);
                    }
                });
            }
            listJson.new_page = newPages;
            gutil.log(green("update list.json file"));
            return fs.writeFileAsync(listJsonFile, JSON.stringify(listJson));
        }).then(function () {
            return fs.readFileAsync(mailJsonFile, 'utf8');
        }).then(function (data) {
            var mailJson = JSON.parse(data);
            mailJson.author = options.username;
            mailJson.name = options.projectName;
            var _pages = _.without(pages, {title: "list"});
            mailJson.page = [{title: 'list', testUrl: baseUrl + '/html/list.html'}].concat(_pages);

            gutil.log(green("update mail.json file!"));
            return fs.writeFileAsync(mailJsonFile, JSON.stringify(mailJson));
        }).then(function () {
            cb();
        });
    }

    return through.obj(transformFile, flushFn);
}

module.exports = htmlList;