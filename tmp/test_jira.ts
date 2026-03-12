async function testJira() {
    const domainUrl = 'https://mobilefirstapplications-team-k1f9xhyn.atlassian.net';

    // The API route strips out 'https://' from the form if the user includes it?
    // Let's check how the route handles it.

    // The user input
    const rawDomain = domainUrl;

    // What the verify function does:
    // const url = `https://${domain}/rest/api/3/myself`;

    console.log(`If domain=${rawDomain}`);
    console.log(`URL becomes: https://${rawDomain}/rest/api/3/myself`);

    // So if the user enters "https://mobilefirstapplications...", the URL becomes:
    // https://https://mobilefirstapplications.../rest/api/3/myself

    // The fix is to strip http:// or https:// before attempting verification.
}

testJira();
