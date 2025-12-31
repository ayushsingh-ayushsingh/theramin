export default function KeyBed() {
  const firstKeys = [false, true, false, true, false];
  const lastKeys = [false, true, false, true, false, true, false];
  const numOctaves = 5;

  return (
    <div>
      <div className={`w-screen h-screen grid grid-cols-${numOctaves}`}>
        {Array(numOctaves)
          .fill(null)
          .map((_octave, octaveIndex) => (
            <div key={octaveIndex} className="h-screen grid grid-cols-12">
              {firstKeys.map((key, keyIndex) =>
                !key ? (
                  <div
                    key={keyIndex}
                    className="h-screen col-span-1 bg-cyan-600 border border-cyan-950"
                  />
                ) : (
                  <div
                    key={keyIndex}
                    className="h-screen col-span-1 bg-cyan-950 border border-cyan-950"
                  />
                )
              )}
              {lastKeys.map((key, keyIndex) =>
                !key ? (
                  <div
                    key={keyIndex}
                    className="h-screen col-span-1 bg-cyan-600 border border-cyan-950"
                  />
                ) : (
                  <div
                    key={keyIndex}
                    className="h-screen col-span-1 bg-cyan-950 border border-cyan-950"
                  />
                )
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
