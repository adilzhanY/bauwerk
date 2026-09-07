import { useEffect } from "react";
import type { BufferGeometry } from "three";

/** Releases a geometry when it is replaced or its component unmounts. */
export function useDisposableGeometry(geometry: BufferGeometry | null): void {
  useEffect(
    () => () => {
      geometry?.dispose();
    },
    [geometry],
  );
}

/** Releases a generated geometry collection when it is replaced or unmounted. */
export function useDisposableGeometries(geometries: readonly BufferGeometry[]): void {
  useEffect(
    () => () => {
      for (const geometry of geometries) geometry.dispose();
    },
    [geometries],
  );
}
