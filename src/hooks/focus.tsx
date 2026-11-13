import { createContext, use, useMemo, useState, type ReactNode } from "react";

interface FocusValue {
  focused: string | null;
  setFocused: (slug: string | null) => void;
}

const FocusContext = createContext<FocusValue>({ focused: null, setFocused: () => {} });

/** Cross-highlight: hovering a company in a chart or a table lights it up everywhere on the page. */
export function FocusProvider({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState<string | null>(null);
  const value = useMemo(() => ({ focused, setFocused }), [focused]);
  return <FocusContext value={value}>{children}</FocusContext>;
}

export function useFocus(): FocusValue {
  return use(FocusContext);
}
