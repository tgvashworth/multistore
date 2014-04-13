/* global describe, it, beforeEach, expect */
'use strict';

define(function (require) {

    var Store = require('../src/store');

    function noop() {}

    function QuotaExceededError() {}

    function throwQuotaExceeded() {
        throw new QuotaExceededError();
    }

    function cleanup() {
        localStorage.clear();
        sessionStorage.clear();
        Store.clearKeyRegistry();
    }

    var brokenStorage = Object.create({
        setItem: throwQuotaExceeded,
        getItem: noop,
        removeItem: noop,
        clear: noop
    });

    var integerTransformer = {
        parse: function (val) {
            return parseInt(val, 10);
        },
        stringify: function (val) {
            return '' + parseInt(val, 10);
        }
    };

    describe('Store', function () {

        beforeEach(cleanup);

        it('is globally available', function () {
            expect(window.Store).to.be.ok();
        });

        it('is required successfully', function () {
            expect(Store).to.be.a('function');
        });

        it('can be used to create stores', function () {
            var store = new Store();
            expect(store).to.be.ok();
        });

        it('returns value from declared key', function () {
            localStorage.example = 'test';
            var store = new Store('example');
            expect(
                store.get('example')
            ).to.be('test');
        });

        it('should support multiple key declarations', function () {
            localStorage.example1 = 'test1';
            localStorage.example2 = 'test2';
            var store = new Store(['example1', 'example2']);
            expect(
                store.get('example1')
            ).to.be('test1');
            expect(
                store.get('example2')
            ).to.be('test2');
        });

        it('sets and returns value at declared key', function () {
            var store = new Store('example');
            expect(
                store.set('example', 'test')
            ).to.be('test');
            expect(localStorage.example).to.be('test');
        });

        it('should remove a value at declared key', function () {
            var store = new Store('example');
            localStorage.example = 'test';
            store.remove('example');
            expect(localStorage.example).to.be(undefined);
        });

    });

    describe('testBackend', function () {

        beforeEach(cleanup);

        it('should check for setItem', function () {
            expect(function () {
                new Store('example', {
                    backend: {}
                });
            }).to.throwError(/No usable backends could be found/);
        });

        it('should check for getItem', function () {
            expect(function () {
                new Store('example', {
                    backend: { setItem: noop }
                });
            }).to.throwError(/No usable backends could be found/);
        });

        it('should check for removeItem', function () {
            expect(function () {
                new Store('example', {
                    backend: { setItem: noop, getItem: noop }
                });
            }).to.throwError(/No usable backends could be found/);
        });

        it('should check for clear', function () {
            expect(function () {
                new Store('example', {
                    backend: { setItem: noop, getItem: noop, clear: noop }
                });
            }).to.throwError(/No usable backends could be found/);
        });

        it('should check for available space', function () {
            expect(function () {
                new Store('example', {
                    backend: brokenStorage
                });
            }).to.throwError(/No usable backends could be found/);
        });

    });

    describe('setKeys', function () {

        beforeEach(cleanup);

        it('takes a string key and returns an array containing that key', function () {
            var store = new Store();
            expect(
                store.setKeys('example')
            ).to.eql(['example']);
        });

        it('takes an array of keys and returns an array containing those keys', function () {
            var store = new Store();
            expect(
                store.setKeys(['example', 'other'])
            ).to.eql(['example', 'other']);
        });

        it('should dedupe the key array', function () {
            var store = new Store();
            expect(
                store.setKeys(['example', 'other', 'example'])
            ).to.eql(['example', 'other']);
        });

        it('should throw if a key is not a string', function () {
            var store = new Store();
            expect(function () {
                store.setKeys([false]);
            }).to.throwError(/All keys must be strings/);
        });

        it('should make store.keys available', function () {
            var store = new Store();
            store.setKeys(['example', 'other', 'example']);
            expect(
                store.keys
            ).to.eql(['example', 'other']);
        });

        it('should prevent store.keys being set', function () {
            var store = new Store();
            store.setKeys(['example', 'other', 'example']);
            expect(function () {
                store.keys = ['naughty'];
            }).to.throwError();
            expect(
                store.keys
            ).to.eql(['example', 'other']);
        });

    });

    describe('keyspacing', function () {

        beforeEach(cleanup);

        it('does not allow getting of undeclared keys', function () {
            localStorage.undeclared = 'test';
            var store = new Store();
            expect(function () {
                store.get('undeclared');
            }).to.throwError(/Attempting to get undeclared key: undeclared/);
        });

        it('does not allow setting of undeclared keys', function () {
            localStorage.undeclared = 'test';
            var store = new Store();
            expect(function () {
                store.set('undeclared', 'hello');
            }).to.throwError(/Attempting to set undeclared key: undeclared/);
            expect(localStorage.undeclared).to.be('test');
        });

        it('does not allow removing of undeclared keys', function () {
            localStorage.undeclared = 'test';
            var store = new Store();
            expect(function () {
                store.remove('undeclared');
            }).to.throwError(/Attempting to remove undeclared key: undeclared/);
            expect(localStorage.undeclared).to.be('test');
        });

        it('does not allow new stores to use already used keys', function () {
            new Store('example');
            expect(function () {
                new Store('example');
            }).to.throwError(/Attempting to declare already declared key: example/);
        });

    });

    describe('backend selector', function () {

        beforeEach(cleanup);

        it('should allow choice of a session backend', function () {
            var store = new Store('example', {
                backend: 'session'
            });
            expect(
                 store.set('example', 'test')
            ).to.be('test');
            expect(sessionStorage.example).to.be('test');
            expect(localStorage.example).to.be(undefined);
        });

        it('should allow choice of local backend', function () {
            var store = new Store('example', {
                backend: 'local'
            });
            expect(
                 store.set('example', 'test')
            ).to.be('test');
            expect(localStorage.example).to.be('test');
            expect(sessionStorage.example).to.be(undefined);
        });

        it('should allow choice of a different backend with the object', function () {
            var store = new Store('example', {
                backend: sessionStorage
            });
            expect(
                 store.set('example', 'test')
            ).to.be('test');
            expect(sessionStorage.example).to.be('test');
            expect(localStorage.example).to.be(undefined);
        });

        it('throw on unusable backend', function () {
            expect(function () {
                new Store('example', {
                    backend: brokenStorage
                });
            }).to.throwError();
        });

        it('should fallback to backends in list', function () {
            var store;
            expect(function () {
                store = new Store('example', {
                    backend: [brokenStorage, 'local']
                });
            }).not.to.throwError();
            expect(
               store.set('example', 'test')
            ).to.be('test');
            expect(localStorage.example).to.be('test');
        });

        describe('set backend', function () {

            beforeEach(cleanup);

            it('should copy all keys across', function () {
                var store = new Store(['example1', 'example2']);
                store.set('example1', '10');
                store.set('example2', '20');
                expect(localStorage.example1).to.be('10');
                store.setBackend('session');
                expect(sessionStorage.example1).to.be('10');
                expect(localStorage.example1).to.be(undefined);
            });

            it('should follow the same fallback procedure', function () {
                var store = new Store(['example1', 'example2']);
                store.set('example1', '10');
                store.set('example2', '20');
                expect(localStorage.example1).to.be('10');
                store.setBackend([brokenStorage, 'session']);
                expect(sessionStorage.example1).to.be('10');
                expect(localStorage.example1).to.be(undefined);
            });

        });

    });

    describe('transformer', function () {

        describe('parse', function () {

            beforeEach(cleanup);

            it('should support JSON as transformer', function () {
                var store = new Store('example', {
                    transformer: JSON
                });
                localStorage.example = '{ "a": 10 }';
                expect(
                    store.get('example')
                ).to.eql({ a: 10 });
            });

            it('should support custom transformer', function () {
                var store = new Store('example', {
                    transformer: integerTransformer
                });
                localStorage.example = '10';
                expect(
                    store.get('example')
                ).to.eql(10);
            });

        });

        describe('stringify', function () {

            beforeEach(cleanup);

            it('should support JSON as transformer', function () {
                var store = new Store('example', {
                    transformer: JSON
                });
                store.set('example', { a: 10 });
                expect(localStorage.example).to.be('{"a":10}');
            });

            it('should support custom transformer', function () {
                var store = new Store('example', {
                    transformer: integerTransformer
                });
                store.set('example', '10.233242');
                expect(localStorage.example).to.be('10');
            });

        });

        describe('pass transformer', function () {

            beforeEach(cleanup);

            it('should not allow methods to be overwritten', function () {
                var store = new Store('example');
                expect(function () {
                    Store.passTransformer.stringify = function (v) {
                        console.log('TRIED TO SET', v);
                        return 'ANOTHER THING';
                    };
                    store.set('example', 'THING');
                }).to.throwError();
            });

        });

    });

});
