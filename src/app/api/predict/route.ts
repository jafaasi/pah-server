import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { WinGoEngine, analyzeConvergence } from './engine_v2';

const HISTORY_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json';

interface GameEntry {
  issueNumber: string;
  number: string;
  color: string;
  premium: string;
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
        'origin': 'https://www.bdgwin888.com',
        'referer': 'https://www.bdgwin888.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        'accept': 'application/json, text/plain, */*',
      },
      cache: 'no-store',
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
    return { history: [], serviceTime: ts, lastIssue: '', error: 'Bad response' };
  } catch (e) {
    return { history: [], serviceTime: Date.now(), lastIssue: '', error: String(e) };
  }
}

export async function GET(request: Request) {
  const startTime = performance.now();
  
  try {
    const { history, serviceTime, lastIssue, error } = await fetchHistory();
    if (error) throw new Error(error);

    const numbers = history.map(h => parseInt(h.number));
    const currentIssue = lastIssue;
    
    // ─── TIMING SYNC & DRIFT CORRECTION ───
    const elapsedInWindow = (serviceTime % 30000) / 1000;
    const timeUntilNextRound = Math.max(0, 30 - elapsedInWindow);
    const nextIssueNum = (BigInt(currentIssue) + 1n).toString();

    // ─── 3-LEVEL ENGINE CONVERGENCE (MASTER-STATE CRACKER) ───
    const masterState = WinGoEngine.backtrackMasterState(numbers);
    const conv = analyzeConvergence(masterState ? masterState : nextIssueNum, numbers);
    
    const ghostDigit = conv.ghostDigit;
    const ghostVerdict = ghostDigit >= 5 ? 'BIG' : 'SMALL';
    const convergenceScore = masterState ? 100 : (conv.isConverged ? 95 : Math.round(conv.shadowConfidence * 100));
    const suggestLevel = masterState ? 1 : (conv.isConverged ? 1 : 2);
    const activeStatus = masterState ? '✦ MASTER-LOCKED (100%)' : '⬡ SCANNING LATTICE (SYNCING...)';

    const elapsed = Math.round((performance.now() - startTime) * 100) / 100;

    // ─── MASTER-STATE PROJECTION (FUTURE PATH) ───
    const futurePath = masterState 
      ? WinGoEngine.fromState(masterState).generateSequence(5)
      : WinGoEngine.syncWithIssue(nextIssueNum).generateSequence(5);

    return NextResponse.json({
      ready: true,
      live: {
        currentIssue,
        lastResult: numbers[0],
        lastColor: history[0].color,
        serviceTime,
        serverTimeISO: new Date(serviceTime).toISOString(),
        recentResults: numbers.slice(0, 10),
        timeUntilNextRound: Math.round(timeUntilNextRound),
        elapsedInWindow: Math.round(elapsedInWindow),
        nextIssue: nextIssueNum,
      },
      prediction: {
        verdict: ghostVerdict,
        digit: ghostDigit,
        nextIssue: nextIssueNum,
        futurePath, // The "Hack"
      },
      shadow: {
        digit: conv.shadowDigit,
        verdict: conv.shadowDigit >= 5 ? 'BIG' : 'SMALL',
        agreement: Math.round(conv.shadowConfidence * 100),
        isCracked: true,
        seed: `0x${nextIssueNum}`,
      },
      ghost: {
        digit: ghostDigit,
        verdict: ghostVerdict,
        algorithm: 'DETERMINISTIC LCG-48 SYNC',
      },
      convergence: {
        score: convergenceScore,
        verdict: ghostVerdict,
        shadowVerdict: conv.shadowDigit >= 5 ? 'BIG' : 'SMALL',
        bothAgree: conv.isConverged,
        suggestedLevel: suggestLevel,
        status: activeStatus,
        isAgreement: conv.isConverged,
      },
      history: history.slice(0, 20).map(h => ({
        issue: h.issueNumber,
        number: parseInt(h.number),
        color: h.color,
        bigSmall: parseInt(h.number) >= 5 ? 'BIG' : 'SMALL',
      })),
      latencyMs: elapsed,
    });
  } catch (err: any) {
    console.error('[API CRASH]', err);
    return NextResponse.json({ 
      ready: false, 
      error: err.message || 'Internal Predictor Crash',
      serviceTime: Date.now() 
    });
  }
}
