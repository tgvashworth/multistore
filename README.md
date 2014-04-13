# Store

A reusable Store module with the following characteristics:

  - Enforced keyspacing
  - Able to transfer data between backends
  - Support any type of data
  - Fit around existing data
  - Avoid clearing at all costs
  - Loud about errors

Here's an example:

```javascript
// Create a new store, passing the keys we want and some options
var store = new Store(['user', 'auth'], {
    // Prefer local storage, but fall back to session
    backend: ['local', 'session'],
    // Run data through JSON.stringify on the way in (set),
    // and JSON.parse on the way out (get).
    transformer: JSON
});

// Set and get some data
store.set('user', { id: 10, name: 'Tom' });
var user = store.get('user'); // user.name === 'Tom'

// You cannot use keys you haven't declared
store.set('not-allowed', { evil: true }); // Throws!
```

## Documentation

The [code](src/store.js) is very well documented; have a read.

## License

MIT
