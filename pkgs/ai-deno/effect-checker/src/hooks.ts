import { useRef, useLayoutEffect, useEffect, DependencyList } from "react";

export function useEventCallback<T extends (...args: any[]) => any>(fn: T) {
  const latestRef = useRef<T | null>(null);
  const stableRef = useRef<T | null>(null);

  if (stableRef.current == null) {
    stableRef.current = function (this: any) {
      return latestRef.current!.apply(this, arguments as any);
    } as T;
  }

  useLayoutEffect(() => {
    latestRef.current = fn;
  }, [fn]);

  return stableRef.current;
}

export function useStableEffect(
  callback: () => (() => void) | void,
  deps: DependencyList = []
) {
  const fn = useEventCallback(callback);

  useEffect(() => {
    const cleanup = fn();
    return cleanup;
  }, deps);
}

export function useThroughRef<T>(value: T) {
  const ref = useRef(value);

  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
