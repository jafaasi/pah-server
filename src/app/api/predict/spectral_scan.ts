import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════
//  PAH SPECTRAL SCANNER v1.0
//  Attempts to brute-force the LCG constants of a lottery sequence
// ═══════════════════════════════════════════════════════════════

const LCG_CANDIDATES = [
  { name: 'glibc',       a: 1103515245n,  c: 12345n,       m: 2n**31n },
  { name: 'MSVC',        a: 214013n,      c: 2531011n,     m: 2n**31n },
  { name: 'Java',        a: 25214903917n, c: 11n,          m: 2n**48n },
  { name: 'NumRec',      a: 1664525n,     c: 1013904223n,  m: 2n**32n },
  { name: 'Apple',      a: 16807n,       c: 0n,           m: 2n**31n - 1n },
  { name: 'Borland',    a: 22695477n,    c: 1n,           m: 2n**32n },
  { name: 'Knuth',      a: 6364136223846793005n, c: 1442695040888963407n, m: 2n**64n },
  { name: 'Mulberry',   a: 0x6D2B79F5n,  c: 0n,           m: 2n**32n }, // Hash style
];

async function runSpectralScan() {
  console.log('--- STARTING SPECTRAL SCAN ---');
  
  // 1. Fetch live history (last 50 results)
  const res = await fetch('https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?ts=' + Date.now(), {
    headers: { 'origin': 'https://www.bdgwin888.com', 'referer': 'https://www.bdgwin888.com/' }
  });
  const data = await res.json();
  const history = data.data.list.map((h: any) => parseInt(h.number)).reverse();
  const issues = data.data.list.map((h: any) => h.issueNumber).reverse();
  const serviceTime = data.serviceTime;

  console.log(`Loaded ${history.length} samples. Window: ${issues[0]} to ${issues[issues.length-1]}`);

  let bestModel = 'Unknown';
  let maxScore = 0;
  let bestSeed = 0n;

  // 2. Test each LCG candidate
  for (const lcg of LCG_CANDIDATES) {
    console.log(`Testing ${lcg.name}...`);
    
    // Search seeds around serviceTime (standard timing window)
    const baseSearch = BigInt(Math.floor(serviceTime / 1000));
    for (let s = baseSearch - 20000n; s < baseSearch + 2000n; s++) {
      let state = (s ^ 0x5DEECE66Dn) % lcg.m; // XOR is common in Java/SaaS engines
      let score = 0;
      
      // Advance to start of history
      for (let i = 0; i < 500; i++) {
         state = (state * lcg.a + lcg.c) % lcg.m;
      }

      // Match against history
      for (let j = 0; j < history.length; j++) {
        state = (state * lcg.a + lcg.c) % lcg.m;
        const digit = Number(state % 10n); // simplistic digit mapping
        if (digit === history[j]) score++;
        else if ((digit >= 5) === (history[j] >= 5)) score += 0.5; // partial match (BS)
      }

      if (score > maxScore) {
        maxScore = score;
        bestModel = lcg.name;
        bestSeed = s;
      }
    }
  }

  const confidence = Math.round((maxScore / history.length) * 100);
  console.log('--- SCAN COMPLETE ---');
  console.log(`Best Fit: ${bestModel}`);
  console.log(`Max Score: ${maxScore} / ${history.length} (${confidence}%)`);
  console.log(`Recovered Seed: 0x${bestSeed.toString(16).toUpperCase()}`);
  
  return { bestModel, bestSeed, confidence };
}

runSpectralScan().catch(console.error);
