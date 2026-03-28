'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface UseStockfish {
  getBestMove: (fen: string, moveTimeMs?: number) => Promise<string | null>;
  isReady: boolean;
  isThinking: boolean;
  error: string | null;
}

type Resolver = (move: string | null) => void;

export function useStockfish(): UseStockfish {
  const workerRef = useRef<Worker | null>(null);
  const resolverRef = useRef<Resolver | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let worker: Worker;

    async function init() {
      try {
        // Fetch stockfish.js and create a blob worker (avoids CORS issues)
        // BUG-011: URL is configurable via NEXT_PUBLIC_STOCKFISH_URL env var
        const stockfishUrl = process.env.NEXT_PUBLIC_STOCKFISH_URL ??
          'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';
        const res = await fetch(stockfishUrl);
        if (!res.ok) throw new Error('Failed to load Stockfish');
        const text = await res.text();
        const blob = new Blob([text], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        worker = new Worker(url);
        workerRef.current = worker;

        let uciOk = false;

        worker.onmessage = (e: MessageEvent<string>) => {
          const line = e.data;
          if (!uciOk && line === 'uciok') {
            uciOk = true;
            worker.postMessage('setoption name Skill Level value 15');
            worker.postMessage('isready');
            return;
          }
          if (line === 'readyok') {
            setIsReady(true);
            return;
          }
          if (line.startsWith('bestmove')) {
            const move = line.split(' ')[1];
            setIsThinking(false);
            if (resolverRef.current) {
              resolverRef.current(move === '(none)' ? null : move);
              resolverRef.current = null;
            }
          }
        };

        worker.onerror = (e) => {
          setError(`Stockfish error: ${e.message}`);
          setIsReady(false);
        };

        worker.postMessage('uci');
      } catch (err) {
        setError(`Could not load Stockfish: ${(err as Error).message}`);
      }
    }

    init();

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const getBestMove = useCallback(
    (fen: string, moveTimeMs = 2000): Promise<string | null> => {
      return new Promise((resolve) => {
        const worker = workerRef.current;
        if (!worker || !isReady) { resolve(null); return; }

        // Cancel any pending resolver
        if (resolverRef.current) resolverRef.current(null);
        resolverRef.current = resolve;

        setIsThinking(true);
        worker.postMessage('ucinewgame');
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go movetime ${moveTimeMs}`);
      });
    },
    [isReady]
  );

  return { getBestMove, isReady, isThinking, error };
}
