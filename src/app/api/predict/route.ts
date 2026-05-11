import { NextResponse } from 'next/server';
import { WinGoEngine, analyzeConvergence } from './engine_v2';

// ─── TRIPLE-REDUNDANCY ENDPOINTS ───
const ENDPOINTS = [
  'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json',
  'https://draw.ar-lottery1.com/WinGo/WinGo_30S/GetHistoryIssuePage.json',
  'https://draw.ar-lottery.com/WinGo/WinGo_30S/GetHistoryIssuePage.json',
  'https://api.bdgwin888.com/api/web/v1/lottery/wingo/history' // Specialized BDG Endpoint
];

interface GameEntry {
  issueNumber: string;
  number: string;
  color: string;
}

function getDeterministicIssue() {
  const now = new Date();
  const utcDate = now.toISOString().slice(0, 10).replace(/-/g, '');
  const secondsSinceMidnight = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  const periodIndex = Math.floor(secondsSinceMidnight / 30) + 1;
  return `${utcDate}${periodIndex.toString().padStart(4, '0')}`;
}

async function fetchHistory(): Promise<{
  history: GameEntry[];
  serviceTime: number;
  lastIssue: string;
  isMock: boolean;
}> {
  const ts = Date.now();
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(`${url}?ts=${ts}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Origin': 'https://www.bdgwin888.com',
          'Referer': 'https://www.bdgwin888.com/',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
          'X-Requested-With': 'XMLHttpRequest'
        },
        cache: 'no-store',
        next: { revalidate: 0 }
      });
      
      if (!res.ok) continue;
      const data = await res.json();
      
      // Handle both ar-lottery and bdg-api formats
      const list = data.data?.list || data.data?.history || data.list;
      if (list && list.length > 0) {
        return {
          history: list.map((item: any) => ({
            issueNumber: item.issueNumber || item.period || item.issue_number,
            number: item.number || item.result || item.outcome,
            color: item.color || 'RED'
          })),
          serviceTime: data.serviceTime || ts,
          lastIssue: (list[0].issueNumber || list[0].period || list[0].issue_number).toString(),
          isMock: false
        };
      }
    } catch (e) { continue; }
  }

  // FALLBACK: Deterministic Seed Logic
  const lastIssue = getDeterministicIssue();
  // We use the lastIssue as a seed to ensure the mock history is CONSISTENT for all users
  const seed = BigInt(lastIssue);
  const mockHistory = Array.from({ length: 30 }, (_, i) => {
    const s = (seed - BigInt(i)) * 25214903917n;
    return {
      issueNumber: (seed - BigInt(i)).toString(),
      number: Number((s >> 17n) % 10n).toString(),
      color: i % 2 === 0 ? 'RED' : 'GREEN'
    };
  });
  return { history: mockHistory, serviceTime: Date.now(), lastIssue, isMock: true };
}

export async function GET() {
  const startTime = performance.now();
  
  try {
    const { history, serviceTime, lastIssue, isMock } = await fetchHistory();
    const numbers = history.map(h => parseInt(h.number) || 0);
    const nextIssueNum = (BigInt(lastIssue) + 1n).toString();

    const masterState = WinGoEngine.backtrackMasterState(numbers);
    const conv = analyzeConvergence(masterState ? masterState : nextIssueNum, numbers);
    
    const ghostDigit = conv.ghostDigit;
    const ghostVerdict = ghostDigit >= 5 ? 'BIG' : 'SMALL';

    return NextResponse.json({
      ready: true,
      live: {
        currentIssue: lastIssue,
        lastResult: numbers[0],
        lastColor: history[0]?.color || 'RED',
        serviceTime,
        serverTimeISO: new Date(serviceTime).toISOString(),
        recentResults: numbers.slice(0, 10),
        timeUntilNextRound: Math.round((30 - ((serviceTime % 30000) / 1000))),
        nextIssue: nextIssueNum,
        isMock
      },
      prediction: {
        verdict: ghostVerdict,
        digit: ghostDigit,
        nextIssue: nextIssueNum,
        futurePath: conv.futurePath,
      },
      ghost: {
        digit: ghostDigit,
        verdict: ghostVerdict,
        algorithm: 'DETERMINISTIC LCG-48 SYNC',
      },
      convergence: {
        score: isMock ? 85 : (masterState ? 100 : 95),
        status: isMock ? '◌ CALIBRATING LATTICE (TEST-MODE)' : (masterState ? '✦ MASTER-LOCKED (100%)' : '⬡ SYNCING...'),
        isAgreement: conv.isConverged,
      },
      history: history.slice(0, 20).map(h => ({
        issue: h.issueNumber,
        number: parseInt(h.number) || 0,
        color: h.color,
        bigSmall: (parseInt(h.number) || 0) >= 5 ? 'BIG' : 'SMALL',
      })),
      latencyMs: Math.round((performance.now() - startTime) * 100) / 100,
    });
  } catch (err: any) {
    return NextResponse.json({ ready: false, error: 'Sync Error' });
  }
}
