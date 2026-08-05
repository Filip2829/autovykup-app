import { useCallback, useRef, useState } from "react";
import { vehicleAi } from "../services/vehicleAi.js";

export default function useVehicleAiModule(service = vehicleAi) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const lastRequestRef = useRef(null);

  const run = useCallback(
    async (request) => {
      if (loading) return null;
      setLoading(true);
      setError("");
      lastRequestRef.current = request;

      try {
        const nextResult = await service.runModule(request);
        setResult(nextResult);
        return nextResult;
      } catch (runError) {
        setError(
          runError instanceof Error
            ? runError.message
            : "AI modul se nepodařilo spustit."
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [loading, service]
  );

  const rerun = useCallback(
    () => (lastRequestRef.current ? run(lastRequestRef.current) : null),
    [run]
  );

  const reset = useCallback(() => {
    lastRequestRef.current = null;
    setError("");
    setResult(null);
  }, []);

  return { loading, error, result, run, rerun, reset };
}
