import { useQuery } from "@tanstack/react-query";
import { manifestSchema, type Manifest } from "../exercises/schema";

export function useManifest() {
  return useQuery({
    queryKey: ["manifest"],
    queryFn: async (): Promise<Manifest> => manifestSchema.parse(await (await fetch("/manifest.json")).json()),
    staleTime: Infinity,
  });
}
