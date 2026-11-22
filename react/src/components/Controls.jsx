const STATES = [['focus', 'Focused'], ['relax', 'Relaxed'], ['closed', 'Eyes closed']];

export default function Controls({ running, setRunning, state, setState, blink, recording, toggleRec }) {
  return (
    <div className="controls">
      <button onClick={() => setRunning(r => !r)}>{running ? 'Pause' : 'Resume'}</button>
      <div className="seg" role="group" aria-label="Mental state">
        {STATES.map(([key, label]) => (
          <button key={key} aria-pressed={state === key} onClick={() => setState(key)}>{label}</button>
        ))}
      </div>
      <button onClick={blink}>Blink</button>
      <button id="rec" className={recording ? 'on' : ''} onClick={toggleRec}>
        {recording ? 'Stop and save' : 'Record'}
      </button>
    </div>
  );
}
