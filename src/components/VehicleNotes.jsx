export default function VehicleNotes({
  selectedCar,
  noteText,
  setNoteText,
  addNote,
}) {
  return (
    <>
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
    </>
  );
}
