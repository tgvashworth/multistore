// # Store
//
// A reusable Store module with the following characteristics:
//   - Enforced keyspacing
//   - Able to transfer data between backends
//   - Support any type of data
//   - Fit around existing data
//   - Avoid clearing at all costs
//   - Loud about errors
(function (root) {
    'use strict';

    // Key registry keeps track of the keys used by the stores, to make sure they can't use each
    // other's data.
    var __keyRegistry = {};

    // Construct a `new Store`, passing the keys you'd like access to and, optionally, some options.
    //
    // Options:
    //   - transformer: object with `parse` and `stringify` methods, used to transform the data on
    //     set and get respectively. Defaults to the Store.passTranformer object.
    //   - backend: string, object or array of backends. The store will test each backend,
    //     left-to-right, and choose the first it finds that passes all the tests. A backend must
    //     implement `setItem`, `getItem`, `removeItem` and `clear` methods. Defaults to ['local'].
    function Store(keys, opts) {
        this.setKeys(keys);

        // Opts must be an object because we're about to start using it like one!
        if (!(opts && typeof opts === 'object')) {
            opts = {};
        }

        // Use and test the supplied transformer, defaulting to the invisible passTransformer.
        opts.transformer = opts.transformer || Store.passTransformer;
        this.testTransformer(opts.transformer);
        this.transformer = opts.transformer;

        // Use and set (and therefore test) the supplied backend, defaulting to local storage.
        opts.backend = opts.backend || ['local'];
        this.setBackend(opts.backend);
    }

    // Map backend strings to their actual storage objects.
    Store.backendMap = {
        local:   localStorage,
        session: sessionStorage
    };

    // Transparent transformer that doesn't affect the value. Used by default. The object is frozen
    // to prevent the methods being overwritten, which would allow values to be inspected as they
    // are get or set to a backend.
    Store.passTransformer = Object.freeze({
        parse: pass,
        stringify: pass
    });

    // Gets value at `key` from the current backend, if the key was declared when the store was
    // constructed. Takes a string `key`, and returns the value. The value will be put through the
    // current transformer on the way out.
    Store.prototype.get = function (key) {
        if (!this.hasDeclared(key)) {
            throw new Error('Attempting to get undeclared key: ' + key);
        }
        return this.transformer.parse(
            this.backend.getItem(key)
        );
    };

    // Sets 'value' to `key` against the current backend, if the key was declared when the store was
    // constructed. Takes a string key and value. The value will be passed through a transformer, if
    // defined. Returns the value that was set.
    Store.prototype.set = function (key, value) {
        if (!this.hasDeclared(key)) {
            throw new Error('Attempting to set undeclared key: ' + key);
        }
        this.backend.setItem(
            key,
            this.transformer.stringify(value)
        );
        return value;
    };

    // Removes the value at `key` from the current backend, if the key was declared when the store
    // was constructed.
    // Takes a string key.
    // Returns whatever the current backend's removeItem implementation returns.
    Store.prototype.remove = function (key) {
        if (!this.hasDeclared(key)) {
            throw new Error('Attempting to remove undeclared key: ' + key);
        }
        return this.backend.removeItem(key);
    };

    // Declare the set of keys this store can access.
    // Takes a single string key, or an array of string keys.
    // Returns the resulting array of this store's keys.
    Store.prototype.setKeys = function (keys) {
        if (typeof keys === 'undefined') {
            keys = [];
        }

        if (!Array.isArray(keys)) {
            keys = [keys];
        }

        // Remove the currently used keys from the key registry.
        if (typeof this.keys !== 'undefined') {
            this.keys.forEach(function (key) {
                // The key registry is in scope of the constructor, but not exported.
                delete __keyRegistry[key];
            });
        }

        // Define the "private" `keyMap` property. Every get and set checks if a key has been
        // declared, so we optimize for that use by sticking them in a map.
        Object.defineProperty(this, 'keyMap', {

            // We should be able to redefine this property again, but it shouldn't show up in
            // Object.keys.
            configurable: true,
            enumerable: false,

            // Create the new value by reducing over the supplied keys.
            value: keys.reduce(function (keyMap, key) {
                if (typeof key !== 'string') {
                    throw new TypeError('All keys must be strings');
                }

                // If we own this key then it's fine for it already to have been declared, so we
                // check to see if this key is already in use, but only throw if it's not us who's
                // declared it.
                var alreadyDeclaredKey = (keyMap[key] === key);
                if (!this.canDeclare(key) && !alreadyDeclaredKey) {
                    throw new Error('Attempting to declare already declared key: ' + key);
                }

                // Save the key to the global key registry, and to our own key map.
                __keyRegistry[key] = key;
                keyMap[key] = key;

                return keyMap;
            }.bind(this), {})
        });

        // Now define the public `keys` property, which is calculated from the `keyMap`. It's not
        // writable, but it does show up in our key list.
        Object.defineProperty(this, 'keys', {
            configurable: true,
            enumerable: true,
            writable: false,
            value: Object.keys(this.keyMap)
        });

        return this.keys;
    };

    // Test if a supplied key is accessible by this store.
    // Returns boolean.
    Store.prototype.hasDeclared = function (key) {
        if (typeof this.keyMap !== 'object') return false;
        return !!this.keyMap[key];
    };

    // Tests if supplied key is available for use by the store.
    // Takes a keys
    Store.prototype.canDeclare = function (key) {
        return !__keyRegistry[key];
    };

    // Pick a usable backend for the store to use.
    // Takes a single backend or an array.
    // It will iterate through the supplied backends until it finds one that passes the testBacked
    // tests. If it doesn't find a working backend, it will throw.
    // If switching from an existing backend, all the data will be copied over during the switch.
    // Returns the new backend.
    Store.prototype.setBackend = function (backends) {
        if (!Array.isArray(backends)) {
            backends = [backends];
        }

        // Pick the first usable backend from supplied list.
        var newBackend;
        backends.some(function (backend) {
            // Support supplying strings like `local` and `session`.
            if (Store.backendMap.hasOwnProperty(backend)) {
                backend = Store.backendMap[backend];
            }

            try {
                this.testBackend(backend);
            } catch (e) {
                return false;
            }

            newBackend = backend;

            return true;
        }.bind(this));

        if (!newBackend) {
            throw new TypeError('No usable backends could be found');
        }

        // Save data to be copied over when switching backend.
        var copyData = [];
        if (this.backend) {
            copyData = this.keys.map(function (key) {
                var value = this.get(key);
                // Don't leave the data lying around!
                this.remove(key);
                return [key, value];
            }.bind(this));
        }

        this.backend = newBackend;

        // Copy data back into the new backend.
        copyData.forEach(function (tuple) {
            this.set.apply(this, tuple);
        }.bind(this));

        return this.backend;
    };

    // Test supplied backend, unsuring that it has neccessary methods and isn't  full.
    // Takes an object, backend.
    // Returns nothing, but throws on failure.
    Store.prototype.testBackend = function (backend) {
        // Check that the supplied backed supports these methods.
        ['setItem', 'getItem', 'removeItem', 'clear'].forEach(function (methodName) {
            if (typeof backend[methodName] !== 'function') {
                throw new TypeError('Backend missing method, "' + methodName + '"');
            }
        });
        // Try to set a value in the backend. If any of these throws, we know there's a problem.
        var now = Date.now();
        backend.setItem(now, now);
        backend.getItem(now);
        backend.removeItem(now);
    };

    // Set the store's transformer.
    // Takes object with parse and stringify methods.
    // Returns nothing but throws if the transformer is missing the required methods.
    Store.prototype.testTransformer = function (transformer) {
        ['parse', 'stringify'].forEach(function (methodName) {
            if (typeof transformer[methodName] !== 'function') {
                throw new TypeError('Transformer missing method, "' + methodName + '"');
            }
        });
    };

    // Utility methods for use in the default transformer.
    function pass(v) {return v;}

    // Clears the registry of all known keys. **Do not use this in production.**
    Store.clearKeyRegistry = function () {
        __keyRegistry = {};
    };

    // If AMD is around, call define and return the constructor.
    if (typeof define === 'function' && define.amd) {
        define(function () {
            return Store;
        });
    }

    // Otherwise, attach to the global object as global.Store.
    if (typeof root.Store === 'undefined') {
        root.Store = Store;
    }

}(this));
