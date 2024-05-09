It took considerably amount of time to find out a cross platform way of finding the current current position in terminal.

The solution below ended to be a very consice block of NodeJS code.

```node
const whenCursorPosition = () => {
    return new Promise((resolve, reject) => {
        // Trigger the terminal to report the cursor position
        process.stdout.write('\x1b[6n');
        // Wait for the terminal to respond with the cursor position, once
        process.stdin.once('data', (data) => {
            // Parse the terminal response (e.g. ^[[24;1R) to extract the cursor position
            const match = data.toString().match(/\[(\d+);(\d+)R/);
            if (match) {
                // Return the cursor position object
                resolve({ rows: parseInt(match[1], 10), cols: parseInt(match[2], 10) });
            } else {
                reject(new Error('Failed to parse cursor position'));
            }
        });
    });
}
```

The idea is to send `\x1b[6n` terminal signal and wait for the position information coming back. Incoming data is catched with `stdin` and rows / cols data is parsed from the temrinal signal coming in.

In the application logic this is called with:

```node
await whenCursorPosition().then((cursor) => {
    // Do something with cursor.rows and cursor.cols
}).catch((error) => {
    console.error(`Error getting cursor position: ${error}`);
});
```
