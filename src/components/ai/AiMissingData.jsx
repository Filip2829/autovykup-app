export default function AiMissingData({ items, title = "Chybějící údaje" }) {
  if (!items?.length) return null;

  return (
    <section className="aiAssistantSection aiMissingData">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
