// Subprocess protocol double. It does NOT read or write Project Graph files.
const [mode, ...args] = process.argv.slice(2);
const schema = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] };
const entries = ['get_all_nodes', 'create_text_node'].map(name => ({ name, description: name, inputSchema: schema }));
if (mode === 'hang') setInterval(() => {}, 1000);
else if (mode === 'overflow') process.stdout.write('x'.repeat(200000));
else if (mode === 'malformed') process.stdout.write('not json');
else if (mode === 'error') {
  process.stderr.write('diagnostic line\n' + JSON.stringify({ code: 'STALE_REF', message: 'Reference expired', details: { ref: 'n9' } }) + '\n');
  process.exitCode = 1;
} else if (mode === 'plain-error') { process.stderr.write('failure without JSON'); process.exitCode = 7; }
else if (mode === 'empty') { /* no output, as with an unsupported executable */ }
else if (args[0] === '--version') process.stdout.write('test-runtime-1\n');
else if (args[1] === 'list') process.stdout.write(JSON.stringify(mode === 'missing' ? entries.slice(0, 1) : entries));
else if (args[1] === 'describe') process.stdout.write(JSON.stringify(entries.find(e => e.name === args[2])));
else if (args[1] === 'invoke') process.stdout.write(JSON.stringify({ args, input: JSON.parse(args[6]) }));
else { process.stderr.write('unexpected arguments'); process.exitCode = 2; }
