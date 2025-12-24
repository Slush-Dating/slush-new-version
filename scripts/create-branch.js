const [, , type, component, name] = process.argv;

if (!type || !component || !name) {
    console.log('Usage: npm run create:branch -- <type> <component> <name>');
    process.exit(1);
}

const branch = `${type}/${component}-${name}`;
console.log(`Creating branch: ${branch}`);

// Logic for creating the branch could be added here if needed,
// but for now we are just keeping the parity with the original script.
process.exit(0);
