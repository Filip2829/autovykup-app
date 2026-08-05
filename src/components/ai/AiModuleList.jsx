export default function AiModuleList({ modules, activeModuleId, onSelect }) {
  return (
    <div className="aiModuleList" aria-label="AI moduly vozidla">
      {modules.map((module) => (
        <button
          type="button"
          key={module.id}
          className={module.id === activeModuleId ? "isActive" : ""}
          onClick={() => onSelect(module.id)}
        >
          <strong>{module.label}</strong>
          <span>{module.description}</span>
        </button>
      ))}
    </div>
  );
}
