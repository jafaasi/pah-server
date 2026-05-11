import { NextResponse } from 'next/server';
import { WinGoEngine, analyzeConvergence } from './engine_v2';

// DIRECT LINK FOR LOCAL RESIDENTIAL IPs
const HISTORY_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json';

interface GameEntry {
  issueNumber: string;
  number: string;
  color: string;
}

async function fetchHistory(): Promise<{
  history: GameEntry[];
  serviceTime: number;
  lastIssue: string;
  error: string | null;
}> {
  try {
    const ts = Date.now();
    const res = await fetch(`${HISTORY_URL}?ts=${ts}`, {
      headers: {
        'Origin': 'https://www.bdgwin888.com',
        'Referer': 'https://www.bdgwin888.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      cache: 'no-store'
    });
    const data = await res.json();
    if (data.code === 0 && data.data?.list) {
      return {
        history: data.data.list,
        serviceTime: data.serviceTime || ts,
        lastIssue: data.data.list[0]?.issueNumber || '',
        error: null,
      };
    }
    throw new Error('API Format Error');
  } catch (e: any) {
    return { history: [], serviceTime: Date.now(), lastIssue: '', error: e.message };
  }
}

export async function GET() {
  const startTime = performance.now();
  
  try {
    const { history, serviceTime, lastIssue, error } = await fetchHistory();
    if (error) throw new Error(error);

    const numbers = history.map(h => parseInt(h.number) || 0);
    const nextIssueNum = (BigInt(lastIssue) + 1n).toString();

    // ─── MASTER-STATE CRACKER ───
    const masterState = WinGoEngine.backtrackMasterState(numbers);
    const conv = analyzeConvergence(masterState ? masterState : nextIssueNum, numbers);
    
    const ghostDigit = conv.ghostDigit;
    const ghostVerdict = ghostDigit >= 5 ? 'BIG' : 'SMALL';
    const convergenceScore = masterState ? 100 : Math.round(conv.shadowConfidence * 100);

    return NextResponse.json({
      ready: true,
      live: {
        currentIssue: lastIssue,
        lastResult: numbers[0],
        lastColor: history[0]?.color || 'RED',
        serviceTime,
        timeUntilNextRound: Math.round(30 - ((serviceTime % 30000) / 1000)),
        nextIssue: nextIssueNum,
        isProxy: false
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
        score: convergenceScore,
        status: masterState ? '✦ MASTER-LOCKED (100%)' : '⬡ SYNCING WITH PLATFORM...',
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
    return NextResponse.json({ 
      ready: false, 
      error: 'Platform Syncing...', 
      serviceTime: Date.now() 
    });
  }
}
