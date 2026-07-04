export default function VehicleNotes({
  selectedCar,
  noteText,
  setNoteText,
  addNote,
  problemText,
  setProblemText,
  analyzeTechnicalProblem,
  aiLoading,
}) {
  return (
    <>
      <hr />

      <h2>Poznámky</h2>

      <textarea
        placeholder="Poznámka..."
        value={noteText}
        onChange={(event) => setNoteText(event.target.value)}
      />

      <button className="primary" onClick={addNote}>
        Přidat poznámku
      </button>

      {selectedCar.notes.map((note, index) => (
        <p key={index}>• {note}</p>
      ))}

      <hr />

      <h2>AI technický poradce</h2>

      <textarea
        placeholder="Např. vůz táhne doprava, vibruje volant při brzdění..."
        value={problemText}
        onChange={(event) => setProblemText(event.target.value)}
      />

      <button
        className="primary"
        onClick={analyzeTechnicalProblem}
        disabled={aiLoading}
      >
        {aiLoading ? "AI analyzuje..." : "Vyhodnotit závadu AI"}
      </button>

      {selectedCar.aiTechnicalReport && (
        <div className="aiReport">
          <h3>AI technické zhodnocení</h3>
          <pre>{selectedCar.aiTechnicalReport}</pre>
        </div>
      )}
    </>
  );
}
