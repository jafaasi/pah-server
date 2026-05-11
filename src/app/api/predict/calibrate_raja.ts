/**
 * ═══════════════════════════════════════════════════════════════
 *  PAH RAJAPARTY CALIBRATOR v2.0
 *  Multi-Algorithm Brute-Force Scanner
 * ═══════════════════════════════════════════════════════════════
 */

async function calibrate() {
  console.log('--- STARTING RAJAPARTY CALIBRATION v2 ---');
  
  const HISTORY_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json';
  const ts = Date.now();
  
  const res = await fetch(`${HISTORY_URL}?ts=${ts}`, {
    headers: {
      'origin': 'https://www.rajaparty6.com',
      'referer': 'https://www.rajaparty6.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    }
  });

  const data: any = await res.json();
  const history = data.data.list.map((h: any) => parseInt(h.number)).reverse(); 
  const serviceTime = data.serviceTime;

  console.log(`Loaded ${history.length} samples. Windows: ${serviceTime}`);

  let bestScore = 0;
  let winner = '';

  // 1. JAVA LCG (5-Step PK5 Draw)
  console.log('Scanning Java-LCG (PK5 Pattern)...');
  const a = 25214903917n;
  const m = 1n << 48n;
  const mask = m - 1n;
  const candidateCs = [11n, 13n, 17n, 21n];

  for (const c of candidateCs) {
    for (let offset = -20000n; offset < 5000n; offset++) {
      const seed = BigInt(serviceTime) + offset;
      let state = (seed ^ 0x5DEECE66Dn) & mask;
      
      // Warmup skip
      for (let i = 0; i < 150; i++) state = (state * a + c) & mask;

      let score = 0;
      let testState = state;
      for (let j = 0; j < 15; j++) {
        let roundDigit = 0;
        for (let k = 0; k < 5; k++) {
          testState = (testState * a + c) & mask;
          roundDigit = Number((testState >> 17n) % 10n);
        }
        if (roundDigit === history[j]) score++; else break;
      }
      if (score > bestScore) {
        bestScore = score;
        winner = `Java-LCG (c=${c}, offset=${offset})`;
        if (score >= 10) break;
      }
    }
    if (bestScore >= 10) break;
  }

  // 2. MULBERRY32 (Direct)
  if (bestScore < 10) {
    console.log('Scanning Mulberry32...');
    for (let offset = -30000n; offset < 5000n; offset++) {
      let s = Number(BigInt(serviceTime) + offset) >>> 0;
      let score = 0;
      for (let j = 0; j < 15; j++) {
        let t = s += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        const digit = Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * 10);
        if (digit === history[j]) score++; else break;
      }
      if (score > bestScore) {
        bestScore = score;
        winner = `Mulberry32 (offset=${offset})`;
        if (score >= 10) break;
      }
    }
  }

  // 3. SPLITMIX64
  if (bestScore < 10) {
    console.log('Scanning SplitMix64...');
    for (let offset = -30000n; offset < 5000n; offset++) {
      let x = BigInt(serviceTime) + offset;
      let score = 0;
      for (let j = 0; j < 15; j++) {
        x += 0x9e3779b97f4a7c15n;
        let z = (x ^ (x >> 30n)) * 0xbf58476d1ce4e5b9n;
        z = (z ^ (z >> 27n)) * 0x94d049bb133111ebn;
        z = z ^ (z >> 31n);
        const digit = Number(z % 10n);
        if (digit === history[j]) score++; else break;
      }
      if (score > bestScore) {
        bestScore = score;
        winner = `SplitMix64 (offset=${offset})`;
      }
    }
  }

  // 4. ISSUE-BASED SEEDING (Random(issueNumber))
  if (bestScore < 10) {
    console.log('Scanning Issue-based Seeding...');
    // We need the issue numbers from history
    const issues = data.data.list.map((h: any) => parseInt(h.issueNumber)).reverse();
    
    // Test common salts/offsets on issue number
    const salts = [0n, 0x5DEECE66Dn, 123456789n];
    for (const salt of salts) {
      let score = 0;
      for (let j = 0; j < history.length; j++) {
        const seed = BigInt(issues[j]) ^ salt;
        let state = (seed * a + 11n) & mask;
        const digit = Number((state >> 17n) % 10n);
        if (digit === history[j]) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        winner = `Issue-Based (salt=${salt})`;
      }
    }
  }

  console.log('--- CALIBRATION RESULT ---');
  console.log(`Best Model: ${winner}`);
  console.log(`Max Score: ${bestScore}/15`);
  
  if (bestScore >= 10) {
    console.log('✅ ENGINE IDENTIFIED. PROCEED WITH LOCK.');
  } else {
    console.log('❌ UNKNOWN ENGINE. SALT OR MAPPING DIFFERENCE DETECTED.');
  }
}

calibrate().catch(console.error);
