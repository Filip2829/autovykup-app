export default function MarketingReadinessScore({ readiness }) {
  const missing = readiness?.missing || [];
  const percent = readiness?.percent ?? 0;

  return (
    <div className="marketingReadiness">
      <div>
        <p className="label">Marketingová připravenost</p>
        <strong>{percent} %</strong>
      </div>

      {missing.length > 0 ? (
        <div>
          <p>Chybí doplnit:</p>
          <ul>
            {missing.slice(0, 6).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p>Marketingová data jsou připravena pro základní výstupy.</p>
      )}
    </div>
  );
}
