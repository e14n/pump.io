// renew-web-ui-test.js
//
// Test that the renew old or missing OAuth tokens
//
// Copyright 2011-2017, E14N https://e14n.com/ and contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use strict";

var assert = require("assert"),
    vows = require("vows"),
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    Browser = require("zombie"),
    Step = require("step"),
    setupAppConfig = apputil.setupAppConfig,
    newCredentials = oauthutil.newCredentials;

var browserClose = function(br) {
    Step(
        function() {
            br.on("closed", this);
            br.window.close();
        },
        function() {
            // browser is closed
        }
    );
};

var suite = vows.describe("renew OAuth in UI test");

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupAppConfig({site: "Test"}, this.callback);
            Browser.localhost("localhost", 4815);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we register a user with the API": {
            topic: function() {
                newCredentials("croach", "ihave1onus", "localhost", 4815, this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.ok(cred);
            },
            "and we visit the login user": {
                topic: function(cred) {
                    var browser = new Browser(),
                        callback = this.callback,
                        user =  cred.user;

                    browser.visit("/main/login")
                        .then(function() {
                            browser.fill("#nickname", user.nickname)
                                .fill("#password", "ihave1onus")
                                .pressButton("div#loginpage form button[type=\"submit\"]", function() {
                                    callback(null, browser);
                                }, callback);
                        }, callback);
                },
                teardown: function(br) {
                    browserClose(br);
                },
                "it works": function(err, br) {
                    assert.ifError(err);
                    br.assert.success("ok");
                    br.assert.elements(".nav.pull-right li #register", 0);
                },
                "and we visit the Followers with active session in new window": {
                    topic: function(br, cred) {
                        var browser = new Browser(),
                            callback = this.callback,
                            user =  cred.user;

                        browser.visit("/" + user.nickname + "/followers", function() {
                            callback(!browser.success, browser);
                        });
                    },
                    teardown: function(br) {
                        browserClose(br);
                    },
                    "it works": function(err, br) {
                        assert.ifError(err);
                        br.assert.success("ok");
                        br.assert.text("#user-content-followers h2", "Followers");
                    }
                },
                "and we invalidate user token and visit Activity section": {
                    topic: function(browser, cred) {
                        var callback = this.callback,
                            user = cred.user,
                            localStorage = browser.window.localStorage,
                            userCred = {
                                token: localStorage["cred:token"],
                                secret: localStorage["cred:scret"]
                            },
                            invalidToken = userCred.token + "_";


                        // Invalidate userToken to force renew
                        localStorage["cred:token"] = invalidToken;
                        browser.window.Pump.token = invalidToken;

                        // Change section to make API requests
                        browser.clickLink("#fat-menu .dropdown-menu li a[href='/" + user.nickname + "']", function() {
                            callback(null, browser, user, userCred);
                        });
                    },
                    teardown: function(br) {
                        browserClose(br);
                    },
                    "it works": function(err, br, user, cred) {
                        assert.ifError(err);
                        br.assert.success("ok");
                        br.assert.text("#profile-block .p-name", user.nickname);
                    },
                    "it has new credentials": function(err, br, user, cred) {
                        assert.includes(br.window, "localStorage");
                        var localStorage = br.window.localStorage;
                        assert.includes(localStorage, "cred:token");
                        assert.includes(localStorage, "cred:secret");
                        assert.isNotNull(localStorage["cred:secret"]);
                        assert.isNotNull(localStorage["cred:token"]);
                        assert.notEqual(localStorage["cred:token"], cred.token);
                        assert.notEqual(localStorage["cred:secret"], cred.secret);
                    },
                    "and we visit Favorites section with active session but empty localStorage": {
                        topic: function(browser, user, cred) {
                            var callback = this.callback,
                                localStorage = browser.window.localStorage;

                            // Clean localStorage with this because `.clean()` not works in zombie
                            for (var key in localStorage) {
                                if (localStorage.hasOwnProperty(key)) {
                                    delete browser.window.localStorage[key];
                                }
                            }

                            browser.visit("/" + user.nickname + "/favorites", function() {
                                callback(!browser.success, browser, user);
                            });
                        },
                        teardown: function(br) {
                            browserClose(br);
                        },
                        "it works": function(err, br) {
                            assert.ifError(err);
                            br.assert.success("ok");
                        },
                        "it keep in favorites section": function(err, br, user) {
                            br.assert.url({ pathname: "/" + user.nickname + "/favorites" });
                        },
                        "it has new credentials": function(err, br) {
                            assert.includes(br.window, "localStorage");
                            var localStorage = br.window.localStorage;
                            assert.includes(localStorage, "cred:token");
                            assert.includes(localStorage, "cred:secret");
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
