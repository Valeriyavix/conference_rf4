window.addEventListener('beforeunload', (event) => {
const navEntries = performance.getEntriesByType('navigation');
const navType = navEntries.length > 0 ? navEntries[0].type : null;
if (navType === 'reload') {
    return;
}
navigator.sendBeacon('/login');
});