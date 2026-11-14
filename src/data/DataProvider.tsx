import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { buildMarket, type Market } from "../domain/market.ts";
import type { Dataset } from "../domain/types.ts";
import { createDataSource, type DataSource, type PublishRequest, type Session } from "./index.ts";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dataset: Dataset; market: Market };

interface DataContextValue {
  source: DataSource;
  state: LoadState;
  session: Session | null;
  reload: () => void;
  publish: (request: PublishRequest) => Promise<void>;
  /** Publishes a report sent by the in-game module, then reloads the market. */
  publishPending: (id: number) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const source = useMemo(() => createDataSource(), []);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [session, setSession] = useState<Session | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    source
      .load()
      .then((dataset) => {
        if (cancelled) return;
        if (dataset.snapshots.length === 0) {
          setState({ status: "error", message: "Aucun relevé publié pour l'instant." });
          return;
        }
        setState({ status: "ready", dataset, market: buildMarket(dataset) });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [source, version]);

  useEffect(() => {
    const refresh = () => {
      source.session().then(setSession, () => setSession({ state: "anonymous" }));
    };
    refresh();
    return source.onSessionChange(refresh);
  }, [source]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setVersion((v) => v + 1);
  }, []);

  const publish = useCallback(
    async (request: PublishRequest) => {
      await source.publish(request);
      setVersion((v) => v + 1);
    },
    [source],
  );

  const publishPending = useCallback(
    async (id: number) => {
      await source.publishPending(id);
      setVersion((v) => v + 1);
    },
    [source],
  );

  const value = useMemo(
    () => ({ source, state, session, reload, publish, publishPending }),
    [source, state, session, reload, publish, publishPending],
  );
  return <DataContext value={value}>{children}</DataContext>;
}

export function useData(): DataContextValue {
  const value = use(DataContext);
  if (!value) throw new Error("useData doit être utilisé sous <DataProvider>.");
  return value;
}

/** The derived market; only call below a component that has checked `state.status === "ready"`. */
export function useMarket(): Market {
  const { state } = useData();
  if (state.status !== "ready") throw new Error("Marché indisponible.");
  return state.market;
}
