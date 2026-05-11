const crypto = require('crypto');
function getResonanceDigit(nextIssueNum, serviceTime) {
    const hash = crypto.createHash('sha256').update(nextIssueNum.toString() + serviceTime).digest('hex');
    return parseInt(hash.slice(0, 1), 16) % 10;
}
console.log("Test resonance: ", getResonanceDigit(1421, Date.now()));
